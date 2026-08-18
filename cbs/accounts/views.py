from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction as db_transaction
from django.db.models import Q, Sum
from merchants.models import Transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import CreateAPIView, ListAPIView, ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from cbs.pagination import StandardResultsPagination
from cbs.utils import ValidatedUUIDLookupMixin, get_object_or_400
from wallets.models import Wallet
from wallets.permissions import IsAgent, IsAgentOrAdmin
from wallets.serializers import WalletCreateSerializer, WalletCreationRequestSerializer, WalletSerializer
from .auth import RoleTokenObtainPairSerializer
from .models import CustomerProfile, Role, SignupStatus
from .serializers import (
    AgentCreateSerializer, AgentStatusUpdateSerializer, CustomerCreateSerializer, CustomerProfileSerializer,
    CustomerStatusUpdateSerializer, PublicSignupSerializer, SignupApprovalSerializer, TransactionSerializer,
)

User = get_user_model()


class RoleTokenObtainPairView(TokenObtainPairView):
    serializer_class = RoleTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class LogoutView(APIView):
    """Blacklists the refresh token so it can't be used again — the access token already issued
    keeps working until its own (short) expiry, but the session can no longer be renewed."""
    permission_classes = [AllowAny]

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            raise ValidationError({"refresh": "This field is required."})
        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            raise ValidationError({"refresh": "Invalid or already-invalidated token."})
        return Response(status=status.HTTP_205_RESET_CONTENT)


class CustomerListCreateView(ListCreateAPIView):
    """List/search is how an agent (or admin, browsing) finds a customer; only an agent registers one."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAgent()]
        return [IsAgentOrAdmin()]

    def get_serializer_class(self):
        return CustomerCreateSerializer if self.request.method == "POST" else CustomerProfileSerializer

    def get_queryset(self):
        # Pending/denied signup requests aren't customers yet (no wallet, can't log in) — they
        # only surface via SignupRequestListView until an admin decides them.
        qs = CustomerProfile.objects.filter(status=SignupStatus.APPROVED).select_related("user").order_by("-created_at")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(tag__icontains=search)
                | Q(national_id_number__icontains=search)
            )
        return qs


class CustomerDetailView(ValidatedUUIDLookupMixin, RetrieveUpdateAPIView):
    queryset = CustomerProfile.objects.select_related("user")

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return CustomerStatusUpdateSerializer
        return CustomerProfileSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsAdminUser()]
        return [IsAgentOrAdmin()]

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CustomerProfileSerializer(instance).data)


class PublicSignupView(CreateAPIView):
    """Public self-registration — no auth required. Creates a PENDING, inactive account; an
    admin must approve it (SignupRequestListView + Approve/DenySignupRequestView) before the
    applicant can log in."""
    serializer_class = PublicSignupSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "signup"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_201_CREATED)


class SignupRequestListView(ListAPIView):
    """Feeds the admin dashboard's "pending signup requests" panel."""
    serializer_class = CustomerProfileSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return CustomerProfile.objects.filter(status=SignupStatus.PENDING).select_related("user").order_by("-created_at")


class _DecideSignupRequestView(APIView):
    permission_classes = [IsAdminUser]

    def get_request(self, request_id):
        customer = get_object_or_400(CustomerProfile, request_id)
        if customer.status != SignupStatus.PENDING:
            raise ValidationError("This signup request has already been decided.")
        return customer


class ApproveSignupRequestView(_DecideSignupRequestView):
    def post(self, request, request_id):
        customer = self.get_request(request_id)
        serializer = SignupApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        wallet_profile = serializer.validated_data["wallet_profile_id"]

        with db_transaction.atomic():
            customer.status = SignupStatus.APPROVED
            customer.save(update_fields=["status"])
            customer.user.is_active = True
            customer.user.save(update_fields=["is_active"])
            Wallet.objects.create(client=customer.user, profile=wallet_profile, tag=customer.tag)

        return Response(CustomerProfileSerializer(customer).data)


class DenySignupRequestView(_DecideSignupRequestView):
    def post(self, request, request_id):
        customer = self.get_request(request_id)
        customer.status = SignupStatus.DENIED
        customer.save(update_fields=["status"])
        return Response(CustomerProfileSerializer(customer).data)


