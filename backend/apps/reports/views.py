from __future__ import annotations

from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from apps.core.models import Branch
from apps.inventory.models import Stock, StockMovement
from apps.purchases.models import Purchase, PurchaseItem, PurchaseStatus
from apps.sales.models import CashRegisterSession, CashRegisterStatus, Sale, SaleItem, SaleStatus
from apps.sales.services import cash_sales_total_for_session, expected_cash_for_session


ZERO = Decimal("0.00")


class AdminReportView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get_date_range(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        return date_from, date_to

    def apply_date_filter(self, queryset, field_name, date_from, date_to):
        if date_from:
            queryset = queryset.filter(**{f"{field_name}__date__gte": date_from})
        if date_to:
            queryset = queryset.filter(**{f"{field_name}__date__lte": date_to})
        return queryset

    def apply_branch_filter(self, queryset, branch_field="branch"):
        branch_id = self.request.query_params.get("branch")
        if branch_id:
            queryset = queryset.filter(**{branch_field: branch_id})
        return queryset

    def apply_cashier_filter(self, queryset, cashier_field="cashier"):
        cashier_id = self.request.query_params.get("cashier")
        if cashier_id:
            queryset = queryset.filter(**{cashier_field: cashier_id})
        return queryset

    def money(self, value):
        return str(Decimal(value or ZERO).quantize(Decimal("0.01")))

    def branch_scope(self, request):
        branch_id = request.query_params.get("branch")
        if not branch_id:
            return {"branch": None, "branch_name": "Todas las sucursales"}

        branch = Branch.objects.filter(id=branch_id).first()
        return {
            "branch": branch_id,
            "branch_name": branch.name if branch else "Sucursal no encontrada",
        }


class SalesReportView(AdminReportView):
    def get(self, request):
        date_from, date_to = self.get_date_range(request)
        qs = Sale.objects.select_related("branch").filter(status=SaleStatus.CONFIRMED)
        qs = self.apply_date_filter(qs, "sold_at", date_from, date_to)
        qs = self.apply_branch_filter(qs)

        totals = qs.aggregate(
            sales_count=Count("id"),
            subtotal=Coalesce(
                Sum("subtotal"), Value(ZERO), output_field=DecimalField()
            ),
            tax=Coalesce(Sum("tax"), Value(ZERO), output_field=DecimalField()),
            total=Coalesce(Sum("total"), Value(ZERO), output_field=DecimalField()),
        )
        by_branch = (
            qs.values("branch_id", "branch__name")
            .annotate(
                sales_count=Count("id"),
                total=Coalesce(Sum("total"), Value(ZERO), output_field=DecimalField()),
            )
            .order_by("branch__name")
        )
        items = [
            {
                "id": str(sale.id),
                "branch": str(sale.branch_id),
                "branch_name": sale.branch.name,
                "payment_method": sale.payment_method,
                "subtotal": self.money(sale.subtotal),
                "tax": self.money(sale.tax),
                "total": self.money(sale.total),
                "sold_at": sale.sold_at.isoformat() if sale.sold_at else None,
            }
            for sale in qs.order_by("-sold_at", "-created_at")[:200]
        ]

        return Response(
            {
                "filters": {"date_from": date_from, "date_to": date_to},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "sales_count": totals["sales_count"],
                    "subtotal": self.money(totals["subtotal"]),
                    "tax": self.money(totals["tax"]),
                    "total": self.money(totals["total"]),
                },
                "by_branch": [
                    {
                        "branch": str(row["branch_id"]),
                        "branch_name": row["branch__name"],
                        "sales_count": row["sales_count"],
                        "total": self.money(row["total"]),
                    }
                    for row in by_branch
                ],
                "items": items,
            }
        )


