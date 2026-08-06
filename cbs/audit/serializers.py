from rest_framework import serializers

from .models import AuditLogEntry, ErrorLogEntry


class AuditLogEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLogEntry
        fields = [
            "id", "request_id", "username", "method", "path",
            "status_code", "ip_address", "user_agent", "created_at",
        ]
        read_only_fields = fields


class ErrorLogEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ErrorLogEntry
        fields = [
            "id", "username", "method", "path", "exception_type", "message",
            "traceback", "ip_address", "user_agent", "created_at",
        ]
        read_only_fields = fields
