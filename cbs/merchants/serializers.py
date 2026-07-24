from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from accounts.models import Role
from wallets.models import Wallet, WalletProfile
from wallets.services import generate_unique_tag
from .models import Merchant, Transaction

User = get_user_model()


class MerchantSerializer(serializers.ModelSerializer):
    owner = serializers.CharField(source="owner.username", read_only=True)
    wallet_tag = serializers.CharField(source="wallet.tag", read_only=True)

    class Meta:
        model = Merchant
        fields = ["id", "name", "owner", "wallet_tag", "is_active", "created_at"]
        read_only_fields = fields


class MerchantCreateSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role=Role.AGENT))
    wallet_profile_id = serializers.PrimaryKeyRelatedField(queryset=WalletProfile.objects.all(), write_only=True)
    tag = serializers.CharField(source="wallet.tag", read_only=True)

    class Meta:
        model = Merchant
        fields = ["id", "name", "owner", "wallet_profile_id", "tag"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        wallet_profile = validated_data.pop("wallet_profile_id")
        tag = generate_unique_tag(validated_data["name"])
        with transaction.atomic():
            wallet = Wallet.objects.create(client=validated_data["owner"], profile=wallet_profile, tag=tag)
            return Merchant.objects.create(wallet=wallet, **validated_data)


class MerchantUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Merchant
        fields = ["name", "is_active"]


class MerchantPaymentSerializer(serializers.ModelSerializer):
    from_wallet = serializers.CharField(source="from_wallet.tag", read_only=True)
    payer = serializers.CharField(source="from_wallet.client.username", read_only=True)
    performed_by = serializers.CharField(source="performed_by.username", read_only=True)

    class Meta:
        model = Transaction
        fields = ["id", "reference", "from_wallet", "payer", "amount", "performed_by", "created_at"]
        read_only_fields = fields
