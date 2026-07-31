from django.db.models import Q
from django.utils import timezone
from merchants.models import Transaction
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveAPIView
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from cbs.utils import get_object_or_400, parse_uuid
from .models import Wallet, WalletCreationRequest, WalletProfile
from .permissions import IsAgent, IsClient
from .services import generate_unique_tag, resolve_wallet_by_tag
from .serializers import (
    DepositCreateSerializer, DepositSerializer,
    PaymentCreateSerializer, PaymentSerializer,
    TransferCreateSerializer, TransferSerializer,
    WalletBalanceSerializer, WalletCreationRequestSerializer, WalletProfileSerializer, WalletSerializer,
)


def _filter_by_amount_and_date(qs, params):
    min_amount = params.get("min_amount")
    max_amount = params.get("max_amount")
    date_from = params.get("date_from")
    date_to = params.get("date_to")

    if min_amount:
        qs = qs.filter(amount__gte=min_amount)
    if max_amount:
        qs = qs.filter(amount__lte=max_amount)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    return qs


class WalletOwnerOrAgentMixin:
    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        parse_uuid(self.kwargs[lookup_url_kwarg])
        obj = super().get_object()
        user = self.request.user
        if user.role != Role.AGENT and obj.client_id != user.id:
            raise PermissionDenied("You do not have access to this wallet.")
        return obj


class WalletScopedMixin:
    def get_wallet(self):
        if not hasattr(self, "_wallet"):
            self._wallet = get_object_or_400(Wallet, self.kwargs["wallet_id"])
        return self._wallet

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["wallet"] = self.get_wallet()
        return context

    def require_owner(self, wallet, message):
        if wallet.client_id != self.request.user.id:
            raise PermissionDenied(message)

    def require_owner_or_agent(self, wallet, message):
        user = self.request.user
        if user.role != Role.AGENT and wallet.client_id != user.id:
            raise PermissionDenied(message)


class MyWalletView(ListAPIView):
    """A logged-in customer's own wallets — how they discover wallet ids to act on. A customer may hold
    more than one (e.g. one per currency)."""
    serializer_class = WalletSerializer
    permission_classes = [IsClient]

    def get_queryset(self):
        return Wallet.objects.filter(client=self.request.user).select_related("client", "profile").order_by("created_at")


class MyWalletRequestsView(ListAPIView):
    """Pending wallet requests an agent has opened for the logged-in customer — the notification
    that drives the Dashboard confirm/decline banner."""
    serializer_class = WalletCreationRequestSerializer
    permission_classes = [IsClient]

    def get_queryset(self):
        return WalletCreationRequest.objects.filter(
            customer=self.request.user, status=WalletCreationRequest.Status.PENDING,
        ).select_related("wallet_profile", "requested_by").order_by("-created_at")


class _DecideWalletRequestView(APIView):
    permission_classes = [IsClient]

    def get_request(self, request_id):
        wallet_request = get_object_or_400(WalletCreationRequest, request_id)
        if wallet_request.customer_id != self.request.user.id:
            raise PermissionDenied("This wallet request does not belong to you.")
        if wallet_request.status != WalletCreationRequest.Status.PENDING:
            raise ValidationError("This request has already been decided.")
        return wallet_request


class ConfirmWalletRequestView(_DecideWalletRequestView):
    def post(self, request, request_id):
        wallet_request = self.get_request(request_id)

        tag = generate_unique_tag(wallet_request.customer.username)
        wallet = Wallet.objects.create(
            client=wallet_request.customer, profile=wallet_request.wallet_profile, tag=tag,
        )
        wallet_request.status = WalletCreationRequest.Status.CONFIRMED
        wallet_request.wallet = wallet
        wallet_request.decided_at = timezone.now()
        wallet_request.save()

        return Response(WalletSerializer(wallet).data)


