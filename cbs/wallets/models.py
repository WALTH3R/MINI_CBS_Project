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
