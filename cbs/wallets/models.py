from django.db import models


class WalletProfile(models.Model):
    name = models.CharField(max_length=50)          
    max_balance = models.DecimalField(max_digits=12, decimal_places=2)
    max_transfer_amount = models.DecimalField(max_digits=12, decimal_places=2)
    max_daily_transfer_total = models.DecimalField(max_digits=12, decimal_places=2)
    max_deposit_amount = models.DecimalField(max_digits=12, decimal_places=2)


class Wallet(models.Model):
    client = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="wallets")
    profile = models.ForeignKey(WalletProfile, on_delete=models.PROTECT)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="EUR")
    tag = models.CharField(max_length=30, unique=True)   
    created_at = models.DateTimeField(auto_now_add=True)
