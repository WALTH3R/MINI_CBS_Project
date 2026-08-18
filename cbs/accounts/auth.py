from django.contrib.auth import get_user_model
from rest_framework import exceptions
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SignupStatus

User = get_user_model()


class RoleTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["username"] = user.username
        token["is_staff"] = user.is_staff
        return token

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except exceptions.AuthenticationFailed:
            self._raise_for_pending_or_denied_signup(attrs)
            raise

    def _raise_for_pending_or_denied_signup(self, attrs):
        """Only reveals a pending/denied status once the submitted password checks out — a
        wrong-password guess still gets the generic error, so this can't be used to enumerate
        usernames or their approval status."""
        try:
            user = User.objects.get(username=attrs[self.username_field])
        except User.DoesNotExist:
            return
        if user.is_active or not user.check_password(attrs["password"]):
            return

        profile = getattr(user, "customer_profile", None)
        if profile is None:
            return
        if profile.status == SignupStatus.PENDING:
            raise exceptions.AuthenticationFailed("Your account is pending admin approval.", "account_pending")
        if profile.status == SignupStatus.DENIED:
            raise exceptions.AuthenticationFailed("Your account creation request was denied.", "account_denied")


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role          # custom claim
    return {"refresh": str(refresh), "access": str(refresh.access_token)}