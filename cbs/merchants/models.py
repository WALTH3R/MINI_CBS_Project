import uuid

from django.db import models
from wallets.models import Wallet


class Merchant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    owner = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="merchants")
    wallet = models.OneToOneField(Wallet, on_delete=models.PROTECT, related_name="merchant")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)



class Transaction(models.Model):
    class Type(models.TextChoices):
        DEPOSIT = "DEPOSIT", "Deposit"
        TRANSFER = "TRANSFER", "Transfer"
        PAYMENT = "PAYMENT", "Merchant payment"

    class Status(models.TextChoices):
        COMPLETED = "COMPLETED", "Completed"
        PENDING = "PENDING", "Pending"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=20, unique=True, editable=False)
    type = models.CharField(max_length=10, choices=Type.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.COMPLETED)
    failure_reason = models.CharField(max_length=255, blank=True, default="")
    from_wallet = models.ForeignKey(Wallet, null=True, blank=True, on_delete=models.PROTECT, related_name="outgoing")
    to_wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="incoming")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    performed_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)