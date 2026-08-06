# api/urls.py
from django.urls import path
from .views import HealthCheckView, MeView

urlpatterns = [
    path('me/', MeView.as_view()),
    path('health/', HealthCheckView.as_view()),
]