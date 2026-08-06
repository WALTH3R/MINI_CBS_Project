from django.db.models import Q
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAdminUser

from cbs.pagination import StandardResultsPagination
from .models import AuditLogEntry, ErrorLogEntry
from .serializers import AuditLogEntrySerializer, ErrorLogEntrySerializer


def _filter_audit_log(qs, params):
    method = params.get("method")
    status_code = params.get("status_code")
    date_from = params.get("date_from")
    date_to = params.get("date_to")
    search = params.get("search")

    if method:
        qs = qs.filter(method=method)
    if status_code:
        qs = qs.filter(status_code=status_code)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    if search:
        qs = qs.filter(Q(username__icontains=search) | Q(path__icontains=search))

    return qs


class AuditLogListView(ListAPIView):
    serializer_class = AuditLogEntrySerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardResultsPagination

    def get_queryset(self):
        return _filter_audit_log(AuditLogEntry.objects.all(), self.request.query_params)


def _filter_error_log(qs, params):
    exception_type = params.get("exception_type")
    date_from = params.get("date_from")
    date_to = params.get("date_to")
    search = params.get("search")

    if exception_type:
        qs = qs.filter(exception_type=exception_type)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    if search:
        qs = qs.filter(Q(path__icontains=search) | Q(message__icontains=search))

    return qs


class ErrorLogListView(ListAPIView):
    serializer_class = ErrorLogEntrySerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardResultsPagination

    def get_queryset(self):
        return _filter_error_log(ErrorLogEntry.objects.all(), self.request.query_params)