class PurchasesReportView(AdminReportView):
    def get(self, request):
        date_from, date_to = self.get_date_range(request)
        qs = Purchase.objects.select_related("branch", "supplier").filter(
            status=PurchaseStatus.CONFIRMED
        )
        qs = self.apply_date_filter(qs, "purchased_at", date_from, date_to)
        qs = self.apply_branch_filter(qs)

        totals = qs.aggregate(
            purchases_count=Count("id"),
            total_cost=Coalesce(
                Sum("total_cost"), Value(ZERO), output_field=DecimalField()
            ),
        )
        by_branch = (
            qs.values("branch_id", "branch__name")
            .annotate(
                purchases_count=Count("id"),
                total_cost=Coalesce(
                    Sum("total_cost"), Value(ZERO), output_field=DecimalField()
                ),
            )
            .order_by("branch__name")
        )
        items = [
            {
                "id": str(purchase.id),
                "branch": str(purchase.branch_id),
                "branch_name": purchase.branch.name,
                "supplier": str(purchase.supplier_id),
                "supplier_name": purchase.supplier.name,
                "invoice_number": purchase.invoice_number,
                "total_cost": self.money(purchase.total_cost),
                "purchased_at": purchase.purchased_at.isoformat()
                if purchase.purchased_at
                else None,
            }
            for purchase in qs.order_by("-purchased_at", "-created_at")[:200]
        ]

        return Response(
            {
                "filters": {"date_from": date_from, "date_to": date_to},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "purchases_count": totals["purchases_count"],
                    "total_cost": self.money(totals["total_cost"]),
                },
                "by_branch": [
                    {
                        "branch": str(row["branch_id"]),
                        "branch_name": row["branch__name"],
                        "purchases_count": row["purchases_count"],
                        "total_cost": self.money(row["total_cost"]),
                    }
                    for row in by_branch
                ],
                "items": items,
            }
        )


class InventoryReportView(AdminReportView):
    def get(self, request):
        branch_id = request.query_params.get("branch")
        qs = Stock.objects.select_related(
            "branch", "product", "product__category"
        ).all()

        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        value_expression = ExpressionWrapper(
            F("qty_on_hand") * F("product__cost_price"),
            output_field=DecimalField(max_digits=18, decimal_places=2),
        )
        totals = qs.aggregate(
            sku_count=Count("id"),
            total_qty=Coalesce(
                Sum("qty_on_hand"), Value(ZERO), output_field=DecimalField()
            ),
            inventory_value=Coalesce(
                Sum(value_expression), Value(ZERO), output_field=DecimalField()
            ),
        )
        by_branch = (
            qs.values("branch_id", "branch__name")
            .annotate(
                sku_count=Count("id"),
                total_qty=Coalesce(
                    Sum("qty_on_hand"), Value(ZERO), output_field=DecimalField()
                ),
                inventory_value=Coalesce(
                    Sum(value_expression), Value(ZERO), output_field=DecimalField()
                ),
            )
            .order_by("branch__name")
        )
        items = []

        for stock in qs.annotate(inventory_value=value_expression).order_by(
            "branch__name", "product__sku"
        )[:500]:
            items.append(
                {
                    "branch": str(stock.branch_id),
                    "branch_name": stock.branch.name,
                    "product": str(stock.product_id),
                    "sku": stock.product.sku,
                    "name": stock.product.name,
                    "category_name": stock.product.category.name
                    if stock.product.category
                    else "",
                    "qty_on_hand": self.money(stock.qty_on_hand),
                    "unit_cost": self.money(stock.product.cost_price),
                    "sale_price": self.money(stock.product.sale_price),
                    "inventory_value": self.money(stock.inventory_value),
                    "is_below_min_stock": stock.qty_on_hand <= stock.product.min_stock,
                }
            )

        return Response(
            {
                "filters": {"branch": branch_id},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "sku_count": totals["sku_count"],
                    "total_qty": self.money(totals["total_qty"]),
                    "inventory_value": self.money(totals["inventory_value"]),
                },
                "by_branch": [
                    {
                        "branch": str(row["branch_id"]),
                        "branch_name": row["branch__name"],
                        "sku_count": row["sku_count"],
                        "total_qty": self.money(row["total_qty"]),
                        "inventory_value": self.money(row["inventory_value"]),
                    }
                    for row in by_branch
                ],
                "items": items,
            }
        )


