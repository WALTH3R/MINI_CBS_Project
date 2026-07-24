from decimal import Decimal

from rest_framework import serializers

from accounts.models import Role
from merchants.models import Transaction
from .models import Wallet, WalletProfile
from .services import do_deposit, do_pay_merchant, do_transfer, resolve_merchant_by_tag, resolve_wallet_by_tag


class WalletProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletProfile
        fields = [
            "id", "name", "currency", "max_balance", "max_transfer_amount",
            "max_daily_transfer_total", "max_deposit_amount",
        ]


class WalletSerializer(serializers.ModelSerializer):
    client = serializers.CharField(source="client.username", read_only=True)
    profile = WalletProfileSerializer(read_only=True)

    class Meta:
        model = Wallet
        fields = ["id", "client", "profile", "tag", "balance", "created_at"]
        read_only_fields = fields


class WalletBalanceSerializer(serializers.ModelSerializer):
    currency = serializers.CharField(source="profile.currency", read_only=True)

    class Meta:
        model = Wallet
        fields = ["id", "tag", "balance", "currency"]
        read_only_fields = fields


class DepositSerializer(serializers.ModelSerializer):
    currency = serializers.CharField(source="to_wallet.profile.currency", read_only=True)
    performed_by = serializers.CharField(source="performed_by.username", read_only=True)

    class Meta:
        model = Transaction
        fields = ["id", "reference", "amount", "currency", "performed_by", "created_at"]
        read_only_fields = fields


class DepositCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    id = serializers.UUIDField(read_only=True)
    reference = serializers.CharField(read_only=True)
    currency = serializers.CharField(source="to_wallet.profile.currency", read_only=True)
    performed_by = serializers.CharField(source="performed_by.username", read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def create(self, validated_data):
        wallet = self.context["wallet"]
        performed_by = self.context["request"].user
        return do_deposit(wallet, validated_data["amount"], performed_by)


class TransferSerializer(serializers.ModelSerializer):
    from_wallet = serializers.CharField(source="from_wallet.tag", read_only=True)
    to_wallet = serializers.CharField(source="to_wallet.tag", read_only=True)
    currency = serializers.CharField(source="from_wallet.profile.currency", read_only=True)
    performed_by = serializers.SerializerMethodField()
    direction = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id", "reference", "direction", "from_wallet", "to_wallet",
            "amount", "currency", "performed_by", "created_at",
        ]
        read_only_fields = fields

    def get_direction(self, obj):
        wallet = self.context.get("wallet")
        return "CREDIT" if wallet and obj.to_wallet_id == wallet.id else "DEBIT"

    def get_performed_by(self, obj):
        return {"user_id": obj.performed_by_id, "type": obj.performed_by.role}


class TransferCreateSerializer(serializers.Serializer):
    to_tag = serializers.CharField(write_only=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    id = serializers.UUIDField(read_only=True)
    reference = serializers.CharField(read_only=True)
    from_wallet = serializers.CharField(source="from_wallet.tag", read_only=True)
    to_wallet = serializers.CharField(source="to_wallet.tag", read_only=True)
    currency = serializers.CharField(source="from_wallet.profile.currency", read_only=True)
    performed_by = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)

    def get_performed_by(self, obj):
        return {"user_id": obj.performed_by_id, "type": obj.performed_by.role}

    def validate(self, attrs):
        from_wallet = self.context["wallet"]
        try:
            to_wallet = resolve_wallet_by_tag(attrs["to_tag"])
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({"to_tag": exc.detail})

        if to_wallet.id == from_wallet.id:
            raise serializers.ValidationError({"to_tag": "Cannot transfer to your own wallet."})
        if to_wallet.client.role != Role.CLIENT:
            raise serializers.ValidationError({"to_tag": "Recipient tag does not belong to a customer wallet."})

        attrs["to_wallet"] = to_wallet
        return attrs

    def create(self, validated_data):
        from_wallet = self.context["wallet"]
        to_wallet = validated_data["to_wallet"]
        performed_by = self.context["request"].user
        return do_transfer(from_wallet, to_wallet, validated_data["amount"], performed_by)


class PaymentSerializer(serializers.ModelSerializer):
    from_wallet = serializers.CharField(source="from_wallet.tag", read_only=True)
    merchant = serializers.CharField(source="to_wallet.merchant.name", read_only=True)
    performed_by = serializers.CharField(source="performed_by.username", read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id", "reference", "status", "failure_reason", "from_wallet",
            "merchant", "amount", "performed_by", "created_at",
        ]
        read_only_fields = fields


class PaymentCreateSerializer(serializers.Serializer):
    merchant_tag = serializers.CharField(write_only=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    id = serializers.UUIDField(read_only=True)
    reference = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    failure_reason = serializers.CharField(read_only=True)
    merchant = serializers.CharField(source="to_wallet.merchant.name", read_only=True)
    performed_by = serializers.CharField(source="performed_by.username", read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def validate(self, attrs):
        try:
            merchant = resolve_merchant_by_tag(attrs["merchant_tag"])
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({"merchant_tag": exc.detail})

        attrs["merchant"] = merchant
        return attrs

    def create(self, validated_data):
        from_wallet = self.context["wallet"]
        merchant = validated_data["merchant"]
        performed_by = self.context["request"].user
        return do_pay_merchant(from_wallet, merchant, validated_data["amount"], performed_by)
