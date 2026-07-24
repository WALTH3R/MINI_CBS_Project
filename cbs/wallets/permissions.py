from rest_framework.permissions import BasePermission

class IsClient(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "CLIENT"

class IsAgent(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "AGENT"

class IsWalletOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.client_id == request.user.id