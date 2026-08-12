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
    # A customer's own, optional, tighter cap on top of the wallet profile's daily transfer
    # limit. Null means "no personal override — use the profile's limit."
    daily_transfer_limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def effective_daily_transfer_limit(self):
        """The cap actually enforced on this wallet's transfers: the customer's own limit if
        they've set one, clamped to (never above) the wallet profile's limit — so a profile
        limit lowered after the fact still wins."""
        profile_limit = self.profile.max_daily_transfer_total
        if self.daily_transfer_limit is None:
            return profile_limit
        return min(self.daily_transfer_limit, profile_limit)


class IdempotencyKey(models.Model):
    """Lets a client safely retry a POST it's unsure landed (e.g. after a network timeout)
    without the mutation executing twice — see wallets/idempotency.py."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="idempotency_keys")
    key = models.CharField(max_length=255)
    path = models.CharField(max_length=255)
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "key", "path"], name="unique_idempotency_key_per_user_path"),
        ]


class Beneficiary(models.Model):
    """A customer's saved transfer recipient — lets them pick from a list instead of retyping
    the recipient's wallet tag every time."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="beneficiaries")
    target_wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name="beneficiary_of")
    nickname = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["owner", "target_wallet"], name="unique_beneficiary_per_owner_wallet"),
        ]
        ordering = ["nickname"]


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
