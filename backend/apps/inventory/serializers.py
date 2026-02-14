from __future__ import annotations

from rest_framework import serializers
from .models import Product, Stock, StockMovement


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = "__all__"


class StockSerializer(serializers.ModelSerializer):
    # Para que la UI pueda mostrar datos del producto sin 2 llamadas extra
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = Stock
        fields = [
            "id",
            "branch",
            "product",
            "product_sku",
            "product_name",
            "qty_on_hand",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class StockMovementSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "branch",
            "product",
            "product_sku",
            "product_name",
            "type",
            "qty",
            "unit_cost",
            "reference_type",
            "reference_id",
            "note",
            "created_at",
        ]
        read_only_fields = fields
