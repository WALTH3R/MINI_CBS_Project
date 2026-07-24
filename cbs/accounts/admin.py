from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomerProfile, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Role", {"fields": ("role",)}),
    )
    list_display = ("username", "first_name", "last_name", "role", "is_staff")
    list_filter = UserAdmin.list_filter + ("role",)


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ("tag", "user", "national_id_number", "date_of_birth", "created_at")
    search_fields = ("tag", "national_id_number", "user__username", "user__last_name", "user__first_name")
