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
