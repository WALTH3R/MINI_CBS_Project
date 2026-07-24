from django.urls import path

from .views import (
    WalletBalanceView, WalletDepositListCreateView, WalletDetailView,
    WalletPaymentListCreateView, WalletProfileListCreateView, WalletTransferListCreateView,
)

urlpatterns = [
    path("profiles/", WalletProfileListCreateView.as_view()),
    path("<str:wallet_id>/deposits/", WalletDepositListCreateView.as_view()),
    path("<str:wallet_id>/transfers/", WalletTransferListCreateView.as_view()),
    path("<str:wallet_id>/payments/", WalletPaymentListCreateView.as_view()),
    path("<str:pk>/", WalletDetailView.as_view()),
    path("<str:pk>/balance/", WalletBalanceView.as_view()),
]
