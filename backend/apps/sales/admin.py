from django.contrib import admin

from .models import CashRegisterSession, Sale, SaleItem


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "branch",
        "cashier_id",
        "status",
        "payment_method",
        "total",
        "cash_received",
        "cash_change",
        "sold_at",
    )
    list_filter = ("status", "payment_method", "branch")
    search_fields = ("id",)
    inlines = [SaleItemInline]


@admin.register(CashRegisterSession)
class CashRegisterSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "branch",
        "cashier",
        "business_date",
        "status",
        "opening_amount",
        "closing_amount",
        "opened_at",
        "closed_at",
    )
    list_filter = ("status", "branch", "business_date")
    search_fields = ("cashier__username", "cashier__first_name", "cashier__last_name")
