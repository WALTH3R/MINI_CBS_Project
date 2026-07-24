from django.urls import path

from .views import (
    WalletBalanceView, WalletDepositListCreateView, WalletDetailView,
    WalletPaymentListCreateView, WalletProfileListCreateView, WalletTransferListCreateView,
)

urlpatterns = [
    path("profiles/", WalletProfileListCreateView.as_view()),
    path("<int:wallet_id>/deposits/", WalletDepositListCreateView.as_view()),
    path("<int:wallet_id>/transfers/", WalletTransferListCreateView.as_view()),
    path("<int:wallet_id>/payments/", WalletPaymentListCreateView.as_view()),
    path("<int:pk>/", WalletDetailView.as_view()),
    path("<int:pk>/balance/", WalletBalanceView.as_view()),
]
