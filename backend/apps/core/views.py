# backend/apps/core/views.py
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import Branch, Notification
from apps.inventory.models import Stock
from apps.purchases.models import Purchase, PurchaseStatus
from apps.sales.models import (
    CashRegisterSession,
    CashRegisterStatus,
    Sale,
    SaleItem,
    SaleStatus,
)
from apps.sales.services import expected_cash_for_session
from .serializers import NotificationSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})


class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet para listar, consultar y gestionar el estado de lectura de Notificaciones.
    Filtra automáticamente por la sucursal asignada al usuario en sesión y
    ordena por fecha descendente (-created_at).
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Notification.objects.none()

        qs = Notification.objects.select_related("branch").all()

        # Si el usuario tiene una sucursal asignada, se restringe estrictamente a ella
        if getattr(user, "branch", None):
            qs = qs.filter(branch=user.branch)
        elif getattr(user, "is_admin", lambda: False)():
            # Administradores globales sin sucursal fija pueden filtrar opcionalmente por ?branch=
            branch_param = self.request.query_params.get("branch")
            if branch_param:
                qs = qs.filter(branch_id=branch_param)
        else:
            return Notification.objects.none()

        # Filtro opcional por estado de lectura (?is_read=true / ?is_read=false)
        is_read_param = self.request.query_params.get("is_read")
        if is_read_param is not None:
            if is_read_param.lower() in ("true", "1"):
                qs = qs.filter(is_read=True)
            elif is_read_param.lower() in ("false", "0"):
                qs = qs.filter(is_read=False)

        # Filtro opcional por tipo de notificación (?notification_type=LOW_STOCK)
        notification_type = self.request.query_params.get("notification_type")
        if notification_type:
            qs = qs.filter(notification_type=notification_type)

        return qs.order_by("-created_at")

    @action(detail=True, methods=["post"])
    def mark_as_read(self, request, pk=None):
        """
        Marca una notificación específica como leída.
        """
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read", "updated_at"])
        serializer = self.get_serializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def mark_all_as_read(self, request):
        """
        Marca todas las notificaciones no leídas de la sucursal actual como leídas.
        """
        qs = self.get_queryset().filter(is_read=False)
        updated_count = qs.update(is_read=True)
        return Response(
            {
                "detail": f"{updated_count} notificaciones marcadas como leídas.",
                "updated_count": updated_count,
            },
            status=status.HTTP_200_OK,
        )


