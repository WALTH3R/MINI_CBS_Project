import uuid

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError


def parse_uuid(value):
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        raise ValidationError("Invalid id format.")


def get_object_or_400(model, pk):
    parse_uuid(pk)
    return get_object_or_404(model, pk=pk)


class ValidatedUUIDLookupMixin:
    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        parse_uuid(self.kwargs[lookup_url_kwarg])
        return super().get_object()
