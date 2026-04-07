from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.inventory.services import register_purchase_entry


@transaction.atomic
def sync_purchase_inventory(*, purchase, created_by=None):
    """
    Helper de integración para usar desde purchases.services.

    Suposiciones mínimas:
    - purchase.branch existe
    - purchase.lines related_name existe
    - cada línea tiene product, quantity, unit_cost
    - purchase.id existe
    """
    if not getattr(purchase, "branch_id", None):
        raise ValidationError("La compra debe tener una sucursal asignada.")

    lines = purchase.lines.select_related("product").all()
    if not lines.exists():
        raise ValidationError("No se puede confirmar una compra sin líneas.")

    for line in lines:
        register_purchase_entry(
            branch=purchase.branch,
            product=line.product,
            qty=Decimal(line.quantity),
            purchase_id=purchase.id,
            unit_cost=getattr(line, "unit_cost", None),
            created_by=created_by,
            note=f"Entrada por confirmación de compra #{purchase.id}",
        )
