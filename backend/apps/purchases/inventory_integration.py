from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.inventory.models import ReferenceType, StockMovement
from apps.inventory.services import register_purchase_entry


@transaction.atomic
def sync_purchase_inventory(*, purchase, created_by=None):
    """
    Sincroniza el inventario para una compra confirmada.
    Registra las entradas de stock en la sucursal de la compra para cada item.
    Es estrictamente idempotente: si ya existen movimientos asociados a la compra, no los duplica.
    """
    if not getattr(purchase, "branch_id", None):
        raise ValidationError("La compra debe tener una sucursal asignada.")

    if not purchase.branch.is_active:
        raise ValidationError("No se puede sincronizar inventario en una sucursal inactiva.")

    # Idempotencia: Verificar si ya existen movimientos registrados para esta compra
    existing_moves = StockMovement.objects.filter(
        reference_type=ReferenceType.PURCHASE,
        reference_id=str(purchase.id),
    ).exists()
    if existing_moves:
        return

    items = purchase.items.select_related("product").all()
    if not items.exists():
        raise ValidationError("No se puede confirmar una compra sin items.")

    for item in items:
        register_purchase_entry(
            branch=purchase.branch,
            product=item.product,
            qty=Decimal(str(item.qty)),
            purchase_id=purchase.id,
            unit_cost=item.unit_cost,
            created_by=created_by,
            note=f"Entrada por confirmación de compra #{purchase.id}",
        )

        if item.product.cost_price != item.unit_cost:
            item.product.cost_price = item.unit_cost
            item.product.save(update_fields=["cost_price", "updated_at"])
