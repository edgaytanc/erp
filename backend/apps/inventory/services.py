from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
from uuid import UUID

from django.db import transaction
from django.db.models import F

from apps.inventory.models import Stock, StockMovement, MovementType, ReferenceType
from apps.core.models import Branch
from apps.inventory.models import Product


class BusinessRuleError(Exception):
    """Error de regla de negocio (validaciones del dominio)."""


class InsufficientStockError(BusinessRuleError):
    """Cuando no hay stock suficiente para completar una salida."""


@dataclass(frozen=True)
class StockResult:
    branch_id: UUID
    product_id: UUID
    qty_on_hand: Decimal


def _to_decimal(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


@transaction.atomic
def get_or_create_stock_for_update(branch: Branch, product: Product) -> Stock:
    """
    Obtiene el registro Stock con lock. Si no existe lo crea.
    IMPORTANTE: lock para concurrencia POS.
    """
    stock = (
        Stock.objects.select_for_update()
        .filter(branch=branch, product=product)
        .first()
    )
    if stock is None:
        stock = Stock.objects.create(branch=branch, product=product, qty_on_hand=Decimal("0.000"))
        # Lock explícito sobre el recién creado
        stock = Stock.objects.select_for_update().get(pk=stock.pk)
    return stock


@transaction.atomic
def apply_inventory_movement(
    *,
    branch: Branch,
    product: Product,
    movement_type: str,
    qty: Decimal,
    reference_type: str,
    reference_id: Optional[UUID],
    unit_cost: Optional[Decimal] = None,
    note: str = "",
    prevent_negative: bool = True,
) -> StockResult:
    """
    Aplica un movimiento al stock y registra StockMovement.

    movement_type:
      - IN   => suma
      - OUT  => resta
      - ADJUST => ajusta (por ahora lo tratamos como suma/resta según qty positivo)
      - VOID => suma (restitución por anulación)

    prevent_negative: si True, bloquea stock negativo en salidas.
    """

    qty = _to_decimal(qty)
    if qty <= 0:
        raise BusinessRuleError("La cantidad del movimiento debe ser mayor a 0.")

    if movement_type not in {MovementType.IN_, MovementType.OUT, MovementType.ADJUST, MovementType.VOID}:
        raise BusinessRuleError(f"Tipo de movimiento inválido: {movement_type}")

    if reference_type not in {ReferenceType.SALE, ReferenceType.PURCHASE, ReferenceType.ADJUSTMENT, ReferenceType.VOID}:
        raise BusinessRuleError(f"Tipo de referencia inválido: {reference_type}")

    stock = get_or_create_stock_for_update(branch, product)

    # Calcular nuevo stock
    if movement_type in (MovementType.IN_, MovementType.VOID):
        new_qty = stock.qty_on_hand + qty
        stock.qty_on_hand = new_qty

    elif movement_type == MovementType.OUT:
        if prevent_negative and stock.qty_on_hand < qty:
            raise InsufficientStockError(
                f"Stock insuficiente para {product.sku}. Disponible={stock.qty_on_hand} | Requerido={qty}"
            )
        new_qty = stock.qty_on_hand - qty
        stock.qty_on_hand = new_qty

    else:  # ADJUST
        # Ajuste: se interpreta como "sumar" (si quisieras +/- podríamos permitir qty negativa)
        new_qty = stock.qty_on_hand + qty
        stock.qty_on_hand = new_qty

    stock.save(update_fields=["qty_on_hand", "updated_at"])

    StockMovement.objects.create(
        branch=branch,
        product=product,
        type=movement_type,
        qty=qty,
        unit_cost=unit_cost,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note or "",
    )

    return StockResult(branch_id=branch.id, product_id=product.id, qty_on_hand=stock.qty_on_hand)
