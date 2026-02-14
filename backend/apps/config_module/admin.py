from django.contrib import admin
from .models import CompanySettings


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = (
        "company",
        "currency_code",
        "currency_symbol",
        "tax_rate",
        "money_rounding",
        "sale_void_window_minutes",
        "is_active",
    )
    search_fields = ("company__name", "currency_code")
    list_filter = ("is_active", "currency_code")