class SalesByProductReportView(AdminReportView):
    def get(self, request):
        date_from, date_to = self.get_date_range(request)
        qs = SaleItem.objects.select_related(
            "sale", "sale__branch", "product", "product__category"
        ).filter(sale__status=SaleStatus.CONFIRMED)
        qs = self.apply_date_filter(qs, "sale__sold_at", date_from, date_to)
        qs = self.apply_branch_filter(qs, "sale__branch")

        totals = qs.aggregate(
            products_count=Count("product", distinct=True),
            units_sold=Coalesce(Sum("qty"), Value(ZERO), output_field=DecimalField()),
            total=Coalesce(Sum("subtotal"), Value(ZERO), output_field=DecimalField()),
        )
        rows = (
            qs.values(
                "product_id",
                "product__sku",
                "product__name",
                "product__category__name",
            )
            .annotate(
                sales_count=Count("sale", distinct=True),
                units_sold=Coalesce(
                    Sum("qty"), Value(ZERO), output_field=DecimalField()
                ),
                total=Coalesce(
                    Sum("subtotal"), Value(ZERO), output_field=DecimalField()
                ),
            )
            .order_by("-total", "product__name")[:500]
        )

        return Response(
            {
                "filters": {"date_from": date_from, "date_to": date_to},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "products_count": totals["products_count"],
                    "units_sold": self.money(totals["units_sold"]),
                    "total": self.money(totals["total"]),
                },
                "items": [
                    {
                        "product": str(row["product_id"]),
                        "sku": row["product__sku"],
                        "name": row["product__name"],
                        "category_name": row["product__category__name"]
                        or "Sin categoria",
                        "sales_count": row["sales_count"],
                        "units_sold": self.money(row["units_sold"]),
                        "total": self.money(row["total"]),
                    }
                    for row in rows
                ],
            }
        )


class SalesByCategoryReportView(AdminReportView):
    def get(self, request):
        date_from, date_to = self.get_date_range(request)
        qs = SaleItem.objects.select_related(
            "sale", "product", "product__category"
        ).filter(sale__status=SaleStatus.CONFIRMED)
        qs = self.apply_date_filter(qs, "sale__sold_at", date_from, date_to)
        qs = self.apply_branch_filter(qs, "sale__branch")

        totals = qs.aggregate(
            categories_count=Count("product__category", distinct=True),
            units_sold=Coalesce(Sum("qty"), Value(ZERO), output_field=DecimalField()),
            total=Coalesce(Sum("subtotal"), Value(ZERO), output_field=DecimalField()),
        )
        rows = (
            qs.values("product__category_id", "product__category__name")
            .annotate(
                products_count=Count("product", distinct=True),
                sales_count=Count("sale", distinct=True),
                units_sold=Coalesce(
                    Sum("qty"), Value(ZERO), output_field=DecimalField()
                ),
                total=Coalesce(
                    Sum("subtotal"), Value(ZERO), output_field=DecimalField()
                ),
            )
            .order_by("-total", "product__category__name")[:300]
        )

        return Response(
            {
                "filters": {"date_from": date_from, "date_to": date_to},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "categories_count": totals["categories_count"],
                    "units_sold": self.money(totals["units_sold"]),
                    "total": self.money(totals["total"]),
                },
                "items": [
                    {
                        "category": str(row["product__category_id"])
                        if row["product__category_id"]
                        else None,
                        "category_name": row["product__category__name"]
                        or "Sin categoria",
                        "products_count": row["products_count"],
                        "sales_count": row["sales_count"],
                        "units_sold": self.money(row["units_sold"]),
                        "total": self.money(row["total"]),
                    }
                    for row in rows
                ],
            }
        )


