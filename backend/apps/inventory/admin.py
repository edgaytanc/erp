from django.contrib import admin

from .models import Category, Product, Stock, StockMovement


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "parent__name")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "category", "sale_price", "cost_price", "min_stock", "is_active")
    list_filter = ("is_active", "category")
    search_fields = ("sku", "barcode", "name")


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ("branch", "product", "qty_on_hand", "updated_at")
    list_filter = ("branch",)
    search_fields = ("product__sku", "product__name")


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "branch",
        "product",
        "type",
        "qty",
        "reference_type",
        "reference_id",
        "stock_before",
        "stock_after",
        "created_by",
    )
    list_filter = ("type", "reference_type", "branch")
    search_fields = ("product__sku", "product__name", "reference_id", "note")