from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import CustomerProfile, Role, User
from merchants.models import Merchant
from wallets.models import Wallet, WalletProfile
from wallets.services import do_deposit


class Command(BaseCommand):
    """Seeds demo accounts and starter data for the Docker/security-testing sandbox — never
    intended for a real deployment. Safe to re-run; every step is get-or-create."""

    help = "Seeds demo accounts and sample data for the Docker security-testing sandbox."

    @transaction.atomic
    def handle(self, *args, **options):
        agent = self._get_or_create_user("agent", "AgentPass123!", role=Role.AGENT)
        self._get_or_create_user("admin", "AdminPass123!", is_staff=True, is_superuser=True)

        profile, _ = WalletProfile.objects.get_or_create(
            name="Standard",
            currency="EUR",
            defaults=dict(
                max_balance=Decimal("100000"),
                max_transfer_amount=Decimal("5000"),
                max_daily_transfer_total=Decimal("2000"),
                max_deposit_amount=Decimal("5000"),
            ),
        )

        alice = self._seed_customer("alice", "AlicePass123!", profile, "NID-DEMO-ALICE", "alice.demo")
        bob = self._seed_customer("bob", "BobPass123!", profile, "NID-DEMO-BOB", "bob.demo")

        self._seed_starting_balance(alice, agent, Decimal("500.00"))
        self._seed_starting_balance(bob, agent, Decimal("250.00"))

        if not Merchant.objects.filter(name="ElectricCo").exists():
            merchant_wallet = Wallet.objects.create(client=agent, profile=profile, tag="electricco.demo")
            Merchant.objects.create(
                name="ElectricCo", owner=agent, wallet=merchant_wallet, category=Merchant.Category.UTILITIES,
            )

        self.stdout.write(self.style.SUCCESS(
            "Demo data ready — admin/AdminPass123!, agent/AgentPass123!, "
            "alice/AlicePass123!, bob/BobPass123!"
        ))

    def _get_or_create_user(self, username, password, **fields):
        user, created = User.objects.get_or_create(username=username, defaults=fields)
        if created:
            user.set_password(password)
            user.save()
        return user

    def _seed_customer(self, username, password, profile, national_id, tag):
        user = self._get_or_create_user(username, password, role=Role.CLIENT)
        CustomerProfile.objects.get_or_create(
            user=user,
            defaults=dict(
                parent_name="Parent Demo", date_of_birth="1990-01-01", marital_status="SINGLE",
                place_of_birth="Kinshasa", national_id_number=national_id, tag=tag,
            ),
        )
        Wallet.objects.get_or_create(client=user, profile=profile, defaults=dict(tag=tag))
        return user

    def _seed_starting_balance(self, customer, performed_by, amount):
        wallet = customer.wallets.first()
        if wallet.balance == 0:
            do_deposit(wallet, amount, performed_by)
