from __future__ import annotations

from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from apps.inventory.models import Stock
from apps.purchases.models import Purchase, PurchaseStatus
from apps.sales.models import Sale, SaleStatus


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

    def money(self, value):
        return str(Decimal(value or ZERO).quantize(Decimal("0.01")))


class SalesReportView(AdminReportView):
    def get(self, request):
        date_from, date_to = self.get_date_range(request)
        qs = Sale.objects.select_related("branch").filter(status=SaleStatus.CONFIRMED)
        qs = self.apply_date_filter(qs, "sold_at", date_from, date_to)

        totals = qs.aggregate(
            sales_count=Count("id"),
            subtotal=Coalesce(Sum("subtotal"), Value(ZERO), output_field=DecimalField()),
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
        qs = Purchase.objects.select_related("branch", "supplier").filter(status=PurchaseStatus.CONFIRMED)
        qs = self.apply_date_filter(qs, "purchased_at", date_from, date_to)

        totals = qs.aggregate(
            purchases_count=Count("id"),
            total_cost=Coalesce(Sum("total_cost"), Value(ZERO), output_field=DecimalField()),
        )
        by_branch = (
            qs.values("branch_id", "branch__name")
            .annotate(
                purchases_count=Count("id"),
                total_cost=Coalesce(Sum("total_cost"), Value(ZERO), output_field=DecimalField()),
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
                "purchased_at": purchase.purchased_at.isoformat() if purchase.purchased_at else None,
            }
            for purchase in qs.order_by("-purchased_at", "-created_at")[:200]
        ]

        return Response(
            {
                "filters": {"date_from": date_from, "date_to": date_to},
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
        qs = Stock.objects.select_related("branch", "product", "product__category").all()

        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        value_expression = ExpressionWrapper(
            F("qty_on_hand") * F("product__cost_price"),
            output_field=DecimalField(max_digits=18, decimal_places=2),
        )
        totals = qs.aggregate(
            sku_count=Count("id"),
            total_qty=Coalesce(Sum("qty_on_hand"), Value(ZERO), output_field=DecimalField()),
            inventory_value=Coalesce(Sum(value_expression), Value(ZERO), output_field=DecimalField()),
        )
        by_branch = (
            qs.values("branch_id", "branch__name")
            .annotate(
                sku_count=Count("id"),
                total_qty=Coalesce(Sum("qty_on_hand"), Value(ZERO), output_field=DecimalField()),
                inventory_value=Coalesce(Sum(value_expression), Value(ZERO), output_field=DecimalField()),
            )
            .order_by("branch__name")
        )
        items = []

        for stock in qs.annotate(inventory_value=value_expression).order_by("branch__name", "product__sku")[:500]:
            items.append(
                {
                    "branch": str(stock.branch_id),
                    "branch_name": stock.branch.name,
                    "product": str(stock.product_id),
                    "sku": stock.product.sku,
                    "name": stock.product.name,
                    "category_name": stock.product.category.name if stock.product.category else "",
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
