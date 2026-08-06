from django.urls import path

from .views import AuditLogListView, ErrorLogListView

urlpatterns = [
    path("", AuditLogListView.as_view()),
    path("errors/", ErrorLogListView.as_view()),
]
