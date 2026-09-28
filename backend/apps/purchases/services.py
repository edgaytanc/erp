from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from apps.inventory.services import BusinessRuleError
from .models import Purchase, PurchaseStatus
from .inventory_integration import sync_purchase_inventory


class PurchaseServiceError(BusinessRuleError):
    """Errores de negocio específicos de compras."""


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return _d(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@transaction.atomic
def confirm_purchase(purchase_id) -> Purchase:
    purchase = (
        Purchase.objects.select_for_update()
        .select_related("branch", "supplier")
        .prefetch_related("items__product")
        .get(pk=purchase_id)
    )

    if purchase.status == PurchaseStatus.CONFIRMED:
        return purchase

    if purchase.status == PurchaseStatus.CANCELLED:
        raise PurchaseServiceError("No se puede confirmar una compra cancelada.")

    if not purchase.branch.is_active:
        raise PurchaseServiceError("No se puede confirmar una compra en una sucursal inactiva.")

    if not purchase.supplier.is_active:
        raise PurchaseServiceError("No se puede confirmar una compra con un proveedor inactivo.")

    items = list(purchase.items.all())
    if not items:
        raise PurchaseServiceError("No se puede confirmar una compra sin items.")

    total_cost = Decimal("0.00")

    for item in items:
        if item.qty <= 0:
            raise PurchaseServiceError("La compra tiene items con cantidad inválida.")
        if item.unit_cost < 0:
            raise PurchaseServiceError("La compra tiene items con costo inválido.")

        expected_subtotal = _money(_d(item.qty) * _d(item.unit_cost))
        if item.subtotal != expected_subtotal:
            item.subtotal = expected_subtotal
            item.save(update_fields=["subtotal", "updated_at"])

        total_cost += item.subtotal

    purchase.total_cost = _money(total_cost)
    purchase.status = PurchaseStatus.CONFIRMED
    purchase.purchased_at = purchase.purchased_at or timezone.now()
    purchase.cancelled_at = None
    purchase.cancel_reason = ""
    purchase.save(
        update_fields=[
            "total_cost",
            "status",
            "purchased_at",
            "cancelled_at",
            "cancel_reason",
            "updated_at",
        ]
    )

    # Sincroniza inventario en la sucursal de la compra
    sync_purchase_inventory(purchase=purchase)

    return purchase


@transaction.atomic
def cancel_purchase(purchase_id, *, reason: str = "") -> Purchase:
    purchase = (
        Purchase.objects.select_for_update()
        .select_related("branch", "supplier")
        .get(pk=purchase_id)
    )

    if purchase.status == PurchaseStatus.CANCELLED:
        return purchase

    if purchase.status != PurchaseStatus.DRAFT:
        raise PurchaseServiceError("Solo se puede cancelar una compra en estado DRAFT.")

    purchase.status = PurchaseStatus.CANCELLED
    purchase.cancelled_at = timezone.now()
    purchase.cancel_reason = reason or ""
    purchase.save(update_fields=["status", "cancelled_at", "cancel_reason", "updated_at"])

    return purchase