class DeclineWalletRequestView(_DecideWalletRequestView):
    def post(self, request, request_id):
        wallet_request = self.get_request(request_id)

        wallet_request.status = WalletCreationRequest.Status.DECLINED
        wallet_request.decided_at = timezone.now()
        wallet_request.save()

        return Response(WalletCreationRequestSerializer(wallet_request).data)


class RecipientLookupView(APIView):
    """Resolve a wallet tag to the recipient's name before a transfer is confirmed — deliberately
    returns nothing but a name, no balance or other account details."""
    permission_classes = [IsClient]

    def get(self, request, tag):
        wallet = resolve_wallet_by_tag(tag)
        if wallet.client.role != Role.CLIENT:
            raise ValidationError("No customer found for this tag.")

        return Response({
            "tag": wallet.tag,
            "first_name": wallet.client.first_name,
            "name": wallet.client.last_name,
        })


class WalletDetailView(WalletOwnerOrAgentMixin, RetrieveAPIView):
    queryset = Wallet.objects.select_related("client", "profile")
    serializer_class = WalletSerializer


class WalletBalanceView(WalletOwnerOrAgentMixin, RetrieveAPIView):
    queryset = Wallet.objects.all()
    serializer_class = WalletBalanceSerializer


class WalletProfileListCreateView(ListCreateAPIView):
    queryset = WalletProfile.objects.all()
    serializer_class = WalletProfileSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdminUser()]
        return [IsAuthenticated()]


class WalletDepositListCreateView(WalletScopedMixin, ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAgent()]
        return [IsClient()]

    def get_serializer_class(self):
        return DepositCreateSerializer if self.request.method == "POST" else DepositSerializer

    def get_queryset(self):
        wallet = self.get_wallet()
        self.require_owner(wallet, "You do not have access to this wallet's deposit history.")

        qs = Transaction.objects.filter(to_wallet=wallet, type=Transaction.Type.DEPOSIT)
        qs = _filter_by_amount_and_date(qs, self.request.query_params)

        ordering = "created_at" if self.request.query_params.get("ordering") == "created_at" else "-created_at"
        return qs.order_by(ordering)


class WalletTransferListCreateView(WalletScopedMixin, ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsClient()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        return TransferCreateSerializer if self.request.method == "POST" else TransferSerializer

    def get_queryset(self):
        wallet = self.get_wallet()
        self.require_owner_or_agent(wallet, "You do not have access to this wallet's transfers.")

        qs = Transaction.objects.filter(type=Transaction.Type.TRANSFER).filter(
            Q(from_wallet=wallet) | Q(to_wallet=wallet)
        )
        qs = _filter_by_amount_and_date(qs, self.request.query_params)

        direction = self.request.query_params.get("direction")
        if direction == "CREDIT":
            qs = qs.filter(to_wallet=wallet)
        elif direction == "DEBIT":
            qs = qs.filter(from_wallet=wallet)

        ordering = "created_at" if self.request.query_params.get("ordering") == "created_at" else "-created_at"
        return qs.order_by(ordering)

    def create(self, request, *args, **kwargs):
        self.require_owner_or_agent(self.get_wallet(), "You do not have access to this wallet's transfers.")
        return super().create(request, *args, **kwargs)


class WalletPaymentListCreateView(WalletScopedMixin, ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsClient()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        return PaymentCreateSerializer if self.request.method == "POST" else PaymentSerializer

    def get_queryset(self):
        wallet = self.get_wallet()
        self.require_owner_or_agent(wallet, "You do not have access to this wallet's payment history.")

        qs = Transaction.objects.filter(from_wallet=wallet, type=Transaction.Type.PAYMENT)
        qs = _filter_by_amount_and_date(qs, self.request.query_params)

        ordering = "created_at" if self.request.query_params.get("ordering") == "created_at" else "-created_at"
        return qs.order_by(ordering)

    def create(self, request, *args, **kwargs):
        self.require_owner_or_agent(self.get_wallet(), "You do not have access to this wallet's payments.")
        return super().create(request, *args, **kwargs)
