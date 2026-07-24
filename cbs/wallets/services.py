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

def do_transfer(from_wallet, to_wallet, amount: Decimal, performed_by):
    profile = from_wallet.profile

    if from_wallet.profile.currency != to_wallet.profile.currency:
        raise ValidationError("Cannot transfer between wallets with different currencies.")
    if amount > profile.max_transfer_amount:
        raise ValidationError("Amount exceeds this wallet's max transfer limit.")
    if from_wallet.balance < amount:
        raise ValidationError("Insufficient balance.")
    if to_wallet.balance + amount > to_wallet.profile.max_balance:
        raise ValidationError("Destination wallet would exceed its max balance.")

    # daily limit check
    today_total = Transaction.objects.filter(
        from_wallet=from_wallet, type="TRANSFER", created_at__date=timezone.now().date()
    ).aggregate(total=models.Sum("amount"))["total"] or Decimal("0")
    if today_total + amount > profile.max_daily_transfer_total:
        raise ValidationError("Daily transfer limit exceeded.")

    with db_transaction.atomic():
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
    profile = to_wallet.profile
    if amount > profile.max_deposit_amount:
        raise ValidationError("Amount exceeds max deposit limit.")
    if to_wallet.balance + amount > profile.max_balance:
        raise ValidationError("Wallet would exceed max balance.")

    with db_transaction.atomic():
        to_wallet.balance += amount
        to_wallet.save()
        return Transaction.objects.create(
            reference=generate_transaction_reference("DEPOSIT"),
            type="DEPOSIT", from_wallet=None, to_wallet=to_wallet,
            amount=amount, performed_by=performed_by,
        )


def do_pay_merchant(from_wallet, merchant, amount: Decimal, performed_by):
    if not merchant.is_active:
        raise ValidationError("This merchant account is not active.")

    profile = from_wallet.profile
    to_wallet = merchant.wallet

    if amount > profile.max_transfer_amount:
        raise ValidationError("Amount exceeds this wallet's max transfer limit.")
    if from_wallet.balance < amount:
        raise ValidationError("Insufficient balance.")
    
    if to_wallet.balance + amount > to_wallet.profile.max_balance:
        raise ValidationError("Merchant wallet would exceed its max balance.")

    with db_transaction.atomic():
        from_wallet.balance -= amount
        to_wallet.balance += amount
        from_wallet.save()
        to_wallet.save()
        return Transaction.objects.create(
            reference=generate_transaction_reference("PAYMENT"),
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
        return Merchant.objects.get(wallet__tag=tag, is_active=True)
    except Merchant.DoesNotExist:
        raise ValidationError("No active merchant found for this tag.")

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
