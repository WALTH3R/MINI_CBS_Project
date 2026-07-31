from django.urls import path

from .views import (
    ConfirmWalletRequestView, DeclineWalletRequestView, MyWalletRequestsView, MyWalletView, RecipientLookupView,
    WalletBalanceView, WalletDepositListCreateView, WalletDetailView,
    WalletPaymentListCreateView, WalletProfileListCreateView, WalletTransferListCreateView,
)

urlpatterns = [
    path("profiles/", WalletProfileListCreateView.as_view()),
    path("mine/", MyWalletView.as_view()),
    path("recipients/<str:tag>/", RecipientLookupView.as_view()),
    path("requests/mine/", MyWalletRequestsView.as_view()),
    path("requests/<str:request_id>/confirm/", ConfirmWalletRequestView.as_view()),
    path("requests/<str:request_id>/decline/", DeclineWalletRequestView.as_view()),
    path("<str:wallet_id>/deposits/", WalletDepositListCreateView.as_view()),
    path("<str:wallet_id>/transfers/", WalletTransferListCreateView.as_view()),
    path("<str:wallet_id>/payments/", WalletPaymentListCreateView.as_view()),
    path("<str:pk>/", WalletDetailView.as_view()),
    path("<str:pk>/balance/", WalletBalanceView.as_view()),
]