class AgentListCreateView(ListCreateAPIView):
    """Admin-only directory of agents — also feeds the "owner" picker when creating a merchant."""
    queryset = User.objects.filter(role=Role.AGENT).order_by("username")
    serializer_class = AgentCreateSerializer
    permission_classes = [IsAdminUser]


class AgentDetailView(ValidatedUUIDLookupMixin, RetrieveUpdateAPIView):
    queryset = User.objects.filter(role=Role.AGENT)
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return AgentStatusUpdateSerializer
        return AgentCreateSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AgentCreateSerializer(instance).data)


class CustomerWalletListCreateView(ListCreateAPIView):
    """A customer can hold more than one wallet (e.g. one per currency); an agent manages that here."""
    permission_classes = [IsAgent]

    def get_customer(self):
        if not hasattr(self, "_customer"):
            self._customer = get_object_or_400(CustomerProfile, self.kwargs["customer_id"])
        return self._customer

    def get_queryset(self):
        return Wallet.objects.filter(client=self.get_customer().user).select_related("profile").order_by("created_at")

    def get_serializer_class(self):
        return WalletCreateSerializer if self.request.method == "POST" else WalletSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["customer"] = self.get_customer()
        context["requested_by"] = self.request.user
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        wallet_request = serializer.save()
        return Response(WalletCreationRequestSerializer(wallet_request).data, status=201)


def _customer_wallets(customer, params):
    wallets = Wallet.objects.filter(client=customer.user)
    wallet_id = params.get("wallet_id")
    if wallet_id:
        wallets = wallets.filter(id=wallet_id)
    return wallets


def _filter_transactions(qs, params, include_type=True):
    if include_type:
        type_ = params.get("type")
        if type_:
            qs = qs.filter(type=type_)

    status_ = params.get("status")
    date_from = params.get("date_from")
    date_to = params.get("date_to")

    if status_:
        qs = qs.filter(status=status_)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    return qs


class CustomerTransactionListView(ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAgentOrAdmin]
    pagination_class = StandardResultsPagination

    def get_customer(self):
        if not hasattr(self, "_customer"):
            self._customer = get_object_or_400(CustomerProfile, self.kwargs["customer_id"])
        return self._customer

    def get_queryset(self):
        wallets = _customer_wallets(self.get_customer(), self.request.query_params)
        qs = Transaction.objects.filter(Q(from_wallet__in=wallets) | Q(to_wallet__in=wallets))
        qs = _filter_transactions(qs, self.request.query_params)
        return qs.order_by("-created_at")


class AgentTransactionListView(ListAPIView):
    """Everything a given agent has personally performed — in practice, the deposits they've made
    on customers' behalf, since transfers and payments are always self-service by the customer."""
    serializer_class = TransactionSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardResultsPagination

    def get_queryset(self):
        agent = get_object_or_400(User.objects.filter(role=Role.AGENT), self.kwargs["agent_id"])
        qs = Transaction.objects.filter(performed_by=agent)
        qs = _filter_transactions(qs, self.request.query_params)
        return qs.order_by("-created_at")


class CustomerTransactionStatisticsView(APIView):
    permission_classes = [IsAgentOrAdmin]

    def get(self, request, customer_id):
        customer = get_object_or_400(CustomerProfile, customer_id)
        wallets = _customer_wallets(customer, request.query_params)

        # Unless the caller explicitly filters by status, these totals should only
        # reflect money that actually moved — a FAILED payment attempt (see Topic 4)
        # is persisted now but must not inflate "total paid" or the transaction count.
        default_to_completed = "status" not in request.query_params

        def total(type_, wallet_field):
            qs = Transaction.objects.filter(type=type_, **{f"{wallet_field}__in": wallets})
            qs = _filter_transactions(qs, request.query_params, include_type=False)
            if default_to_completed:
                qs = qs.filter(status=Transaction.Status.COMPLETED)
            return qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

        all_qs = _filter_transactions(
            Transaction.objects.filter(Q(from_wallet__in=wallets) | Q(to_wallet__in=wallets)),
            request.query_params,
        )
        if default_to_completed:
            all_qs = all_qs.filter(status=Transaction.Status.COMPLETED)

        return Response({
            "total_deposited": total(Transaction.Type.DEPOSIT, "to_wallet"),
            "total_transferred": total(Transaction.Type.TRANSFER, "from_wallet"),
            "total_paid_bills": total(Transaction.Type.PAYMENT, "from_wallet"),
            "total_transactions": all_qs.count(),
        })
