import json

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from .models import IdempotencyKey


def idempotent_create(request, create_fn):
    """Wraps a DRF create() call so a repeated POST carrying the same Idempotency-Key header
    replays the first successful response instead of re-executing the mutation. Only successful
    (2xx) attempts are cached — a failed attempt didn't change anything, so the key is released
    to allow a retry once the request is fixed."""
    key = request.headers.get("Idempotency-Key")
    if not key:
        raise ValidationError({"Idempotency-Key": "This header is required."})

    record, created = IdempotencyKey.objects.get_or_create(user=request.user, key=key, path=request.path)
    if not created:
        if record.response_status is not None:
            return Response(record.response_body, status=record.response_status)
        return Response(
            {"detail": "This request is already being processed. Wait, or retry with a new Idempotency-Key."},
            status=status.HTTP_409_CONFLICT,
        )

    try:
        response = create_fn()
    except Exception:
        record.delete()
        raise

    # response.data holds pre-render Python objects (Decimal, UUID, ...) that plain JSON can't
    # encode — round-trip through DRF's own renderer so what's stored is exactly what the first
    # response actually sent over the wire, and safe for JSONField to persist as-is.
    record.response_status = response.status_code
    record.response_body = json.loads(JSONRenderer().render(response.data))
    record.save(update_fields=["response_status", "response_body"])
    return response
