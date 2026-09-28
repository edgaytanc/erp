from __future__ import annotations

from rest_framework import serializers

from .models import Category, Product, ProductBenefit, SkinType, Stock, StockMovement, TargetProblem


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
    needs_pricing = serializers.BooleanField(read_only=True)
    skin_type_display = serializers.CharField(source="get_skin_type_display", read_only=True)
    target_problems_display = serializers.SerializerMethodField()
    benefits_display = serializers.SerializerMethodField()

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
            "needs_pricing",
            "skin_type",
            "skin_type_display",
            "target_problems",
            "target_problems_display",
            "benefits",
            "benefits_display",
            "keywords",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "category_name",
            "needs_pricing",
            "skin_type_display",
            "target_problems_display",
            "benefits_display",
        ]
        extra_kwargs = {
            "sku": {"required": False, "allow_blank": True},
            "skin_type": {"required": False, "allow_blank": True},
            "target_problems": {"required": False},
            "benefits": {"required": False},
            "keywords": {"required": False, "allow_blank": True},
            "description": {"required": False, "allow_blank": True},
        }

    def get_target_problems_display(self, obj: Product) -> list[str]:
        mapping = dict(TargetProblem.choices)
        return [mapping.get(p, p) for p in (obj.target_problems or [])]

    def get_benefits_display(self, obj: Product) -> list[str]:
        mapping = dict(ProductBenefit.choices)
        return [mapping.get(b, b) for b in (obj.benefits or [])]

    def validate_sku(self, value: str | None) -> str:
        if value:
            return value.strip().upper()
        return ""

    def validate_barcode(self, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        return value.strip()

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre del producto es requerido.")
        return value


class ProductRecommendationSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(source="sale_price", max_digits=12, decimal_places=2, read_only=True)
    stock = serializers.DecimalField(source="stock_qty", max_digits=14, decimal_places=2, read_only=True)
    main_benefit = serializers.SerializerMethodField()
    benefits_display = serializers.SerializerMethodField()
    target_problems_display = serializers.SerializerMethodField()
    skin_type_display = serializers.CharField(source="get_skin_type_display", read_only=True)
    rank = serializers.FloatField(read_only=True, default=0.0)

    class Meta:
        model = Product
        fields = [
            "id",
            "sku",
            "barcode",
            "name",
            "description",
            "price",
            "sale_price",
            "stock",
            "skin_type",
            "skin_type_display",
            "target_problems",
            "target_problems_display",
            "benefits",
            "benefits_display",
            "main_benefit",
            "keywords",
            "rank",
        ]

    def get_main_benefit(self, obj: Product) -> str:
        if obj.benefits:
            mapping = dict(ProductBenefit.choices)
            return mapping.get(obj.benefits[0], obj.benefits[0])
        return ""

    def get_benefits_display(self, obj: Product) -> list[str]:
        mapping = dict(ProductBenefit.choices)
        return [mapping.get(b, b) for b in (obj.benefits or [])]

    def get_target_problems_display(self, obj: Product) -> list[str]:
        mapping = dict(TargetProblem.choices)
        return [mapping.get(p, p) for p in (obj.target_problems or [])]


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
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

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
            "stock_before",
            "stock_after",
            "reference_type",
            "reference_id",
            "unit_cost",
            "created_by",
            "created_by_username",
            "note",
            "created_at",
        ]
        read_only_fields = fields