class PurchasingDashboardAPIView(APIView):
    """
    Endpoint gerencial consolidado para el Dashboard del rol de Compras (Purchasing).
    Filtra estrictamente por la sucursal del usuario (request.user.branch).
    No expone datos de ventas, cajas POS ni márgenes/utilidades brutas.

    Retorna:
      - kpis: Total gastado en compras (mes actual), Cantidad de órdenes en DRAFT,
              Productos con stock crítico (en o bajo el mínimo), y Valor total de inventario.
      - chart_data: Serie de los últimos 7 días con el gasto diario en compras.
      - alerts: Lista de productos de la sucursal con stock en 0 o crítico.
      - recent_activity: Las últimas 5 órdenes de compra registradas (sin importar el estado).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        branch = getattr(user, "branch", None)

        # Si el usuario es administrador global sin sucursal fija, permite opcionalmente filtrar por ?branch=
        if not branch and getattr(user, "is_admin", lambda: False)():
            branch_param = request.query_params.get("branch")
            if branch_param:
                branch = Branch.objects.filter(id=branch_param).first()

        now = timezone.now()
        today = now.date()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # -------------------------------------------------------------
        # 1. KPIS DE COMPRAS E INVENTARIO
        # -------------------------------------------------------------
        # A) Total gastado en compras confirmadas del mes actual
        purchases_month_qs = Purchase.objects.filter(
            status=PurchaseStatus.CONFIRMED,
            purchased_at__gte=start_of_month,
            purchased_at__lte=now,
        )
        if branch:
            purchases_month_qs = purchases_month_qs.filter(branch=branch)

        purchases_kpi = purchases_month_qs.aggregate(
            total_purchases=Coalesce(Sum("total_cost"), Value(Decimal("0.00")), output_field=DecimalField()),
            purchases_count=Count("id"),
        )
        total_purchases = purchases_kpi["total_purchases"] or Decimal("0.00")
        purchases_count = purchases_kpi["purchases_count"] or 0

        # B) Cantidad de órdenes de compra en estado DRAFT (pendientes)
        draft_orders_qs = Purchase.objects.filter(status=PurchaseStatus.DRAFT)
        if branch:
            draft_orders_qs = draft_orders_qs.filter(branch=branch)
        draft_orders_count = draft_orders_qs.count()

        # C) Productos con stock crítico (en o por debajo del stock mínimo)
        stock_qs = Stock.objects.filter(product__is_active=True).select_related("product", "branch")
        if branch:
            stock_qs = stock_qs.filter(branch=branch)

        low_stock_count = stock_qs.filter(qty_on_hand__lte=F("product__min_stock")).count()
        out_of_stock_count = stock_qs.filter(qty_on_hand__lte=Decimal("0.00")).count()

        # D) Valor total del inventario de la sucursal (qty_on_hand * product.cost_price)
        cogs_expr = ExpressionWrapper(
            F("qty_on_hand") * F("product__cost_price"),
            output_field=DecimalField(max_digits=18, decimal_places=2),
        )
        inventory_val_agg = stock_qs.aggregate(
            total_inventory_value=Coalesce(Sum(cogs_expr), Value(Decimal("0.00")), output_field=DecimalField())
        )
        total_inventory_value = inventory_val_agg["total_inventory_value"] or Decimal("0.00")

        # -------------------------------------------------------------
        # 2. DATOS DE LOS ÚLTIMOS 7 DÍAS (ÚNICAMENTE GASTO DIARIO EN COMPRAS)
        # -------------------------------------------------------------
        days_count = 7
        start_chart_dt = (now - timedelta(days=days_count - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        daily_purchases_qs = Purchase.objects.filter(
            status=PurchaseStatus.CONFIRMED,
            purchased_at__gte=start_chart_dt,
            purchased_at__lte=now,
        )
        if branch:
            daily_purchases_qs = daily_purchases_qs.filter(branch=branch)

        purchases_grouped = (
            daily_purchases_qs.annotate(day=TruncDate("purchased_at"))
            .values("day")
            .annotate(daily_total=Coalesce(Sum("total_cost"), Value(Decimal("0.00")), output_field=DecimalField()))
        )
        purchases_by_date = {row["day"]: float(row["daily_total"]) for row in purchases_grouped if row["day"]}

        weekday_names = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
        chart_data = []
        for offset in range(days_count - 1, -1, -1):
            target_date = today - timedelta(days=offset)
            chart_data.append({
                "date": target_date.isoformat(),
                "label": weekday_names[target_date.weekday()],
                "day_formatted": target_date.strftime("%d/%m"),
                "purchases": purchases_by_date.get(target_date, 0.0),
            })

        # -------------------------------------------------------------
        # 3. ALERTAS CRÍTICAS DE INVENTARIO (TOP 10 STOCK <= MIN_STOCK)
        # -------------------------------------------------------------
        alerts_stocks = (
            stock_qs.filter(qty_on_hand__lte=F("product__min_stock"))
            .order_by("qty_on_hand", "product__name")[:10]
        )
        alerts = [
            {
                "id": str(item.id),
                "product_id": str(item.product_id),
                "product_name": item.product.name,
                "sku": item.product.sku,
                "barcode": item.product.barcode or "",
                "branch_id": str(item.branch_id),
                "branch_name": item.branch.name,
                "qty_on_hand": float(item.qty_on_hand),
                "min_stock": float(item.product.min_stock),
                "is_out_of_stock": bool(item.qty_on_hand <= Decimal("0.00")),
                "shortage": float(max(Decimal("0.00"), item.product.min_stock - item.qty_on_hand)),
            }
            for item in alerts_stocks
        ]

        # -------------------------------------------------------------
        # 4. ACTIVIDAD RECIENTE (ÚLTIMAS 5 ÓRDENES DE COMPRA SIN IMPORTAR ESTADO)
        # -------------------------------------------------------------
        recent_purchases_qs = Purchase.objects.select_related("branch", "supplier").all()
        if branch:
            recent_purchases_qs = recent_purchases_qs.filter(branch=branch)
        recent_purchases = list(recent_purchases_qs.order_by("-created_at")[:5])

        recent_activity = []
        for purchase in recent_purchases:
            dt = purchase.purchased_at or purchase.created_at
            inv = purchase.invoice_number or str(purchase.id)[:8].upper()
            recent_activity.append({
                "id": str(purchase.id),
                "type": "PURCHASE",
                "type_label": "Compra",
                "reference": f"Compra #{inv}",
                "invoice_number": purchase.invoice_number or "",
                "amount": float(purchase.total_cost),
                "total_cost": float(purchase.total_cost),
                "status": purchase.status,
                "status_display": (
                    "Confirmada"
                    if purchase.status == PurchaseStatus.CONFIRMED
                    else ("Cancelada" if purchase.status == PurchaseStatus.CANCELLED else "Borrador")
                ),
                "timestamp": dt.isoformat() if dt else None,
                "created_at": purchase.created_at.isoformat() if purchase.created_at else None,
                "branch_id": str(purchase.branch_id),
                "branch_name": purchase.branch.name,
                "supplier_id": str(purchase.supplier_id) if purchase.supplier else None,
                "supplier_name": purchase.supplier.name if purchase.supplier else "Proveedor",
                "extra_info": purchase.supplier.name if purchase.supplier else "Proveedor",
            })

        scope = {
            "branch_id": str(branch.id) if branch else None,
            "branch_name": branch.name if branch else "Todas las sucursales (Consolidado)",
            "is_global": branch is None,
        }

        return Response({
            "scope": scope,
            "kpis": {
                "total_purchases": float(total_purchases),
                "purchases_count": purchases_count,
                "draft_orders_count": draft_orders_count,
                "pending_orders_count": draft_orders_count,
                "low_stock_count": low_stock_count,
                "critical_stock_count": low_stock_count,
                "out_of_stock_count": out_of_stock_count,
                "total_inventory_value": float(total_inventory_value),
                "inventory_value": float(total_inventory_value),
            },
            "chart_data": chart_data,
            "alerts": alerts,
            "recent_activity": recent_activity,
        })


class DashboardAPIView(APIView):
    """
    Endpoint gerencial consolidado para el Dashboard Administrativo.
    Recopila KPIs del mes actual (Ventas, Compras, Utilidad bruta estimada, Stock bajo),
    datos de los últimos 7 días para gráficas (ventas vs compras diarias),
    alertas críticas de stock, actividad reciente y control de caja POS para sucursales.

    Lógica de Negocio Crítica:
    Aplica filtro por sucursal (request.user.branch).
    Si el usuario NO tiene sucursal asignada (es decir, es un Admin Global/Gerente General),
    el dashboard consolida y muestra la información de TODAS las sucursales.
    Permite opcionalmente filtrar por ?branch=<id> para gerentes globales.

    Seguridad de Rol:
    Si el usuario tiene rol 'purchases' (compras), se delega automáticamente al
    PurchasingDashboardAPIView para no exponer datos confidenciales de ventas, caja POS ni márgenes.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Aislamiento por rol: si el usuario es de rol Compras, derivar a PurchasingDashboardAPIView
        if getattr(user, "role", "") == "purchases" or getattr(user, "is_purchases", lambda: False)():
            return PurchasingDashboardAPIView().get(request)

        branch = getattr(user, "branch", None)

        # Si el usuario no tiene sucursal asignada (Admin Global/Gerente General),
        # puede consolidar todas las sucursales o filtrar opcionalmente por query param ?branch=
        if not branch and request.query_params.get("branch"):
            branch_param = request.query_params.get("branch")
            branch = Branch.objects.filter(id=branch_param).first()

        now = timezone.now()
        today = now.date()

        # Inicio del mes actual (00:00:00 del primer día del mes)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # -------------------------------------------------------------
        # 1. KPIs DEL MES ACTUAL
        # -------------------------------------------------------------
        # A) Ventas confirmadas del mes
        sales_month_qs = Sale.objects.filter(
            status=SaleStatus.CONFIRMED,
            sold_at__gte=start_of_month,
            sold_at__lte=now,
        )
        if branch:
            sales_month_qs = sales_month_qs.filter(branch=branch)

        sales_kpi = sales_month_qs.aggregate(
            total_sales=Coalesce(Sum("total"), Value(Decimal("0.00")), output_field=DecimalField()),
            sales_count=Count("id"),
        )
        total_sales = sales_kpi["total_sales"] or Decimal("0.00")
        sales_count = sales_kpi["sales_count"] or 0

        # B) Compras confirmadas del mes
        purchases_month_qs = Purchase.objects.filter(
            status=PurchaseStatus.CONFIRMED,
            purchased_at__gte=start_of_month,
            purchased_at__lte=now,
        )
        if branch:
            purchases_month_qs = purchases_month_qs.filter(branch=branch)

        purchases_kpi = purchases_month_qs.aggregate(
            total_purchases=Coalesce(Sum("total_cost"), Value(Decimal("0.00")), output_field=DecimalField()),
            purchases_count=Count("id"),
        )
        total_purchases = purchases_kpi["total_purchases"] or Decimal("0.00")
        purchases_count = purchases_kpi["purchases_count"] or 0

        # C) Utilidad bruta estimada del mes:
        # Ingresos por ventas menos Costo de Bienes Vendidos (COGS = qty * product.cost_price)
        cogs_expr = ExpressionWrapper(
            F("qty") * F("product__cost_price"),
            output_field=DecimalField(max_digits=18, decimal_places=2),
        )
        sale_items_month_qs = SaleItem.objects.filter(
            sale__status=SaleStatus.CONFIRMED,
            sale__sold_at__gte=start_of_month,
            sale__sold_at__lte=now,
        )
        if branch:
            sale_items_month_qs = sale_items_month_qs.filter(sale__branch=branch)

        cogs_agg = sale_items_month_qs.aggregate(
            total_cogs=Coalesce(Sum(cogs_expr), Value(Decimal("0.00")), output_field=DecimalField()),
            total_revenue=Coalesce(Sum("subtotal"), Value(Decimal("0.00")), output_field=DecimalField()),
        )
        total_cogs = cogs_agg["total_cogs"] or Decimal("0.00")
        estimated_gross_profit = total_sales - total_cogs
        profit_margin = (
            float(((estimated_gross_profit / total_sales) * Decimal("100.0")).quantize(Decimal("0.1")))
            if total_sales > Decimal("0.00")
            else 0.0
        )

        # D) Cantidad de productos con stock bajo
        stock_qs = Stock.objects.filter(product__is_active=True).select_related("product", "branch")
        if branch:
            stock_qs = stock_qs.filter(branch=branch)

        low_stock_count = stock_qs.filter(qty_on_hand__lte=F("product__min_stock")).count()
        out_of_stock_count = stock_qs.filter(qty_on_hand__lte=Decimal("0.00")).count()

        # -------------------------------------------------------------
        # 2. DATOS DE LOS ÚLTIMOS 7 DÍAS (GRÁFICA: VENTAS VS COMPRAS)
        # -------------------------------------------------------------
        days_count = 7
        start_chart_dt = (now - timedelta(days=days_count - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        # Ventas diarias confirmadas
        daily_sales_qs = Sale.objects.filter(
            status=SaleStatus.CONFIRMED,
            sold_at__gte=start_chart_dt,
            sold_at__lte=now,
        )
        if branch:
            daily_sales_qs = daily_sales_qs.filter(branch=branch)

        sales_grouped = (
            daily_sales_qs.annotate(day=TruncDate("sold_at"))
            .values("day")
            .annotate(daily_total=Coalesce(Sum("total"), Value(Decimal("0.00")), output_field=DecimalField()))
        )
        sales_by_date = {row["day"]: float(row["daily_total"]) for row in sales_grouped if row["day"]}

        # Compras diarias confirmadas
        daily_purchases_qs = Purchase.objects.filter(
            status=PurchaseStatus.CONFIRMED,
            purchased_at__gte=start_chart_dt,
            purchased_at__lte=now,
        )
        if branch:
            daily_purchases_qs = daily_purchases_qs.filter(branch=branch)

        purchases_grouped = (
            daily_purchases_qs.annotate(day=TruncDate("purchased_at"))
            .values("day")
            .annotate(daily_total=Coalesce(Sum("total_cost"), Value(Decimal("0.00")), output_field=DecimalField()))
        )
        purchases_by_date = {row["day"]: float(row["daily_total"]) for row in purchases_grouped if row["day"]}

        weekday_names = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
        chart_data = []
        for offset in range(days_count - 1, -1, -1):
            target_date = today - timedelta(days=offset)
            chart_data.append({
                "date": target_date.isoformat(),
                "label": weekday_names[target_date.weekday()],
                "day_formatted": target_date.strftime("%d/%m"),
                "sales": sales_by_date.get(target_date, 0.0),
                "purchases": purchases_by_date.get(target_date, 0.0),
            })

        # -------------------------------------------------------------
        # 3. ALERTAS CRÍTICAS DE INVENTARIO (TOP 5-10 STOCK <= MIN_STOCK)
        # -------------------------------------------------------------
        alerts_stocks = (
            stock_qs.filter(qty_on_hand__lte=F("product__min_stock"))
            .order_by("qty_on_hand", "product__name")[:10]
        )
        alerts = [
            {
                "id": str(item.id),
                "product_id": str(item.product_id),
                "product_name": item.product.name,
                "sku": item.product.sku,
                "barcode": item.product.barcode or "",
                "branch_id": str(item.branch_id),
                "branch_name": item.branch.name,
                "qty_on_hand": float(item.qty_on_hand),
                "min_stock": float(item.product.min_stock),
                "is_out_of_stock": bool(item.qty_on_hand <= Decimal("0.00")),
                "shortage": float(max(Decimal("0.00"), item.product.min_stock - item.qty_on_hand)),
            }
            for item in alerts_stocks
        ]

        # -------------------------------------------------------------
        # 4. ACTIVIDAD RECIENTE (ÚLTIMAS 5 TRANSACCIONES: VENTAS Y COMPRAS)
        # -------------------------------------------------------------
        recent_sales_qs = Sale.objects.select_related("branch").all()
        if branch:
            recent_sales_qs = recent_sales_qs.filter(branch=branch)
        recent_sales = list(recent_sales_qs.order_by("-sold_at", "-created_at")[:5])

        recent_purchases_qs = Purchase.objects.select_related("branch", "supplier").all()
        if branch:
            recent_purchases_qs = recent_purchases_qs.filter(branch=branch)
        recent_purchases = list(recent_purchases_qs.order_by("-purchased_at", "-created_at")[:5])

        combined_activity = []
        for sale in recent_sales:
            dt = sale.sold_at or sale.created_at
            combined_activity.append({
                "id": str(sale.id),
                "type": "SALE",
                "type_label": "Venta",
                "reference": f"Venta #{str(sale.id)[:8].upper()}",
                "amount": float(sale.total),
                "status": sale.status,
                "status_display": (
                    "Confirmada"
                    if sale.status == SaleStatus.CONFIRMED
                    else ("Anulada" if sale.status == SaleStatus.VOID else "Borrador")
                ),
                "timestamp": dt.isoformat() if dt else None,
                "branch_id": str(sale.branch_id),
                "branch_name": sale.branch.name,
                "extra_info": sale.payment_method or "Venta POS",
            })

        for purchase in recent_purchases:
            dt = purchase.purchased_at or purchase.created_at
            inv = purchase.invoice_number or str(purchase.id)[:8].upper()
            combined_activity.append({
                "id": str(purchase.id),
                "type": "PURCHASE",
                "type_label": "Compra",
                "reference": f"Compra #{inv}",
                "amount": float(purchase.total_cost),
                "status": purchase.status,
                "status_display": (
                    "Entregada"
                    if purchase.status == PurchaseStatus.CONFIRMED
                    else ("Cancelada" if purchase.status == PurchaseStatus.CANCELLED else "Pendiente")
                ),
                "timestamp": dt.isoformat() if dt else None,
                "branch_id": str(purchase.branch_id),
                "branch_name": purchase.branch.name,
                "extra_info": purchase.supplier.name if purchase.supplier else "Proveedor",
            })

        combined_activity.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        recent_activity = combined_activity[:5]

        # -------------------------------------------------------------
        # 5. ESTADO DE CAJA (PARA CONTROL POS DE SUCURSAL)
        # -------------------------------------------------------------
        cash_session_data = None
        if branch:
            open_session = (
                CashRegisterSession.objects.filter(
                    branch=branch,
                    status=CashRegisterStatus.OPEN,
                )
                .select_related("cashier")
                .order_by("-opened_at")
                .first()
            )
            if open_session:
                cash_session_data = {
                    "id": str(open_session.id),
                    "status": open_session.status,
                    "cashier_name": (
                        open_session.cashier.get_full_name()
                        or open_session.cashier.username
                    ),
                    "opening_amount": float(open_session.opening_amount),
                    "opened_at": open_session.opened_at.isoformat(),
                    "expected_cash": float(expected_cash_for_session(open_session)),
                }

        # Alcance (Sucursal específica o Consolidado Global)
        scope = {
            "branch_id": str(branch.id) if branch else None,
            "branch_name": branch.name if branch else "Todas las sucursales (Consolidado Global)",
            "is_global": branch is None,
        }

        return Response({
            "scope": scope,
            "kpis": {
                "total_sales": float(total_sales),
                "sales_count": sales_count,
                "total_purchases": float(total_purchases),
                "purchases_count": purchases_count,
                "estimated_gross_profit": float(estimated_gross_profit),
                "profit_margin": profit_margin,
                "low_stock_count": low_stock_count,
                "out_of_stock_count": out_of_stock_count,
            },
            "chart_data": chart_data,
            "alerts": alerts,
            "recent_activity": recent_activity,
            "cash_register_session": cash_session_data,
        })
