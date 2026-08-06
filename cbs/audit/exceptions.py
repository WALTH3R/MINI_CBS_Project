import logging
import traceback as tb_module

from rest_framework.views import exception_handler as default_exception_handler

from .middleware import _client_ip
from .models import ErrorLogEntry

logger = logging.getLogger(__name__)


def error_monitoring_exception_handler(exc, context):
    """Wraps DRF's default handler. When it returns None — an exception it doesn't recognize as
    an APIException/Http404/PermissionDenied, i.e. a genuine unhandled 500 — records it here as a
    side effect, then returns None unchanged so DRF re-raises and Django's normal error handling
    (the DEBUG traceback page locally, a generic 500 in production) proceeds exactly as before."""
    response = default_exception_handler(exc, context)

    if response is None:
        request = context["request"]
        user = getattr(request, "user", None)
        is_authenticated = bool(user and user.is_authenticated)

        try:
            ErrorLogEntry.objects.create(
                method=request.method,
                path=request.path,
                exception_type=type(exc).__name__,
                message=str(exc),
                traceback=tb_module.format_exc(),
                user=user if is_authenticated else None,
                username=user.username if is_authenticated else "",
                ip_address=_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
            )
        except Exception:
            logger.warning("Failed to write error log entry for %s %s", request.method, request.path, exc_info=True)

    return response
