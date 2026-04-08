from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.inventory.services import register_sale_output, register_sale_void_entry


@transaction.atomic
def sync_sale_inventory(*, sale, created_by=None):
    """
    Helper de integración para usar desde sales.services.

    Suposiciones mínimas:
    - sale.branch existe
    - sale.lines related_name existe
    - cada línea tiene product y quantity
    - sale.id existe
    """
    if not getattr(sale, "branch_id", None):
        raise ValidationError("La venta debe tener una sucursal asignada.")

    lines = sale.lines.select_related("product").all()
    if not lines.exists():
        raise ValidationError("No se puede confirmar una venta sin líneas.")

    for line in lines:
        register_sale_output(
            branch=sale.branch,
            product=line.product,
            qty=Decimal(line.quantity),
            sale_id=sale.id,
            created_by=created_by,
            note=f"Salida por confirmación de venta #{sale.id}",
        )


@transaction.atomic
def reverse_sale_inventory(*, sale, created_by=None, reason: str = ""):
    if not getattr(sale, "branch_id", None):
        raise ValidationError("La venta debe tener una sucursal asignada.")

    lines = sale.lines.select_related("product").all()
    if not lines.exists():
        raise ValidationError("No se puede anular una venta sin líneas.")

    for line in lines:
        register_sale_void_entry(
            branch=sale.branch,
            product=line.product,
            qty=Decimal(line.quantity),
            sale_id=sale.id,
            created_by=created_by,
            note=(f"Reingreso por anulación de venta #{sale.id}. {reason}").strip(),
        )
