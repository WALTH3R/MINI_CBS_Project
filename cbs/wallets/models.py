import uuid

from django.db import models


class WalletProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    currency = models.CharField(max_length=3, default="EUR")
    max_balance = models.DecimalField(max_digits=12, decimal_places=2)
    max_transfer_amount = models.DecimalField(max_digits=12, decimal_places=2)
    max_daily_transfer_total = models.DecimalField(max_digits=12, decimal_places=2)
    max_deposit_amount = models.DecimalField(max_digits=12, decimal_places=2)


class Wallet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="wallets")
    profile = models.ForeignKey(WalletProfile, on_delete=models.PROTECT)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tag = models.CharField(max_length=30, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class WalletCreationRequest(models.Model):
    
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        DECLINED = "DECLINED", "Declined"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="wallet_requests")
    wallet_profile = models.ForeignKey(WalletProfile, on_delete=models.PROTECT)
    requested_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="wallet_requests_made")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    wallet = models.OneToOneField(Wallet, on_delete=models.SET_NULL, null=True, blank=True, related_name="creation_request")
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)
