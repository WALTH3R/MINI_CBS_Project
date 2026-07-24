from django.urls import path

from .views import (
    AgentCreateView, CustomerCreateView, CustomerDetailView,
    CustomerTransactionListView, CustomerTransactionStatisticsView,
)

urlpatterns = [
    path("customers/", CustomerCreateView.as_view()),
    path("customers/<str:pk>/", CustomerDetailView.as_view()),
    path("customers/<str:customer_id>/transactions/", CustomerTransactionListView.as_view()),
    path("customers/<str:customer_id>/transactions/statistics/", CustomerTransactionStatisticsView.as_view()),
    path("agents/", AgentCreateView.as_view()),
]
