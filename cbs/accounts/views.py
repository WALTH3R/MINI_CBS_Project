from decimal import Decimal

from django.db.models import Q, Sum
from merchants.models import Transaction
from rest_framework.generics import CreateAPIView, ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from cbs.utils import ValidatedUUIDLookupMixin, get_object_or_400
from wallets.models import Wallet
from wallets.permissions import IsAgent
from .models import CustomerProfile
from .serializers import (
    AgentCreateSerializer, CustomerCreateSerializer, CustomerProfileSerializer, TransactionSerializer,
)


class CustomerCreateView(CreateAPIView):
    serializer_class = CustomerCreateSerializer
    permission_classes = [IsAgent]


class CustomerDetailView(ValidatedUUIDLookupMixin, RetrieveAPIView):
    queryset = CustomerProfile.objects.select_related("user")
    serializer_class = CustomerProfileSerializer
    permission_classes = [IsAgent]


class AgentCreateView(CreateAPIView):
    serializer_class = AgentCreateSerializer
    permission_classes = [IsAdminUser]


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
    permission_classes = [IsAgent]

    def get_customer(self):
        if not hasattr(self, "_customer"):
            self._customer = get_object_or_400(CustomerProfile, self.kwargs["customer_id"])
        return self._customer

    def get_queryset(self):
        wallets = Wallet.objects.filter(client=self.get_customer().user)
        qs = Transaction.objects.filter(Q(from_wallet__in=wallets) | Q(to_wallet__in=wallets))
        qs = _filter_transactions(qs, self.request.query_params)
        return qs.order_by("-created_at")


class CustomerTransactionStatisticsView(APIView):
    permission_classes = [IsAgent]

    def get(self, request, customer_id):
        customer = get_object_or_400(CustomerProfile, customer_id)
        wallets = Wallet.objects.filter(client=customer.user)

        def total(type_, wallet_field):
            qs = Transaction.objects.filter(type=type_, **{f"{wallet_field}__in": wallets})
            qs = _filter_transactions(qs, request.query_params, include_type=False)
            return qs.aggregate(total=Sum("amount"))["total"] or Decimal("0")

        all_qs = _filter_transactions(
            Transaction.objects.filter(Q(from_wallet__in=wallets) | Q(to_wallet__in=wallets)),
            request.query_params,
        )

        return Response({
            "total_deposited": total(Transaction.Type.DEPOSIT, "to_wallet"),
            "total_transferred": total(Transaction.Type.TRANSFER, "from_wallet"),
            "total_paid_bills": total(Transaction.Type.PAYMENT, "from_wallet"),
            "total_transactions": all_qs.count(),
        })
