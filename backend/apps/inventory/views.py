from __future__ import annotations

from django.db.models import Q, Sum, Count, Max
from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response

from apps.accounts.permissions import ModuleRolePermission
from .models import Product, Stock, StockMovement
from .serializers import ProductSerializer, StockSerializer, StockMovementSerializer


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200


class ProductViewSet(viewsets.ModelViewSet):
    module_name = "inventory"
    permission_classes = [ModuleRolePermission]
    queryset = Product.objects.all().order_by("id")
    serializer_class = ProductSerializer


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Movimientos: solo lectura (auditoría).
    """
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

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if product_id:
            qs = qs.filter(product_id=product_id)
        if ref_type:
            qs = qs.filter(reference_type=ref_type)
        if ref_id:
            qs = qs.filter(reference_id=ref_id)

        return qs


class StockViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    ✅ Consulta de stock (solo lectura) + resumen

    GET /api/inventory/stocks/
    Filtros:
      - branch=<uuid>
      - product=<uuid>
      - sku=<texto>
      - q=<texto> (busca en sku o name)
      - low=1  (solo qty_on_hand <= 0)
    Orden:
      - ordering=qty_on_hand | -qty_on_hand | product__sku | product__name
    Paginación:
      - page=1
      - page_size=20
    """
    module_name = "inventory"
    permission_classes = [ModuleRolePermission]
    serializer_class = StockSerializer
    queryset = Stock.objects.select_related("branch", "product").all()

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
            qs = qs.filter(qty_on_hand__lte=0)

        return qs

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """
        GET /api/inventory/stocks/summary/?branch=<uuid>&limit=10

        Resumen para dashboard/alertas:
        - total_skus
        - total_qty
        - low_or_zero_count
        - last_updated_at (Max(updated_at))
        - lowest_items (top N por qty_on_hand asc)
        """
        branch_id = request.query_params.get("branch")
        if not branch_id:
            return Response(
                {"detail": "El parámetro 'branch' es requerido. Ej: ?branch=<UUID>"},
                status=400,
            )

        # limit para el top de bajos
        limit_raw = request.query_params.get("limit", "10")
        try:
            limit = int(limit_raw)
        except ValueError:
            limit = 10
        limit = max(1, min(limit, 50))  # mínimo 1, máximo 50

        qs = Stock.objects.select_related("product").filter(branch_id=branch_id)

        total_skus = qs.aggregate(total=Count("id"))["total"] or 0
        total_qty = qs.aggregate(total=Sum("qty_on_hand"))["total"] or 0
        low_or_zero_count = qs.filter(qty_on_hand__lte=0).count()
        last_updated_at = qs.aggregate(last=Max("updated_at"))["last"]

        lowest = (
            qs.order_by("qty_on_hand", "product__sku")
            .values("product_id", "product__sku", "product__name", "qty_on_hand", "updated_at")
            [:limit]
        )

        lowest_items = []
        for row in lowest:
            lowest_items.append(
                {
                    "product": str(row["product_id"]),
                    "sku": row["product__sku"],
                    "name": row["product__name"],
                    "qty_on_hand": str(row["qty_on_hand"]),
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                }
            )

        payload = {
            "branch": branch_id,
            "total_skus": int(total_skus),
            "total_qty": str(total_qty),
            "low_or_zero_count": int(low_or_zero_count),
            "last_updated_at": last_updated_at.isoformat() if last_updated_at else None,
            "lowest_items": lowest_items,
        }
        return Response(payload, status=200)
