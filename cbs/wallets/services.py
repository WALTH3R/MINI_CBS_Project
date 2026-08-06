# used when an operation involves multiple steps
import random
import re
import string
from decimal import Decimal
from django.db import models
from django.db import transaction as db_transaction
from rest_framework.exceptions import ValidationError
from django.utils import timezone

from .models import Wallet
from merchants.models import Merchant, Transaction

def _lock_wallets(*wallets):
    """Row-locks the given wallets for the rest of the current atomic block, always in a fixed
    order (by id) regardless of the order they're passed in — otherwise two concurrent operations
    on the same pair of wallets could lock them in opposite order and deadlock. Must be called
    inside db_transaction.atomic(). Returns fresh, locked instances (never the stale ones passed
    in) so every balance-dependent check that follows sees the true current balance."""
    by_id = {
        w.id: w for w in
        Wallet.objects.select_for_update().select_related("profile").filter(
            id__in=sorted(w.id for w in wallets)
        )
    }
    return [by_id[w.id] for w in wallets]


def do_transfer(from_wallet, to_wallet, amount: Decimal, performed_by):
    if from_wallet.profile.currency != to_wallet.profile.currency:
        raise ValidationError("Cannot transfer between wallets with different currencies.")

    with db_transaction.atomic():
        from_wallet, to_wallet = _lock_wallets(from_wallet, to_wallet)
        profile = from_wallet.profile

        if amount > profile.max_transfer_amount:
            raise ValidationError("Amount exceeds this wallet's max transfer limit.")
        if from_wallet.balance < amount:
            raise ValidationError("Insufficient balance.")
        if to_wallet.balance + amount > to_wallet.profile.max_balance:
            raise ValidationError("Destination wallet would exceed its max balance.")

        # Locking from_wallet above also serializes this: a concurrent transfer from the same
        # wallet can't run until this one commits, so this total is never computed from stale data.
        today_total = Transaction.objects.filter(
            from_wallet=from_wallet, type="TRANSFER", created_at__date=timezone.now().date()
        ).aggregate(total=models.Sum("amount"))["total"] or Decimal("0")
        if today_total + amount > profile.max_daily_transfer_total:
            raise ValidationError("Daily transfer limit exceeded.")

        from_wallet.balance -= amount
        to_wallet.balance += amount
        from_wallet.save()
        to_wallet.save()
        return Transaction.objects.create(
            reference=generate_transaction_reference("TRANSFER"),
            type="TRANSFER", from_wallet=from_wallet, to_wallet=to_wallet,
            amount=amount, performed_by=performed_by,
        )

def do_deposit(to_wallet, amount: Decimal, performed_by):
    with db_transaction.atomic():
        (to_wallet,) = _lock_wallets(to_wallet)
        profile = to_wallet.profile

        if amount > profile.max_deposit_amount:
            raise ValidationError("Amount exceeds max deposit limit.")
        if to_wallet.balance + amount > profile.max_balance:
            raise ValidationError("Wallet would exceed max balance.")

        to_wallet.balance += amount
        to_wallet.save()
        return Transaction.objects.create(
            reference=generate_transaction_reference("DEPOSIT"),
            type="DEPOSIT", from_wallet=None, to_wallet=to_wallet,
            amount=amount, performed_by=performed_by,
        )


def do_pay_merchant(from_wallet, merchant, amount: Decimal, performed_by):
    to_wallet = merchant.wallet
    reference = generate_transaction_reference("PAYMENT")

    def declined(reason):
        return Transaction.objects.create(
            reference=reference, type="PAYMENT", status=Transaction.Status.FAILED,
            failure_reason=reason, from_wallet=from_wallet, to_wallet=to_wallet,
            amount=amount, performed_by=performed_by,
        )

    if not merchant.is_active:
        return declined("This merchant account is not active.")

    with db_transaction.atomic():
        from_wallet, to_wallet = _lock_wallets(from_wallet, to_wallet)
        profile = from_wallet.profile

        if amount > profile.max_transfer_amount:
            return declined("Amount exceeds this wallet's max transfer limit.")
        if from_wallet.balance < amount:
            return declined("Insufficient balance.")
        if to_wallet.balance + amount > to_wallet.profile.max_balance:
            return declined("Merchant wallet would exceed its max balance.")

        from_wallet.balance -= amount
        to_wallet.balance += amount
        from_wallet.save()
        to_wallet.save()
        return Transaction.objects.create(
            reference=reference,
            type="PAYMENT", from_wallet=from_wallet, to_wallet=to_wallet,
            amount=amount, performed_by=performed_by,
        )

def resolve_wallet_by_tag(tag: str) -> Wallet:
    try:
        return Wallet.objects.get(tag=tag)
    except Wallet.DoesNotExist:
        raise ValidationError("No wallet found for this tag.")

def resolve_merchant_by_tag(tag: str) -> Merchant:
    try:
        return Merchant.objects.get(wallet__tag=tag)
    except Merchant.DoesNotExist:
        raise ValidationError("No merchant found for this tag.")

def generate_unique_tag(base: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", ".", base.lower()).strip(".") or "user"
    for _ in range(20):
        candidate = f"{slug}.{random.randint(1000, 9999)}"
        if not Wallet.objects.filter(tag=candidate).exists():
            return candidate
    raise ValidationError("Could not generate a unique tag, please try again.")

_REFERENCE_PREFIXES = {"DEPOSIT": "DEP", "TRANSFER": "TRF", "PAYMENT": "PAY"}



def generate_transaction_reference(type_: str) -> str:
    prefix = _REFERENCE_PREFIXES.get(type_, "TXN")
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(20):
        candidate = f"{prefix}-{''.join(random.choices(alphabet, k=10))}"
        if not Transaction.objects.filter(reference=candidate).exists():
            return candidate
    raise ValidationError("Could not generate a unique transaction reference, please try again.")
