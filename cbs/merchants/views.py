from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from accounts.models import Role
from .models import Merchant, Transaction
from .serializers import (
    MerchantCreateSerializer, MerchantPaymentSerializer, MerchantSerializer, MerchantUpdateSerializer,
)


class MerchantListCreateView(ListCreateAPIView):
    queryset = Merchant.objects.select_related("owner", "wallet")

    def get_serializer_class(self):
        return MerchantCreateSerializer if self.request.method == "POST" else MerchantSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdminUser()]
        return [IsAuthenticated()]


class MerchantDetailView(RetrieveUpdateAPIView):
    queryset = Merchant.objects.select_related("owner", "wallet")

    def get_serializer_class(self):
        return MerchantUpdateSerializer if self.request.method in ("PUT", "PATCH") else MerchantSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsAdminUser()]
        return [IsAuthenticated()]


class MerchantPaymentListView(ListAPIView):
    serializer_class = MerchantPaymentSerializer

    def get_merchant(self):
        if not hasattr(self, "_merchant"):
            self._merchant = get_object_or_404(Merchant, pk=self.kwargs["merchant_id"])
        return self._merchant

    def get_queryset(self):
        merchant = self.get_merchant()
        user = self.request.user
        if user.role != Role.AGENT and merchant.owner_id != user.id:
            raise PermissionDenied("You do not have access to this merchant's payment history.")
        return Transaction.objects.filter(
            to_wallet=merchant.wallet, type=Transaction.Type.PAYMENT
        ).order_by("-created_at")
