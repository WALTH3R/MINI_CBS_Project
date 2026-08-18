import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

class Role(models.TextChoices):
    CLIENT = "CLIENT", "Client"
    AGENT = "AGENT", "Agent"

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=10, choices=Role.choices)


class MaritalStatus(models.TextChoices):
    SINGLE = "SINGLE", "Single"
    MARRIED = "MARRIED", "Married"
    DIVORCED = "DIVORCED", "Divorced"
    WIDOWED = "WIDOWED", "Widowed"


class SignupStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    DENIED = "DENIED", "Denied"


class CustomerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="customer_profile",
        limit_choices_to={"role": Role.CLIENT},
    )
    parent_name = models.CharField(max_length=150)
    date_of_birth = models.DateField()
    marital_status = models.CharField(max_length=10, choices=MaritalStatus.choices)
    place_of_birth = models.CharField(max_length=100)
    national_id_number = models.CharField(max_length=50, unique=True)
    tag = models.CharField(max_length=30, unique=True)
    # Agent-enrolled customers are approved outright (the default); only a public self-registration
    # (see accounts/serializers.py:PublicSignupSerializer) starts out PENDING.
    status = models.CharField(max_length=10, choices=SignupStatus.choices, default=SignupStatus.APPROVED)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.last_name} {self.user.first_name}"