from __future__ import annotations

from django.db.models import Count, F, Max, Q, Sum
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.accounts.permissions import ModuleRolePermission

from .models import Category, Product, Stock, StockMovement
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    StockMovementSerializer,
    StockSerializer,
)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200


class CategoryViewSet(viewsets.ModelViewSet):
    module_name = "inventory"
    permission_classes = [ModuleRolePermission]
    serializer_class = CategorySerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [OrderingFilter]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = Category.objects.select_related("parent").annotate(children_count=Count("children"))

        parent_id = self.request.query_params.get("parent")
        is_active = self.request.query_params.get("is_active")
        root_only = self.request.query_params.get("root_only")
        q = self.request.query_params.get("q")

        if parent_id:
            qs = qs.filter(parent_id=parent_id)

        if is_active in ("1", "true", "True"):
            qs = qs.filter(is_active=True)
        elif is_active in ("0", "false", "False"):
            qs = qs.filter(is_active=False)

        if root_only in ("1", "true", "True"):
            qs = qs.filter(parent__isnull=True)

        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(parent__name__icontains=q))

        return qs.order_by(*self.ordering)


class ProductViewSet(viewsets.ModelViewSet):
    module_name = "inventory"
    permission_classes = [ModuleRolePermission]
    serializer_class = ProductSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [OrderingFilter]
    ordering_fields = ["name", "sku", "sale_price", "cost_price", "created_at", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = Product.objects.select_related("category").all()

        category_id = self.request.query_params.get("category")
        is_active = self.request.query_params.get("is_active")
        sku = self.request.query_params.get("sku")
        barcode = self.request.query_params.get("barcode")
        q = self.request.query_params.get("q")

        if category_id:
            qs = qs.filter(category_id=category_id)

        if is_active in ("1", "true", "True"):
            qs = qs.filter(is_active=True)
        elif is_active in ("0", "false", "False"):
            qs = qs.filter(is_active=False)

        if sku:
            qs = qs.filter(sku__icontains=sku)

        if barcode:
            qs = qs.filter(barcode__icontains=barcode)

        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(sku__icontains=q)
                | Q(barcode__icontains=q)
                | Q(description__icontains=q)
            )

        return qs.order_by(*self.ordering)

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        product.is_active = False
        product.save(update_fields=["is_active", "updated_at"])
        return Response(status=204)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    module_name = "inventory"
    permission_classes = [ModuleRolePermission]
    queryset = StockMovement.objects.select_related("branch", "product").all().order_by("-created_at")
    serializer_class = StockMovementSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [OrderingFilter]
    ordering_fields = ["created_at", "qty", "type", "product__sku"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()

        branch_id = self.request.query_params.get("branch")
        product_id = self.request.query_params.get("product")
        ref_type = self.request.query_params.get("reference_type")
        ref_id = self.request.query_params.get("reference_id")
        movement_type = self.request.query_params.get("type")

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if product_id:
            qs = qs.filter(product_id=product_id)
        if ref_type:
            qs = qs.filter(reference_type=ref_type)
        if ref_id:
            qs = qs.filter(reference_id=ref_id)
        if movement_type:
            qs = qs.filter(type=movement_type)

        return qs


class StockViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    module_name = "inventory"
    permission_classes = [ModuleRolePermission]
    serializer_class = StockSerializer
    queryset = Stock.objects.select_related("branch", "product", "product__category").all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [OrderingFilter]
    ordering_fields = ["qty_on_hand", "product__sku", "product__name", "updated_at"]
    ordering = ["product__sku"]

    def get_queryset(self):
        qs = super().get_queryset()

        branch_id = self.request.query_params.get("branch")
        product_id = self.request.query_params.get("product")
        sku = self.request.query_params.get("sku")
        q = self.request.query_params.get("q")
        low = self.request.query_params.get("low")

        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        if product_id:
            qs = qs.filter(product_id=product_id)

        if sku:
            qs = qs.filter(product__sku__icontains=sku)

        if q:
            qs = qs.filter(Q(product__sku__icontains=q) | Q(product__name__icontains=q))

        if low in ("1", "true", "True", "yes", "YES"):
            qs = qs.filter(qty_on_hand__lte=F("product__min_stock"))

        return qs

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        branch_id = request.query_params.get("branch")
        if not branch_id:
            return Response(
                {"detail": "El parámetro 'branch' es requerido. Ej: ?branch=<UUID>"},
                status=400,
            )

        limit_raw = request.query_params.get("limit", "10")
        try:
            limit = int(limit_raw)
        except ValueError:
            limit = 10
        limit = max(1, min(limit, 50))

        qs = Stock.objects.select_related("product").filter(branch_id=branch_id)
        low_stock_qs = qs.filter(qty_on_hand__lte=F("product__min_stock"))

        total_skus = qs.aggregate(total=Count("id"))["total"] or 0
        total_qty = qs.aggregate(total=Sum("qty_on_hand"))["total"] or 0
        low_stock_count = low_stock_qs.count()
        last_updated_at = qs.aggregate(last=Max("updated_at"))["last"]

        lowest = (
            qs.order_by("qty_on_hand", "product__sku")
            .values(
                "product_id",
                "product__sku",
                "product__name",
                "product__min_stock",
                "qty_on_hand",
                "updated_at",
            )[:limit]
        )

        lowest_items = []
        for row in lowest:
            lowest_items.append(
                {
                    "product": str(row["product_id"]),
                    "sku": row["product__sku"],
                    "name": row["product__name"],
                    "min_stock": str(row["product__min_stock"]),
                    "qty_on_hand": str(row["qty_on_hand"]),
                    "is_below_min_stock": row["qty_on_hand"] <= row["product__min_stock"],
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                }
            )

        payload = {
            "branch": branch_id,
            "total_skus": int(total_skus),
            "total_qty": str(total_qty),
            "low_stock_count": int(low_stock_count),
            "last_updated_at": last_updated_at.isoformat() if last_updated_at else None,
            "lowest_items": lowest_items,
        }
        return Response(payload, status=200)
