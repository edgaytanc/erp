from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from django.db import transaction
from django.utils import timezone

from apps.config_module.services import get_money_rounding, get_sale_void_window_minutes, get_tax_rate
from apps.inventory.models import ReferenceType, StockMovement
from apps.inventory.services import BusinessRuleError, apply_inventory_movement
from .models import CashRegisterSession, CashRegisterStatus, Sale, SaleItem, SaleStatus


class SaleServiceError(BusinessRuleError):
    """Errores de negocio específicos de ventas."""


def _d(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value: Decimal, rounding: Decimal) -> Decimal:
    return _d(value).quantize(_d(rounding), rounding=ROUND_HALF_UP)


def _is_admin(user) -> bool:
    return bool(getattr(user, "is_admin", lambda: False)())


def _open_cash_session_queryset(*, branch, cashier_id):
    return CashRegisterSession.objects.filter(
        branch=branch,
        cashier_id=cashier_id,
        status=CashRegisterStatus.OPEN,
    )


def get_open_cash_session(*, branch, cashier_id):
    return _open_cash_session_queryset(branch=branch, cashier_id=cashier_id).first()


def cash_sales_total_for_session(session: CashRegisterSession) -> Decimal:
    total = Sale.objects.filter(
        branch=session.branch,
        cashier_id=session.cashier_id,
        status=SaleStatus.CONFIRMED,
        payment_method="CASH",
        sold_at__gte=session.opened_at,
    )
    if session.closed_at:
        total = total.filter(sold_at__lte=session.closed_at)

    return total.aggregate(
        total=Coalesce(Sum("total"), Value(Decimal("0.00")), output_field=DecimalField())
    )["total"]


def expected_cash_for_session(session: CashRegisterSession) -> Decimal:
    return _d(session.opening_amount) + _d(cash_sales_total_for_session(session))


@transaction.atomic
def open_cash_session(*, branch, cashier, opening_amount) -> CashRegisterSession:
    if not branch:
        raise SaleServiceError("Sucursal requerida para abrir caja.")

    if not branch.is_active:
        raise SaleServiceError("No se puede abrir caja en una sucursal inactiva.")

    if opening_amount is None or _d(opening_amount) < 0:
        raise SaleServiceError("El monto de apertura debe ser mayor o igual a cero.")

    business_date = timezone.localdate()
    existing_open = (
        CashRegisterSession.objects.select_for_update()
        .filter(branch=branch, cashier=cashier, status=CashRegisterStatus.OPEN)
        .first()
    )
    if existing_open:
        return existing_open

    existing_today = (
        CashRegisterSession.objects.select_for_update()
        .filter(branch=branch, cashier=cashier, business_date=business_date)
        .first()
    )
    if existing_today:
        raise SaleServiceError("La caja diaria ya fue cerrada para este cajero y sucursal.")

    return CashRegisterSession.objects.create(
        branch=branch,
        cashier=cashier,
        business_date=business_date,
        opening_amount=_d(opening_amount),
        opened_at=timezone.now(),
    )


@transaction.atomic
def close_cash_session(*, branch, cashier, closing_amount) -> CashRegisterSession:
    if closing_amount is None or _d(closing_amount) < 0:
        raise SaleServiceError("El monto de cierre debe ser mayor o igual a cero.")

    session = (
        CashRegisterSession.objects.select_for_update()
        .filter(branch=branch, cashier=cashier, status=CashRegisterStatus.OPEN)
        .first()
    )
    if not session:
        raise SaleServiceError("No hay una caja abierta para cerrar.")

    session.closing_amount = _d(closing_amount)
    session.status = CashRegisterStatus.CLOSED
    session.closed_at = timezone.now()
    session.save(update_fields=["closing_amount", "status", "closed_at", "updated_at"])
    return session


@transaction.atomic
def recompute_totals_for_update(sale: Sale) -> tuple[Decimal, Decimal, Decimal]:
    sale_locked = Sale.objects.select_for_update().select_related("branch__company").get(pk=sale.pk)

    if not sale_locked.branch.is_active:
        raise SaleServiceError("No se puede procesar una venta para una sucursal inactiva.")

    company = sale_locked.branch.company
    tax_rate = _d(get_tax_rate(company))
    rounding = _d(get_money_rounding(company))

    items = list(SaleItem.objects.select_for_update().select_related("product").filter(sale=sale_locked))
    if not items:
        raise SaleServiceError("No se puede procesar una venta sin items.")

    total_con_iva = Decimal("0.00")
    for item in items:
        if not item.product.is_active:
            raise SaleServiceError(f"El producto '{item.product.sku} - {item.product.name}' está inactivo.")
        if item.qty <= 0:
            raise SaleServiceError("La venta tiene items con cantidad inválida.")
        if item.unit_price < 0:
            raise SaleServiceError("La venta tiene items con precio inválido.")

        expected_subtotal = _money(_d(item.qty) * _d(item.unit_price), rounding)
        if item.subtotal != expected_subtotal:
            item.subtotal = expected_subtotal
            item.save(update_fields=["subtotal", "updated_at"])

        total_con_iva += item.subtotal

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

    sale_locked.subtotal = subtotal_sin_iva
    sale_locked.tax = iva
    sale_locked.total = total_con_iva
    sale_locked.save(update_fields=["subtotal", "tax", "total", "updated_at"])

    return subtotal_sin_iva, iva, total_con_iva


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

    if not sale.branch.is_active:
        raise SaleServiceError("No se puede confirmar una venta en una sucursal inactiva.")

    if not get_open_cash_session(branch=sale.branch, cashier_id=cashier_id):
        raise SaleServiceError("Debes abrir caja antes de confirmar ventas en el POS.")

    sale.cashier_id = cashier_id
    recompute_totals_for_update(sale)

    items = list(sale.items.select_related("product").all())
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
        raise SaleServiceError("La venta confirmada no tiene sold_at. No se puede evaluar la anulación.")

    if not _is_admin(user):
        window_minutes = get_sale_void_window_minutes(sale.branch.company)
        if window_minutes <= 0:
            raise SaleServiceError("No tienes permiso para anular ventas.")

        delta_minutes = (timezone.now() - sale.sold_at).total_seconds() / 60.0
        if delta_minutes > window_minutes:
            raise SaleServiceError(
                f"Ventana de anulación vencida. Han pasado {int(delta_minutes)} min "
                f"(máximo permitido: {window_minutes} min)."
            )

    items = list(sale.items.select_related("product").all())
    if not items:
        raise SaleServiceError("La venta no tiene items para anular.")

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