class CashRegisterMovementsReportView(AdminReportView):
    def get(self, request):
        date_from, date_to = self.get_date_range(request)
        qs = CashRegisterSession.objects.select_related("branch", "cashier").all()
        qs = self.apply_date_filter(qs, "opened_at", date_from, date_to)
        qs = self.apply_branch_filter(qs)
        qs = self.apply_cashier_filter(qs)

        sessions = list(qs.order_by("-business_date", "-opened_at")[:300])
        items = []
        total_opening = ZERO
        total_closing = ZERO
        total_expected = ZERO
        total_difference = ZERO
        open_count = 0
        closed_count = 0

        for session in sessions:
            cash_sales_total = cash_sales_total_for_session(session)
            expected_cash = expected_cash_for_session(session)
            difference = (
                Decimal(session.closing_amount or ZERO) - Decimal(expected_cash)
                if session.closing_amount is not None
                else None
            )
            cashier_name = session.cashier.get_full_name() or session.cashier.username
            total_opening += Decimal(session.opening_amount or ZERO)
            total_expected += Decimal(expected_cash or ZERO)

            if session.status == CashRegisterStatus.OPEN:
                open_count += 1
            else:
                closed_count += 1

            if session.closing_amount is not None:
                total_closing += Decimal(session.closing_amount or ZERO)
            if difference is not None:
                total_difference += difference

            base = {
                "session": str(session.id),
                "business_date": session.business_date.isoformat(),
                "branch": str(session.branch_id),
                "branch_name": session.branch.name,
                "cashier": str(session.cashier_id),
                "cashier_name": cashier_name,
                "opening_amount": self.money(session.opening_amount),
                "cash_sales_total": self.money(cash_sales_total),
                "expected_cash": self.money(expected_cash),
                "status": session.status,
            }
            items.append(
                {
                    **base,
                    "id": f"{session.id}-open",
                    "movement_type": "Apertura",
                    "movement_at": session.opened_at.isoformat() if session.opened_at else None,
                    "amount": self.money(session.opening_amount),
                    "closing_amount": "",
                    "difference": "",
                }
            )
            if session.closed_at:
                items.append(
                    {
                        **base,
                        "id": f"{session.id}-close",
                        "movement_type": "Cierre",
                        "movement_at": session.closed_at.isoformat(),
                        "amount": self.money(session.closing_amount),
                        "closing_amount": self.money(session.closing_amount),
                        "difference": self.money(difference),
                    }
                )

        return Response(
            {
                "filters": {
                    "date_from": date_from,
                    "date_to": date_to,
                    "cashier": request.query_params.get("cashier"),
                },
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "sessions_count": len(sessions),
                    "open_count": open_count,
                    "closed_count": closed_count,
                    "opening_amount": self.money(total_opening),
                    "closing_amount": self.money(total_closing),
                    "expected_cash": self.money(total_expected),
                    "difference": self.money(total_difference),
                },
                "items": items,
            }
        )


class PurchasesBySupplierReportView(AdminReportView):
    def get(self, request):
        date_from, date_to = self.get_date_range(request)
        qs = Purchase.objects.select_related("branch", "supplier").filter(
            status=PurchaseStatus.CONFIRMED
        )
        qs = self.apply_date_filter(qs, "purchased_at", date_from, date_to)
        qs = self.apply_branch_filter(qs)

        totals = qs.aggregate(
            suppliers_count=Count("supplier", distinct=True),
            purchases_count=Count("id"),
            total_cost=Coalesce(
                Sum("total_cost"), Value(ZERO), output_field=DecimalField()
            ),
        )
        rows = (
            qs.values("supplier_id", "supplier__name")
            .annotate(
                purchases_count=Count("id"),
                total_cost=Coalesce(
                    Sum("total_cost"), Value(ZERO), output_field=DecimalField()
                ),
            )
            .order_by("-total_cost", "supplier__name")[:300]
        )

        return Response(
            {
                "filters": {"date_from": date_from, "date_to": date_to},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "suppliers_count": totals["suppliers_count"],
                    "purchases_count": totals["purchases_count"],
                    "total_cost": self.money(totals["total_cost"]),
                },
                "items": [
                    {
                        "supplier": str(row["supplier_id"]),
                        "supplier_name": row["supplier__name"],
                        "purchases_count": row["purchases_count"],
                        "total_cost": self.money(row["total_cost"]),
                    }
                    for row in rows
                ],
            }
        )


class PurchasedProductsReportView(AdminReportView):
    def get(self, request):
        date_from, date_to = self.get_date_range(request)
        qs = PurchaseItem.objects.select_related(
            "purchase", "purchase__branch", "product", "product__category"
        ).filter(purchase__status=PurchaseStatus.CONFIRMED)
        qs = self.apply_date_filter(qs, "purchase__purchased_at", date_from, date_to)
        qs = self.apply_branch_filter(qs, "purchase__branch")

        totals = qs.aggregate(
            products_count=Count("product", distinct=True),
            units_purchased=Coalesce(
                Sum("qty"), Value(ZERO), output_field=DecimalField()
            ),
            total_cost=Coalesce(
                Sum("subtotal"), Value(ZERO), output_field=DecimalField()
            ),
        )
        rows = (
            qs.values(
                "product_id", "product__sku", "product__name", "product__category__name"
            )
            .annotate(
                purchases_count=Count("purchase", distinct=True),
                units_purchased=Coalesce(
                    Sum("qty"), Value(ZERO), output_field=DecimalField()
                ),
                total_cost=Coalesce(
                    Sum("subtotal"), Value(ZERO), output_field=DecimalField()
                ),
            )
            .order_by("-units_purchased", "-total_cost", "product__name")[:500]
        )

        return Response(
            {
                "filters": {"date_from": date_from, "date_to": date_to},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "products_count": totals["products_count"],
                    "units_purchased": self.money(totals["units_purchased"]),
                    "total_cost": self.money(totals["total_cost"]),
                },
                "items": [
                    {
                        "product": str(row["product_id"]),
                        "sku": row["product__sku"],
                        "name": row["product__name"],
                        "category_name": row["product__category__name"]
                        or "Sin categoria",
                        "purchases_count": row["purchases_count"],
                        "units_purchased": self.money(row["units_purchased"]),
                        "total_cost": self.money(row["total_cost"]),
                    }
                    for row in rows
                ],
            }
        )


