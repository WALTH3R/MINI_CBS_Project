from django.urls import path

from .views import (
    AgentListCreateView, CustomerListCreateView, CustomerDetailView, CustomerWalletListCreateView,
    CustomerTransactionListView, CustomerTransactionStatisticsView,
)

urlpatterns = [
    path("customers/", CustomerListCreateView.as_view()),
    path("customers/<str:pk>/", CustomerDetailView.as_view()),
    path("customers/<str:customer_id>/wallets/", CustomerWalletListCreateView.as_view()),
    path("customers/<str:customer_id>/transactions/", CustomerTransactionListView.as_view()),
    path("customers/<str:customer_id>/transactions/statistics/", CustomerTransactionStatisticsView.as_view()),
    path("agents/", AgentListCreateView.as_view()),
]
