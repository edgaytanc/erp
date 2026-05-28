from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers

from .models import Supplier, Purchase, PurchaseItem, PurchaseStatus


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "contact_name",
            "phone",
            "address",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PurchaseItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseItem
        fields = [
            "id",
            "purchase",
            "product",
            "qty",
            "unit_cost",
            "subtotal",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "purchase": {"required": False},
            "subtotal": {"required": False},
        }


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, required=False)

    class Meta:
        model = Purchase
        fields = [
            "id",
            "branch",
            "supplier",
            "invoice_number",
            "status",
            "purchased_at",
            "total_cost",
            "cancelled_at",
            "cancel_reason",
            "created_at",
            "updated_at",
            "items",
        ]
        read_only_fields = [
            "id",
            "status",
            "purchased_at",
            "total_cost",
            "cancelled_at",
            "cancel_reason",
            "created_at",
            "updated_at",
        ]

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def validate(self, attrs):
        branch = attrs.get("branch") or getattr(self.instance, "branch", None)
        supplier = attrs.get("supplier") or getattr(self.instance, "supplier", None)
        items = attrs.get("items", None)
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if branch is not None and not branch.is_active:
            raise serializers.ValidationError({"branch": "La sucursal seleccionada no está activa."})

        assigned_branch_id = getattr(user, "branch_id", None)
        is_admin = bool(user and getattr(user, "is_admin", lambda: False)())

        if assigned_branch_id and branch is not None and branch.id != assigned_branch_id:
            raise serializers.ValidationError({"branch": "Solo puedes operar la sucursal asignada a tu usuario."})

        if user and not is_admin and not assigned_branch_id:
            raise serializers.ValidationError({"branch": "Tu usuario no tiene una sucursal asignada."})

        if supplier is not None and not supplier.is_active:
            raise serializers.ValidationError({"supplier": "El proveedor seleccionado no está activo."})

        if items is None:
            return attrs

        if not items:
            raise serializers.ValidationError({"items": "La compra debe incluir al menos un item."})

        seen_products = set()
        for index, item in enumerate(items):
            product = item.get("product")
            qty = item.get("qty")
            unit_cost = item.get("unit_cost")

            if product is None:
                raise serializers.ValidationError({"items": f"El item #{index + 1} requiere producto."})

            if product.id in seen_products:
                raise serializers.ValidationError({"items": "No se permiten productos repetidos en la misma compra."})
            seen_products.add(product.id)

            if qty is None or qty <= 0:
                raise serializers.ValidationError({"items": f"El item #{index + 1} debe tener qty > 0."})

            if unit_cost is None or unit_cost < 0:
                raise serializers.ValidationError({"items": f"El item #{index + 1} debe tener unit_cost >= 0."})

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        purchase = Purchase.objects.create(status=PurchaseStatus.DRAFT, **validated_data)

        for item in items_data:
            qty = item["qty"]
            unit_cost = item["unit_cost"]
            subtotal = self._money(item.get("subtotal") or (qty * unit_cost))

            PurchaseItem.objects.create(
                purchase=purchase,
                product=item["product"],
                qty=qty,
                unit_cost=unit_cost,
                subtotal=subtotal,
            )

        return purchase

    def update(self, instance, validated_data):
        if instance.status != PurchaseStatus.DRAFT:
            raise serializers.ValidationError("Solo se puede editar una compra en estado DRAFT.")

        items_data = validated_data.pop("items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                qty = item["qty"]
                unit_cost = item["unit_cost"]
                subtotal = self._money(item.get("subtotal") or (qty * unit_cost))

                PurchaseItem.objects.create(
                    purchase=instance,
                    product=item["product"],
                    qty=qty,
                    unit_cost=unit_cost,
                    subtotal=subtotal,
                )

        return instance


class PurchaseCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)
