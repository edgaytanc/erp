from decimal import Decimal
from django.db import transaction

from apps.core.models import Branch
from apps.inventory.models import Product, Stock, StockMovement, ReferenceType


class BusinessRuleError(Exception):
    """Error genérico de reglas de negocio."""
    pass


class InsufficientStockError(BusinessRuleError):
    """Error específico cuando no hay stock suficiente."""
    pass


class InventoryService:
    @staticmethod
    @transaction.atomic
    def get_or_create_stock(product: Product, branch: Branch) -> Stock:
        stock, _ = Stock.objects.select_for_update().get_or_create(
            product=product,
            branch=branch,
            defaults={"qty_on_hand": Decimal("0.00")},
        )
        return stock

    @staticmethod
    @transaction.atomic
    def apply_movement(
        *,
        product: Product,
        branch: Branch,
        qty: Decimal,
        movement_type: str,
        reference_type: str = "",
        reference_id: str = "",
        unit_cost: Decimal | None = None,
        note: str = "",
        created_by=None,
        prevent_negative: bool = False,
    ) -> StockMovement:
        qty = Decimal(str(qty))

        if qty <= 0:
            raise BusinessRuleError("La cantidad del movimiento debe ser mayor que cero.")

        stock = InventoryService.get_or_create_stock(product, branch)

        stock_before = stock.qty_on_hand

        if movement_type == StockMovement.Type.IN:
            stock_after = stock_before + qty
        elif movement_type == StockMovement.Type.OUT:
            stock_after = stock_before - qty
        else:
            raise BusinessRuleError(f"Tipo de movimiento inválido: {movement_type}")

        if prevent_negative and stock_after < 0:
            raise InsufficientStockError(
                f"Stock insuficiente para '{product.name}' en la sucursal '{branch.name}'."
            )

        movement = StockMovement.objects.create(
            product=product,
            branch=branch,
            type=movement_type,
            qty=qty,
            stock_before=stock_before,
            stock_after=stock_after,
            reference_type=reference_type,
            reference_id=str(reference_id) if reference_id is not None else None,
            unit_cost=unit_cost,
            created_by=created_by,
            note=note,
        )

        stock.qty_on_hand = stock_after
        stock.save(update_fields=["qty_on_hand", "updated_at"])

        return movement


def apply_inventory_movement(
    *,
    product,
    branch,
    movement_type,
    qty=None,
    quantity=None,
    reference_type="",
    reference_id="",
    unit_cost=None,
    note="",
    notes="",
    created_by=None,
    prevent_negative=False,
    allow_negative_stock=False,
):
    final_qty = qty if qty is not None else quantity
    if final_qty is None:
        raise BusinessRuleError("Debe enviarse 'qty' o 'quantity'.")

    final_note = note or notes
    final_prevent_negative = prevent_negative or (not allow_negative_stock)

    return InventoryService.apply_movement(
        product=product,
        branch=branch,
        qty=Decimal(str(final_qty)),
        movement_type=movement_type,
        reference_type=reference_type,
        reference_id=reference_id,
        unit_cost=unit_cost,
        note=final_note,
        created_by=created_by,
        prevent_negative=final_prevent_negative,
    )


def register_purchase_entry(
    *,
    branch,
    product,
    qty,
    purchase_id,
    unit_cost=None,
    created_by=None,
    note="",
):
    return apply_inventory_movement(
        branch=branch,
        product=product,
        movement_type=StockMovement.Type.IN,
        qty=qty,
        unit_cost=unit_cost,
        reference_type=ReferenceType.PURCHASE,
        reference_id=purchase_id,
        note=note or f"Entrada por compra #{purchase_id}",
        created_by=created_by,
        prevent_negative=True,
    )


def register_sale_output(
    *,
    branch,
    product,
    qty,
    sale_id,
    created_by=None,
    note="",
):
    return apply_inventory_movement(
        branch=branch,
        product=product,
        movement_type=StockMovement.Type.OUT,
        qty=qty,
        unit_cost=None,
        reference_type=ReferenceType.SALE,
        reference_id=sale_id,
        note=note or f"Salida por venta #{sale_id}",
        created_by=created_by,
        prevent_negative=True,
    )


def register_sale_void_entry(
    *,
    branch,
    product,
    qty,
    sale_id,
    created_by=None,
    note="",
):
    return apply_inventory_movement(
        branch=branch,
        product=product,
        movement_type=StockMovement.Type.IN,
        qty=qty,
        unit_cost=None,
        reference_type=ReferenceType.SALE_VOID,
        reference_id=sale_id,
        note=note or f"Reingreso por anulación de venta #{sale_id}",
        created_by=created_by,
        prevent_negative=True,
    )


def register_adjustment(
    *,
    branch,
    product,
    qty,
    created_by=None,
    note="",
):
    qty = Decimal(str(qty))
    movement_type = StockMovement.Type.IN if qty > 0 else StockMovement.Type.OUT

    return apply_inventory_movement(
        branch=branch,
        product=product,
        movement_type=movement_type,
        qty=abs(qty),
        unit_cost=None,
        reference_type=ReferenceType.ADJUSTMENT,
        reference_id="",
        note=note or "Ajuste manual de inventario",
        created_by=created_by,
        prevent_negative=True,
    )