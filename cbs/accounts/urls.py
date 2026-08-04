from django.urls import path

from .views import (
    AgentDetailView, AgentListCreateView, AgentTransactionListView, CustomerListCreateView, CustomerDetailView,
    CustomerWalletListCreateView, CustomerTransactionListView, CustomerTransactionStatisticsView,
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
]
