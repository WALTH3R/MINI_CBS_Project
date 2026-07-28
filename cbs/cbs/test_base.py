from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import CustomerProfile, Role
from merchants.models import Merchant
from wallets.models import Wallet, WalletProfile

User = get_user_model()


class BaseAPITestCase(APITestCase):
    

    def make_admin(self, username="admin"):
        return User.objects.create_superuser(username=username, password="pass12345", email="")

    def make_agent(self, username="agent"):
        return User.objects.create_user(username=username, password="pass12345", role=Role.AGENT)

    def make_wallet_profile(self, name="Standard", currency="EUR", **overrides):
        defaults = dict(
            name=name, currency=currency,
            max_balance=Decimal("1000000"), max_transfer_amount=Decimal("500000"),
            max_daily_transfer_total=Decimal("1000000"), max_deposit_amount=Decimal("500000"),
        )
        defaults.update(overrides)
        return WalletProfile.objects.create(**defaults)

    def make_customer(self, username, wallet_profile, **overrides):
        user = User.objects.create_user(username=username, password="pass12345", role=Role.CLIENT)
        tag = overrides.pop("tag", f"{username}.tag")
        defaults = dict(
            parent_name="Parent", date_of_birth="1990-01-01", marital_status="SINGLE",
            place_of_birth="Kinshasa", national_id_number=f"NID-{username}",
        )
        defaults.update(overrides)
        profile = CustomerProfile.objects.create(user=user, tag=tag, **defaults)
        wallet = Wallet.objects.create(client=user, profile=wallet_profile, tag=tag)
        return user, profile, wallet

    def make_merchant(self, name, owner, wallet_profile, tag=None):
        tag = tag or f"{name.lower()}.tag"
        wallet = Wallet.objects.create(client=owner, profile=wallet_profile, tag=tag)
        return Merchant.objects.create(name=name, owner=owner, wallet=wallet)

    def auth_as(self, user):
        self.client.force_authenticate(user=user)