class PurchasesVsSalesReportView(AdminReportView):
    def get(self, request):
        date_from, date_to = self.get_date_range(request)
        branch_id = request.query_params.get("branch")

        sales_qs = Sale.objects.filter(status=SaleStatus.CONFIRMED)
        purchases_qs = Purchase.objects.filter(status=PurchaseStatus.CONFIRMED)
        sales_qs = self.apply_date_filter(sales_qs, "sold_at", date_from, date_to)
        purchases_qs = self.apply_date_filter(
            purchases_qs, "purchased_at", date_from, date_to
        )

        if branch_id:
            sales_qs = sales_qs.filter(branch_id=branch_id)
            purchases_qs = purchases_qs.filter(branch_id=branch_id)

        sales_by_branch = {
            str(row["branch_id"]): row
            for row in sales_qs.values("branch_id", "branch__name").annotate(
                sales_count=Count("id"),
                sales_total=Coalesce(
                    Sum("total"), Value(ZERO), output_field=DecimalField()
                ),
            )
        }
        purchases_by_branch = {
            str(row["branch_id"]): row
            for row in purchases_qs.values("branch_id", "branch__name").annotate(
                purchases_count=Count("id"),
                purchases_total=Coalesce(
                    Sum("total_cost"), Value(ZERO), output_field=DecimalField()
                ),
            )
        }
        branch_ids = sorted(
            set(sales_by_branch.keys()) | set(purchases_by_branch.keys())
        )
        items = []

        for current_branch_id in branch_ids:
            sales_row = sales_by_branch.get(current_branch_id, {})
            purchases_row = purchases_by_branch.get(current_branch_id, {})
            sales_total = Decimal(sales_row.get("sales_total") or ZERO)
            purchases_total = Decimal(purchases_row.get("purchases_total") or ZERO)
            items.append(
                {
                    "branch": current_branch_id,
                    "branch_name": sales_row.get("branch__name")
                    or purchases_row.get("branch__name"),
                    "sales_count": sales_row.get("sales_count", 0),
                    "sales_total": self.money(sales_total),
                    "purchases_count": purchases_row.get("purchases_count", 0),
                    "purchases_total": self.money(purchases_total),
                    "difference": self.money(sales_total - purchases_total),
                }
            )

        total_sales = sales_qs.aggregate(
            total=Coalesce(Sum("total"), Value(ZERO), output_field=DecimalField())
        )["total"]
        total_purchases = purchases_qs.aggregate(
            total=Coalesce(Sum("total_cost"), Value(ZERO), output_field=DecimalField())
        )["total"]

        return Response(
            {
                "filters": {"date_from": date_from, "date_to": date_to},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "sales_total": self.money(total_sales),
                    "purchases_total": self.money(total_purchases),
                    "difference": self.money(
                        Decimal(total_sales or ZERO) - Decimal(total_purchases or ZERO)
                    ),
                },
                "items": items,
            }
        )


class CriticalStockReportView(AdminReportView):
    def get(self, request):
        qs = Stock.objects.select_related(
            "branch", "product", "product__category"
        ).filter(qty_on_hand__lte=F("product__min_stock"))
        qs = self.apply_branch_filter(qs)

        items = [
            {
                "branch": str(stock.branch_id),
                "branch_name": stock.branch.name,
                "product": str(stock.product_id),
                "sku": stock.product.sku,
                "name": stock.product.name,
                "category_name": stock.product.category.name
                if stock.product.category
                else "Sin categoria",
                "qty_on_hand": self.money(stock.qty_on_hand),
                "min_stock": self.money(stock.product.min_stock),
                "shortage": self.money(stock.product.min_stock - stock.qty_on_hand),
            }
            for stock in qs.order_by("branch__name", "qty_on_hand", "product__sku")[
                :500
            ]
        ]

        return Response(
            {
                "filters": {"branch": request.query_params.get("branch")},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {"critical_count": len(items)},
                "items": items,
            }
        )


