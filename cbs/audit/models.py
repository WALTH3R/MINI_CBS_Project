import uuid

from django.db import models


class AuditLogEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_id = models.UUIDField(db_index=True)

    user = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="audit_log_entries")
    username = models.CharField(max_length=150, blank=True)

    method = models.CharField(max_length=10)
    path = models.CharField(max_length=255)
    status_code = models.PositiveSmallIntegerField()

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class ErrorLogEntry(models.Model):
    """Genuine unhandled exceptions (500s) only — see audit/exceptions.py. Deliberately excludes
    routine 4xx (validation errors, permission denials) which are normal application flow, not
    bugs; those stay visible via AuditLogEntry and System Health's error-rate stat."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    method = models.CharField(max_length=10)
    path = models.CharField(max_length=255)
    exception_type = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    traceback = models.TextField(blank=True)

    user = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="error_log_entries")
    username = models.CharField(max_length=150, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
