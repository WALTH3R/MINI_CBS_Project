from django.contrib import admin

from .models import Wallet, WalletProfile


@admin.register(WalletProfile)
class WalletProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "currency", "max_balance", "max_transfer_amount", "max_daily_transfer_total", "max_deposit_amount")
    list_filter = ("currency",)


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("tag", "client", "profile", "balance", "created_at")
    search_fields = ("tag", "client__username")
    list_filter = ("profile",)
