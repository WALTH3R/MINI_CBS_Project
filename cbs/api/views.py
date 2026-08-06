import time
from datetime import timedelta

import django
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from accounts.models import Role
from audit.models import AuditLogEntry
from merchants.models import Transaction
from wallets.models import Wallet, WalletCreationRequest

User = get_user_model()


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'is_staff': user.is_staff,
        })


class HealthCheckView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        db_status, db_latency_ms = self._check_database()
        one_hour_ago = timezone.now() - timedelta(hours=1)
        day_ago = timezone.now() - timedelta(hours=24)
        recent = AuditLogEntry.objects.filter(created_at__gte=one_hour_ago)
        total_requests = recent.count()
        error_requests = recent.filter(status_code__gte=400).count()

        return Response({
            "database": {"status": db_status, "latency_ms": db_latency_ms},
            "environment": {
                "debug": settings.DEBUG,
                "django_version": django.get_version(),
                "database_engine": connection.settings_dict["ENGINE"].rsplit(".", 1)[-1],
            },
            "activity_last_hour": {
                "total_requests": total_requests,
                "error_requests": error_requests,
                "error_rate_percent": round(error_requests / total_requests * 100, 1) if total_requests else 0,
            },
            "business": {
                "active_agents": User.objects.filter(role=Role.AGENT, is_active=True).count(),
                "active_customers": User.objects.filter(role=Role.CLIENT, is_active=True).count(),
                "total_wallets": Wallet.objects.count(),
                "pending_wallet_requests": WalletCreationRequest.objects.filter(
                    status=WalletCreationRequest.Status.PENDING
                ).count(),
                "failed_transactions_last_24h": Transaction.objects.filter(
                    status=Transaction.Status.FAILED, created_at__gte=day_ago
                ).count(),
            },
        })

    def _check_database(self):
        start = time.monotonic()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return "ok", round((time.monotonic() - start) * 1000, 1)
        except Exception:
            return "error", None
