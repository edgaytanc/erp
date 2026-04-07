from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from apps.config_module.services import (
    get_tax_rate,
    get_money_rounding,
    get_sale_void_window_minutes,
)
from apps.inventory.services import apply_inventory_movement, BusinessRuleError
from apps.inventory.models import StockMovement, ReferenceType
from .models import Sale, SaleItem, SaleStatus


class SaleServiceError(BusinessRuleError):
    """Errores de negocio específicos de ventas."""


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value: Decimal, rounding: Decimal) -> Decimal:
    rounding = _d(rounding)
    return _d(value).quantize(rounding, rounding=ROUND_HALF_UP)


def _is_admin(user) -> bool:
    return bool(getattr(user, "is_admin", lambda: False)())


@transaction.atomic
def recompute_totals_for_update(sale: Sale) -> tuple[Decimal, Decimal, Decimal]:
    sale_locked = Sale.objects.select_for_update().select_related("branch__company").get(pk=sale.pk)

    company = sale_locked.branch.company
    tax_rate = _d(get_tax_rate(company))
    rounding = _d(get_money_rounding(company))

    items = list(SaleItem.objects.select_for_update().filter(sale=sale_locked).all())
    if not items:
        raise SaleServiceError("No se puede procesar una venta sin items.")

    total_con_iva = Decimal("0.00")

    for it in items:
        if it.qty <= 0:
            raise SaleServiceError("La venta tiene items con cantidad inválida.")
        if it.unit_price < 0:
            raise SaleServiceError("La venta tiene items con precio inválido.")

        expected = _money(_d(it.qty) * _d(it.unit_price), rounding)
        if it.subtotal != expected:
            it.subtotal = expected
            it.save(update_fields=["subtotal", "updated_at"])

        total_con_iva += it.subtotal

    total_con_iva = _money(total_con_iva, rounding)

    if tax_rate < 0:
        raise SaleServiceError("La tasa de IVA no puede ser negativa.")

    if tax_rate == 0:
        subtotal_sin_iva = total_con_iva
        iva = Decimal("0.00")
    else:
        divisor = Decimal("1.00") + tax_rate
        subtotal_sin_iva = _money(total_con_iva / divisor, rounding)
        iva = _money(total_con_iva - subtotal_sin_iva, rounding)

    total = total_con_iva

    sale_locked.subtotal = subtotal_sin_iva
    sale_locked.tax = iva
    sale_locked.total = total
    sale_locked.save(update_fields=["subtotal", "tax", "total", "updated_at"])

    return subtotal_sin_iva, iva, total


@transaction.atomic
def confirm_sale(sale_id, *, cashier_id) -> Sale:
    sale = (
        Sale.objects.select_for_update()
        .select_related("branch__company")
        .prefetch_related("items__product")
        .get(pk=sale_id)
    )

    if sale.status == SaleStatus.CONFIRMED:
        return sale

    if sale.status == SaleStatus.VOID:
        raise SaleServiceError("No se puede confirmar una venta anulada.")

    if cashier_id is None:
        raise SaleServiceError("cashier_id es requerido para confirmar la venta.")

    sale.cashier_id = cashier_id

    recompute_totals_for_update(sale)

    items = list(sale.items.all())
    if not items:
        raise SaleServiceError("No se puede confirmar una venta sin items.")

    for item in items:
        apply_inventory_movement(
            branch=sale.branch,
            product=item.product,
            movement_type=StockMovement.Type.OUT,
            qty=item.qty,
            unit_cost=None,
            reference_type=ReferenceType.SALE,
            reference_id=sale.id,
            note="Venta confirmada",
            prevent_negative=True,
        )

    sale.status = SaleStatus.CONFIRMED
    sale.sold_at = sale.sold_at or timezone.now()
    sale.save(update_fields=["cashier_id", "status", "sold_at", "updated_at"])
    return sale


@transaction.atomic
def void_sale(sale_id, *, user, cashier_id, reason: str = "") -> Sale:
    sale = (
        Sale.objects.select_for_update()
        .select_related("branch__company")
        .prefetch_related("items__product")
        .get(pk=sale_id)
    )

    if sale.status == SaleStatus.VOID:
        return sale

    if sale.status != SaleStatus.CONFIRMED:
        raise SaleServiceError("Solo se puede anular una venta confirmada.")

    if not sale.sold_at:
        raise SaleServiceError("La venta confirmada no tiene sold_at. No se puede evaluar ventana de anulación.")

    if not _is_admin(user):
        window_minutes = get_sale_void_window_minutes(sale.branch.company)

        if window_minutes <= 0:
            raise SaleServiceError("No tienes permiso para anular ventas (ventana de anulación = 0).")

        delta = timezone.now() - sale.sold_at
        delta_minutes = delta.total_seconds() / 60.0

        if delta_minutes > window_minutes:
            raise SaleServiceError(
                f"Ventana de anulación vencida. Han pasado {int(delta_minutes)} min "
                f"(máximo permitido: {window_minutes} min)."
            )

    items = list(sale.items.all())
    if not items:
        raise SaleServiceError("La venta no tiene items para anular (estado inválido).")

    for item in items:
        apply_inventory_movement(
            branch=sale.branch,
            product=item.product,
            movement_type=StockMovement.Type.IN,
            qty=item.qty,
            unit_cost=None,
            reference_type=ReferenceType.SALE_VOID,
            reference_id=sale.id,
            note=f"Anulación de venta. Motivo: {reason or '-'}",
            prevent_negative=True,
        )

    sale.status = SaleStatus.VOID
    sale.voided_at = timezone.now()
    sale.void_reason = reason or ""

    if sale.cashier_id is None:
        sale.cashier_id = cashier_id

    sale.save(update_fields=["status", "voided_at", "void_reason", "cashier_id", "updated_at"])
    return sale