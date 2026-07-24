from django.contrib import admin

from .models import Merchant, Transaction


@admin.register(Merchant)
class MerchantAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "wallet", "is_active", "created_at")
    search_fields = ("name", "wallet__tag", "owner__username")
    list_filter = ("is_active",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("reference", "type", "from_wallet", "to_wallet", "amount", "performed_by", "created_at")
    list_filter = ("type",)
    search_fields = ("reference", "from_wallet__tag", "to_wallet__tag", "performed_by__username")
