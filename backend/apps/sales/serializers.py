from __future__ import annotations

from decimal import Decimal
from rest_framework import serializers

from apps.inventory.models import Product
from .models import Sale, SaleItem, SaleStatus


class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = [
            "id",
            "sale",
            "product",
            "qty",
            "unit_price",
            "subtotal",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "sale": {"required": False},
            "subtotal": {"required": False},
        }


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, required=False)

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
        # Admin puede override
        return bool(getattr(user, "is_admin", lambda: False)())

    def validate(self, attrs):
        """
        Regla de precio:
        - Sales NO admin: unit_price debe ser exactamente igual a Product.sale_price
        - Admin: permite override (para descuentos/precios especiales)
        """
        user = self._get_request_user()
        items = attrs.get("items", [])

        # Si no hay items en el payload, no validamos acá.
        if not items:
            return attrs

        # Cargar productos del payload en bloque para evitar N+1
        product_ids = [it["product"].id for it in items if it.get("product")]
        products = {p.id: p for p in Product.objects.filter(id__in=product_ids)}

        allow_override = self._can_override_price(user)

        for it in items:
            qty = it.get("qty")
            unit_price = it.get("unit_price")
            product = it.get("product")

            if qty is None or qty <= 0:
                raise serializers.ValidationError("Cada item debe tener qty > 0.")
            if unit_price is None or unit_price < 0:
                raise serializers.ValidationError("Cada item debe tener unit_price >= 0.")
            if product is None:
                raise serializers.ValidationError("Cada item debe incluir product.")

            p = products.get(product.id)
            if not p:
                raise serializers.ValidationError("Producto inválido.")

            # Validación estricta (igualdad exacta) para no admin.
            # Si luego quieres tolerancia por redondeo, lo ajustamos.
            if not allow_override and Decimal(str(unit_price)) != p.sale_price:
                raise serializers.ValidationError(
                    f"Precio no permitido para '{p.sku} - {p.name}'. "
                    f"Precio actual={unit_price} | Precio catálogo={p.sale_price}. "
                    "Solo Admin puede modificar el precio."
                )

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        cashier_id = self._get_cashier_id_from_request()

        sale = Sale.objects.create(
            cashier_id=cashier_id,
            status=SaleStatus.DRAFT,
            **validated_data
        )

        for item in items_data:
            qty = item["qty"]
            unit_price = item["unit_price"]
            subtotal = item.get("subtotal") or (qty * unit_price)

            SaleItem.objects.create(
                sale=sale,
                product=item["product"],
                qty=qty,
                unit_price=unit_price,
                subtotal=subtotal,
            )

        return sale

    def update(self, instance, validated_data):
        if instance.status in (SaleStatus.CONFIRMED, SaleStatus.VOID):
            raise serializers.ValidationError("No se puede editar una venta CONFIRMED/VOID.")

        items_data = validated_data.pop("items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            # Validación de precios nuevamente (porque update puede cambiar items)
            self.validate({"items": items_data})

            instance.items.all().delete()
            for item in items_data:
                qty = item["qty"]
                unit_price = item["unit_price"]
                subtotal = item.get("subtotal") or (qty * unit_price)

                SaleItem.objects.create(
                    sale=instance,
                    product=item["product"],
                    qty=qty,
                    unit_price=unit_price,
                    subtotal=subtotal,
                )

        return instance


class SaleVoidSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)
