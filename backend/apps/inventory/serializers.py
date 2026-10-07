from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework import serializers

from apps.core.models import Branch
from .models import (
    Category,
    Product,
    ProductBenefit,
    SkinType,
    Stock,
    StockMovement,
    TargetProblem,
)
from .services import initialize_product_stocks


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


class BranchSalePriceField(serializers.DecimalField):
    """
    Campo para el precio de venta de un producto dependiente de la sucursal actual.
    - En lectura: devuelve el sale_price correspondiente a la sucursal del contexto
      (usuario autenticado o query parameter en el request) sin romper clientes de API.
    - En escritura: valida el formato decimal para creación o actualización de precios.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("max_digits", 12)
        kwargs.setdefault("decimal_places", 2)
        kwargs.setdefault("required", False)
        kwargs.setdefault("min_value", Decimal("0.00"))
        super().__init__(**kwargs)

    def get_attribute(self, instance):
        return instance

    def to_representation(self, value):
        if not isinstance(value, Product):
            if value is not None:
                return super().to_representation(value)
            return super().to_representation(Decimal("0.00"))

        product = value

        # 1. Si el producto ya tiene 'sale_price' anotado en el queryset (Subquery)
        annotated_price = getattr(product, "sale_price", None)
        if annotated_price is not None and not callable(annotated_price):
            try:
                return super().to_representation(Decimal(str(annotated_price)))
            except (ValueError, TypeError, InvalidOperation):
                pass

        # 2. Obtener branch_id del contexto del request
        request = self.context.get("request") if self.context else None
        branch_id = None
        if request:
            branch_id = request.query_params.get("branch_id") or request.query_params.get("branch")
            if not branch_id:
                user = getattr(request, "user", None)
                if user and user.is_authenticated:
                    branch_id = getattr(user, "branch_id", None) or (
                        user.branch.id if getattr(user, "branch", None) else None
                    )

        # 3. Si hay branch_id, buscar en stocks prefetched o en DB
        if branch_id:
            if hasattr(product, "prefetched_branch_stocks") and product.prefetched_branch_stocks:
                for stock in product.prefetched_branch_stocks:
                    if str(stock.branch_id) == str(branch_id):
                        return super().to_representation(stock.sale_price)

            if hasattr(product, "_prefetched_objects_cache") and "stocks" in product._prefetched_objects_cache:
                for stock in product._prefetched_objects_cache["stocks"]:
                    if str(stock.branch_id) == str(branch_id):
                        return super().to_representation(stock.sale_price)

            stock = product.stocks.filter(branch_id=branch_id).first()
            if stock and stock.sale_price is not None:
                return super().to_representation(stock.sale_price)

        # 4. Si no se especificó sucursal o no se encontró stock para ella, usar el primer stock disponible
        if hasattr(product, "prefetched_branch_stocks") and product.prefetched_branch_stocks:
            return super().to_representation(product.prefetched_branch_stocks[0].sale_price)

        if hasattr(product, "_prefetched_objects_cache") and "stocks" in product._prefetched_objects_cache:
            stocks = product._prefetched_objects_cache["stocks"]
            if stocks:
                return super().to_representation(stocks[0].sale_price)

        first_stock = product.stocks.first()
        if first_stock and first_stock.sale_price is not None:
            return super().to_representation(first_stock.sale_price)

        # 5. Fallback al costo o a 0.00
        cost = product.cost_price if product.cost_price is not None else Decimal("0.00")
        return super().to_representation(cost)


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    needs_pricing = serializers.BooleanField(read_only=True)
    skin_type_display = serializers.CharField(source="get_skin_type_display", read_only=True)
    target_problems_display = serializers.SerializerMethodField()
    benefits_display = serializers.SerializerMethodField()
    sale_price = BranchSalePriceField()

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

    @transaction.atomic
    def create(self, validated_data):
        suggested_sale_price = validated_data.pop("sale_price", None)
        product = super().create(validated_data)
        initialize_product_stocks(product, suggested_sale_price=suggested_sale_price)
        return product

    @transaction.atomic
    def update(self, instance, validated_data):
        sale_price = validated_data.pop("sale_price", None)
        product = super().update(instance, validated_data)

        if sale_price is not None:
            request = self.context.get("request") if self.context else None
            branch_id = None
            if request:
                branch_id = request.query_params.get("branch_id") or request.query_params.get("branch")
                if not branch_id and getattr(request, "user", None):
                    branch_id = getattr(request.user, "branch_id", None)
            if branch_id:
                branch = Branch.objects.filter(id=branch_id, is_active=True).first()
                if branch:
                    stock, _ = Stock.objects.get_or_create(
                        branch=branch,
                        product=product,
                        defaults={"qty_on_hand": Decimal("0.00"), "sale_price": sale_price},
                    )
                    stock.sale_price = sale_price
                    stock.save(update_fields=["sale_price", "updated_at"])
        return product


class ProductRecommendationSerializer(serializers.ModelSerializer):
    price = BranchSalePriceField(read_only=True)
    sale_price = BranchSalePriceField(read_only=True)
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
            "sale_price",
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