class InventoryValueReportView(InventoryReportView):
    pass


class InventoryByBranchReportView(AdminReportView):
    def get(self, request):
        branch_id = request.query_params.get("branch")
        qs = Stock.objects.select_related("branch", "product").all()
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        value_expression = ExpressionWrapper(
            F("qty_on_hand") * F("product__cost_price"),
            output_field=DecimalField(max_digits=18, decimal_places=2),
        )
        rows = (
            qs.values("branch_id", "branch__name")
            .annotate(
                sku_count=Count("id"),
                total_qty=Coalesce(
                    Sum("qty_on_hand"), Value(ZERO), output_field=DecimalField()
                ),
                inventory_value=Coalesce(
                    Sum(value_expression), Value(ZERO), output_field=DecimalField()
                ),
                critical_count=Count(
                    "id", filter=Q(qty_on_hand__lte=F("product__min_stock"))
                ),
            )
            .order_by("branch__name")
        )

        totals = qs.aggregate(
            sku_count=Count("id"),
            total_qty=Coalesce(
                Sum("qty_on_hand"), Value(ZERO), output_field=DecimalField()
            ),
            inventory_value=Coalesce(
                Sum(value_expression), Value(ZERO), output_field=DecimalField()
            ),
            critical_count=Count(
                "id", filter=Q(qty_on_hand__lte=F("product__min_stock"))
            ),
        )

        return Response(
            {
                "filters": {"branch": branch_id},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "sku_count": totals["sku_count"],
                    "total_qty": self.money(totals["total_qty"]),
                    "inventory_value": self.money(totals["inventory_value"]),
                    "critical_count": totals["critical_count"],
                },
                "items": [
                    {
                        "branch": str(row["branch_id"]),
                        "branch_name": row["branch__name"],
                        "sku_count": row["sku_count"],
                        "total_qty": self.money(row["total_qty"]),
                        "inventory_value": self.money(row["inventory_value"]),
                        "critical_count": row["critical_count"],
                    }
                    for row in rows
                ],
            }
        )


class InventoryMovementsReportView(AdminReportView):
    def get(self, request):
        date_from, date_to = self.get_date_range(request)
        qs = StockMovement.objects.select_related("branch", "product").all()
        qs = self.apply_date_filter(qs, "created_at", date_from, date_to)
        qs = self.apply_branch_filter(qs)

        totals = qs.aggregate(
            movements_count=Count("id"),
            in_qty=Coalesce(
                Sum("qty", filter=Q(type=StockMovement.Type.IN)),
                Value(ZERO),
                output_field=DecimalField(),
            ),
            out_qty=Coalesce(
                Sum("qty", filter=Q(type=StockMovement.Type.OUT)),
                Value(ZERO),
                output_field=DecimalField(),
            ),
        )

        items = [
            {
                "id": str(movement.id),
                "created_at": movement.created_at.isoformat()
                if movement.created_at
                else None,
                "branch": str(movement.branch_id),
                "branch_name": movement.branch.name,
                "product": str(movement.product_id),
                "sku": movement.product.sku,
                "name": movement.product.name,
                "type": movement.type,
                "qty": self.money(movement.qty),
                "stock_before": self.money(movement.stock_before),
                "stock_after": self.money(movement.stock_after),
                "reference_type": movement.reference_type,
                "reference_id": movement.reference_id,
                "unit_cost": self.money(movement.unit_cost),
            }
            for movement in qs.order_by("-created_at", "-id")[:500]
        ]

        return Response(
            {
                "filters": {"date_from": date_from, "date_to": date_to},
                "scope": self.branch_scope(request),
                "generated_at": timezone.now().isoformat(),
                "summary": {
                    "movements_count": totals["movements_count"],
                    "in_qty": self.money(totals["in_qty"]),
                    "out_qty": self.money(totals["out_qty"]),
                },
                "items": items,
            }
        )
