import logging
import uuid

from .models import AuditLogEntry

logger = logging.getLogger(__name__)

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _client_ip(request):
    """Mirrors the reverse-proxy trust boundary set via REST_FRAMEWORK['NUM_PROXIES'] = 1 —
    Render appends the real client IP as the last entry in X-Forwarded-For."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[-1].strip()
    return request.META.get("REMOTE_ADDR")


class AuditLogMiddleware:
    """Records every state-changing request (POST/PUT/PATCH/DELETE) — who, what, when, from
    where. Reads request.user *after* get_response() returns: DRF's JWTAuthentication resolves
    the user lazily inside the view, and its Request.user property writes back onto the wrapped
    Django HttpRequest, so it's populated by the time this middleware's own code resumes."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method not in MUTATING_METHODS:
            return self.get_response(request)

        request_id = uuid.uuid4()
        response = self.get_response(request)

        user = getattr(request, "user", None)
        is_authenticated = bool(user and user.is_authenticated)

        try:
            AuditLogEntry.objects.create(
                request_id=request_id,
                user=user if is_authenticated else None,
                username=user.username if is_authenticated else "",
                method=request.method,
                path=request.path,
                status_code=response.status_code,
                ip_address=_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
            )
        except Exception:
            logger.warning("Failed to write audit log entry for %s %s", request.method, request.path, exc_info=True)

        response["X-Request-ID"] = str(request_id)
        return response
