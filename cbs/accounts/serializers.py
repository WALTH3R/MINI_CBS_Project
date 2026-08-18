from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from merchants.models import Transaction
from wallets.models import Wallet, WalletProfile
from wallets.services import generate_unique_tag
from .models import CustomerProfile, Role, SignupStatus

User = get_user_model()


class CustomerProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    name = serializers.CharField(source="user.last_name", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)
    wallets = serializers.SerializerMethodField()

    class Meta:
        model = CustomerProfile
        fields = [
            "id", "username", "name", "first_name", "parent_name",
            "date_of_birth", "marital_status", "place_of_birth",
            "national_id_number", "tag", "status", "is_active", "wallets", "created_at",
        ]
        read_only_fields = fields

    def get_wallets(self, obj):
        wallets = obj.user.wallets.select_related("profile").order_by("created_at")
        return [
            {
                "id": str(wallet.id),
                "tag": wallet.tag,
                "balance": str(wallet.balance),
                "currency": wallet.profile.currency,
            }
            for wallet in wallets
        ]


class CustomerStatusUpdateSerializer(serializers.Serializer):
    """`instance` here is the CustomerProfile — the flag itself lives on the related User."""
    is_active = serializers.BooleanField()

    def update(self, instance, validated_data):
        instance.user.is_active = validated_data["is_active"]
        instance.user.save(update_fields=["is_active"])
        return instance


class CustomerCreateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    name = serializers.CharField(source="user.last_name", max_length=150)
    first_name = serializers.CharField(source="user.first_name", max_length=150)
    wallet_profile_id = serializers.PrimaryKeyRelatedField(
        queryset=WalletProfile.objects.all(), write_only=True
    )

    class Meta:
        model = CustomerProfile
        fields = [
            "id", "username", "password", "name", "first_name", "parent_name",
            "date_of_birth", "marital_status", "place_of_birth",
            "national_id_number", "tag", "wallet_profile_id",
        ]
        read_only_fields = ["id", "tag"]

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def create(self, validated_data):
        user_data = validated_data.pop("user")
        username = validated_data.pop("username")
        password = validated_data.pop("password")
        wallet_profile = validated_data.pop("wallet_profile_id")

        with transaction.atomic():
            user = User(username=username, role=Role.CLIENT, **user_data)
            user.set_password(password)
            user.save()

            tag = generate_unique_tag(username)
            customer = CustomerProfile.objects.create(user=user, tag=tag, **validated_data)
            Wallet.objects.create(client=user, profile=wallet_profile, tag=tag)

        return customer


class PublicSignupSerializer(serializers.ModelSerializer):
    """Public, unauthenticated self-registration — same personal fields an agent fills in via
    CustomerCreateSerializer, minus wallet_profile_id (that's a back-office decision, made by
    the admin at approval time in SignupApprovalSerializer, not by the applicant). Creates the
    User inactive and the CustomerProfile PENDING; neither is usable until an admin approves."""

    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    name = serializers.CharField(source="user.last_name", max_length=150)
    first_name = serializers.CharField(source="user.first_name", max_length=150)

    class Meta:
        model = CustomerProfile
        fields = [
            "id", "username", "password", "name", "first_name", "parent_name",
            "date_of_birth", "marital_status", "place_of_birth", "national_id_number",
        ]
        read_only_fields = ["id"]

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def create(self, validated_data):
        user_data = validated_data.pop("user")
        username = validated_data.pop("username")
        password = validated_data.pop("password")

        with transaction.atomic():
            user = User(username=username, role=Role.CLIENT, is_active=False, **user_data)
            user.set_password(password)
            user.save()

            tag = generate_unique_tag(username)
            customer = CustomerProfile.objects.create(
                user=user, tag=tag, status=SignupStatus.PENDING, **validated_data
            )

        return customer


class SignupApprovalSerializer(serializers.Serializer):
    wallet_profile_id = serializers.PrimaryKeyRelatedField(queryset=WalletProfile.objects.all())


class AgentCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["id", "username", "password", "first_name", "last_name", "is_active"]
        read_only_fields = ["id", "is_active"]

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(role=Role.AGENT, **validated_data)
        user.set_password(password)
        user.save()
        return user


class AgentStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["is_active"]


class TransactionSerializer(serializers.ModelSerializer):
    from_wallet = serializers.SerializerMethodField()
    to_wallet = serializers.CharField(source="to_wallet.tag", read_only=True)
    performed_by = serializers.CharField(source="performed_by.username", read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id", "reference", "type", "status", "failure_reason", "from_wallet", "to_wallet",
            "amount", "performed_by", "created_at",
        ]
        read_only_fields = fields

    def get_from_wallet(self, obj):
        return obj.from_wallet.tag if obj.from_wallet_id else None
