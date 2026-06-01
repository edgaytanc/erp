from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers

from .models import CashRegisterSession, Sale, SaleItem, SaleStatus
from .services import cash_sales_total_for_session, expected_cash_for_session


class CashRegisterSessionSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    cashier_name = serializers.SerializerMethodField()
    cash_sales_total = serializers.SerializerMethodField()
    expected_cash = serializers.SerializerMethodField()
    difference = serializers.SerializerMethodField()

    class Meta:
        model = CashRegisterSession
        fields = [
            "id",
            "branch",
            "branch_name",
            "cashier",
            "cashier_name",
            "business_date",
            "status",
            "opening_amount",
            "closing_amount",
            "cash_sales_total",
            "expected_cash",
            "difference",
            "opened_at",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_cashier_name(self, obj):
        full_name = obj.cashier.get_full_name()
        return full_name or obj.cashier.username

    def get_cash_sales_total(self, obj):
        return cash_sales_total_for_session(obj)

    def get_expected_cash(self, obj):
        return expected_cash_for_session(obj)

    def get_difference(self, obj):
        if obj.closing_amount is None:
            return None
        return obj.closing_amount - expected_cash_for_session(obj)


class CashRegisterOpenSerializer(serializers.Serializer):
    opening_amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.00"))


class CashRegisterCloseSerializer(serializers.Serializer):
    closing_amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.00"))


class SaleItemSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = SaleItem
        fields = [
            "id",
            "sale",
            "product",
            "product_sku",
            "product_name",
            "qty",
            "unit_price",
            "subtotal",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "sale",
            "subtotal",
            "created_at",
            "updated_at",
            "product_sku",
            "product_name",
        ]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, required=True)
    cashier_id = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "branch",
            "cashier_id",
            "status",
            "payment_method",
            "subtotal",
            "tax",
            "total",
            "sold_at",
            "voided_at",
            "void_reason",
            "created_at",
            "updated_at",
            "items",
        ]
        read_only_fields = [
            "id",
            "cashier_id",
            "status",
            "subtotal",
            "tax",
            "total",
            "sold_at",
            "voided_at",
            "void_reason",
            "created_at",
            "updated_at",
        ]

    def get_cashier_id(self, obj):
        if obj.cashier_id is None:
            return None
        return str(obj.cashier_id)

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _get_request_user(self):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not request or not user or not getattr(user, "is_authenticated", False):
            raise serializers.ValidationError("Usuario no autenticado.")
        return user

    def _get_cashier_id_from_request(self):
        user = self._get_request_user()
        if not getattr(user, "id", None):
            raise serializers.ValidationError("El usuario autenticado no tiene id.")
        return user.id

    def _can_override_price(self, user) -> bool:
        return bool(getattr(user, "is_admin", lambda: False)())

    def validate(self, attrs):
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        items = attrs.get("items", None)
        user = self._get_request_user()

        if branch is not None and not branch.is_active:
            raise serializers.ValidationError({"branch": "La sucursal seleccionada no está activa."})

        assigned_branch_id = getattr(user, "branch_id", None)
        is_admin = getattr(user, "is_admin", lambda: False)()

        if assigned_branch_id and branch is not None and branch.id != assigned_branch_id:
            raise serializers.ValidationError({"branch": "Solo puedes operar la sucursal asignada a tu usuario."})

        if not is_admin and not assigned_branch_id:
            raise serializers.ValidationError({"branch": "Tu usuario no tiene una sucursal asignada."})

        if items is None:
            return attrs

        if not items:
            raise serializers.ValidationError({"items": "La venta debe incluir al menos un item."})

        seen_products = set()
        allow_override = self._can_override_price(user)

        for index, item in enumerate(items):
            product = item.get("product")
            qty = item.get("qty")
            unit_price = item.get("unit_price")

            if product is None:
                raise serializers.ValidationError({"items": f"El item #{index + 1} requiere producto."})

            if not product.is_active:
                raise serializers.ValidationError(
                    {"items": f"El producto '{product.sku} - {product.name}' está inactivo."}
                )

            if product.id in seen_products:
                raise serializers.ValidationError({"items": "No se permiten productos repetidos en la misma venta."})
            seen_products.add(product.id)

            if qty is None or qty <= 0:
                raise serializers.ValidationError({"items": f"El item #{index + 1} debe tener qty > 0."})

            if unit_price is None or unit_price < 0:
                raise serializers.ValidationError({"items": f"El item #{index + 1} debe tener unit_price >= 0."})

            if not allow_override and Decimal(str(unit_price)) != product.sale_price:
                raise serializers.ValidationError(
                    {
                        "items": (
                            f"Precio no permitido para '{product.sku} - {product.name}'. "
                            f"Precio catálogo={product.sale_price}. Solo Admin puede modificar el precio."
                        )
                    }
                )

        return attrs

    def _create_items(self, sale: Sale, items_data: list[dict]) -> None:
        for item in items_data:
            qty = item["qty"]
            unit_price = item["unit_price"]
            subtotal = self._money(qty * unit_price)

            SaleItem.objects.create(
                sale=sale,
                product=item["product"],
                qty=qty,
                unit_price=unit_price,
                subtotal=subtotal,
            )

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        cashier_id = self._get_cashier_id_from_request()

        sale = Sale.objects.create(
            cashier_id=cashier_id,
            status=SaleStatus.DRAFT,
            **validated_data,
        )
        self._create_items(sale, items_data)
        return sale

    def update(self, instance, validated_data):
        if instance.status != SaleStatus.DRAFT:
            raise serializers.ValidationError("Solo se puede editar una venta en estado DRAFT.")

        items_data = validated_data.pop("items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            self._create_items(instance, items_data)

        return instance


class SaleVoidSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)


class SaleTicketSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    company_name = serializers.CharField(source="branch.company.name", read_only=True)
    company_tax_id = serializers.CharField(source="branch.company.tax_id", read_only=True)
    company_phone = serializers.CharField(source="branch.company.phone", read_only=True)
    company_address = serializers.CharField(source="branch.company.address", read_only=True)
    receipt_header = serializers.CharField(source="branch.company.receipt_header", read_only=True)
    receipt_footer = serializers.CharField(source="branch.company.receipt_footer", read_only=True)
    logo = serializers.CharField(source="branch.company.logo", read_only=True)
    items = SaleItemSerializer(many=True, read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "status",
            "payment_method",
            "sold_at",
            "voided_at",
            "void_reason",
            "subtotal",
            "tax",
            "total",
            "branch_name",
            "company_name",
            "company_tax_id",
            "company_phone",
            "company_address",
            "receipt_header",
            "receipt_footer",
            "logo",
            "items",
        ]
