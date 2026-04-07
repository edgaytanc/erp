from __future__ import annotations

from rest_framework import serializers

from .models import Category, Product, Stock, StockMovement


class CategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    children_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "parent",
            "parent_name",
            "children_count",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "children_count", "parent_name"]

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        parent = attrs.get("parent", instance.parent if instance else None)

        if instance and parent and parent.id == instance.id:
            raise serializers.ValidationError({"parent": "Una categoría no puede ser su propio padre."})

        current = parent
        while current is not None:
            if instance and current.id == instance.id:
                raise serializers.ValidationError({"parent": "No se permite crear ciclos entre categorías."})
            current = current.parent

        return attrs


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "category",
            "category_name",
            "sku",
            "barcode",
            "name",
            "description",
            "sale_price",
            "cost_price",
            "min_stock",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "category_name"]

    def validate_sku(self, value: str) -> str:
        return value.strip().upper()

    def validate_barcode(self, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        return value.strip()

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre del producto es requerido.")
        return value


class StockSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_min_stock = serializers.DecimalField(
        source="product.min_stock",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    is_below_min_stock = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = [
            "id",
            "branch",
            "product",
            "product_sku",
            "product_name",
            "product_min_stock",
            "qty_on_hand",
            "is_below_min_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_is_below_min_stock(self, obj: Stock) -> bool:
        return obj.qty_on_hand <= obj.product.min_stock


class StockMovementSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "branch",
            "branch_name",
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