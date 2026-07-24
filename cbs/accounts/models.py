from django.contrib.auth.models import AbstractUser
from django.db import models

class Role(models.TextChoices):
    CLIENT = "CLIENT", "Client"
    AGENT = "AGENT", "Agent"

class User(AbstractUser):
    role = models.CharField(max_length=10, choices=Role.choices)


class MaritalStatus(models.TextChoices):
    SINGLE = "SINGLE", "Single"
    MARRIED = "MARRIED", "Married"
    DIVORCED = "DIVORCED", "Divorced"
    WIDOWED = "WIDOWED", "Widowed"


class CustomerProfile(models.Model):
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
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.last_name} {self.user.first_name}"