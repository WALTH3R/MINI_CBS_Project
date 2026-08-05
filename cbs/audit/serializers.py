from rest_framework import serializers

from .models import AuditLogEntry


class AuditLogEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLogEntry
        fields = [
            "id", "request_id", "username", "method", "path",
            "status_code", "ip_address", "user_agent", "created_at",
        ]
        read_only_fields = fields
