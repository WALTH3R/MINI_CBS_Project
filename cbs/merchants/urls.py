from django.urls import path

from .views import MerchantDetailView, MerchantListCreateView, MerchantPaymentListView

urlpatterns = [
    path("", MerchantListCreateView.as_view()),
    path("<str:pk>/", MerchantDetailView.as_view()),
    path("<str:merchant_id>/payments/", MerchantPaymentListView.as_view()),
]
