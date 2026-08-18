from django.urls import path

from .views import (
    AgentDetailView, AgentListCreateView, AgentTransactionListView, ApproveSignupRequestView,
    CustomerListCreateView, CustomerDetailView, CustomerWalletListCreateView, CustomerTransactionListView,
    CustomerTransactionStatisticsView, DenySignupRequestView, PublicSignupView, SignupRequestListView,
)

urlpatterns = [
    path("customers/", CustomerListCreateView.as_view()),
    path("customers/<str:pk>/", CustomerDetailView.as_view()),
    path("customers/<str:customer_id>/wallets/", CustomerWalletListCreateView.as_view()),
    path("customers/<str:customer_id>/transactions/", CustomerTransactionListView.as_view()),
    path("customers/<str:customer_id>/transactions/statistics/", CustomerTransactionStatisticsView.as_view()),
    path("agents/", AgentListCreateView.as_view()),
    path("agents/<str:pk>/", AgentDetailView.as_view()),
    path("agents/<str:agent_id>/transactions/", AgentTransactionListView.as_view()),
    path("signup/", PublicSignupView.as_view()),
    path("signup-requests/", SignupRequestListView.as_view()),
    path("signup-requests/<str:request_id>/approve/", ApproveSignupRequestView.as_view()),
    path("signup-requests/<str:request_id>/deny/", DenySignupRequestView.as_view()),
]
