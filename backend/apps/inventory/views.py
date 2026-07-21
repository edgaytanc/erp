from __future__ import annotations

import csv
import io
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Count, F, Max, Q, Sum
from django.http import HttpResponse
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser
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

    @action(
        detail=False,
        methods=["post"],
        url_path="import-csv",
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_csv(self, request):
        csv_file = request.FILES.get("file")
        if not csv_file:
            return Response(
                {"error": "No se proporcionó ningún archivo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not csv_file.name.endswith(".csv"):
            return Response(
                {"error": "El archivo debe tener formato CSV (.csv)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            file_data = csv_file.read().decode("utf-8-sig")
            io_string = io.StringIO(file_data)
            reader = csv.DictReader(io_string)
        except Exception as e:
            return Response(
                {"error": f"Error al leer el archivo: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        required_cols = {"sku", "name", "sale_price"}
        headers = {h.strip().lower() for h in reader.fieldnames if h} if reader.fieldnames else set()

        missing_cols = required_cols - headers
        if missing_cols:
            return Response(
                {
                    "error": f"El archivo CSV no contiene las columnas obligatorias: {', '.join(missing_cols)}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        errors = []
        products_to_save = []
        seen_skus = set()
        seen_barcodes = set()

        for index, row in enumerate(reader, start=2):
            row_sku = (row.get("sku") or "").strip().upper()
            row_name = (row.get("name") or "").strip()
            row_sale_price_str = (row.get("sale_price") or "").strip()
            row_cost_price_str = (row.get("cost_price") or "0.00").strip()
            row_min_stock_str = (row.get("min_stock") or "0.00").strip()
            row_barcode = (row.get("barcode") or "").strip()
            row_description = (row.get("description") or "").strip()
            row_category_name = (row.get("category") or row.get("category_name") or "").strip()
            row_is_active_str = (row.get("is_active") or "true").strip().lower()

            row_errors = []
            if not row_sku:
                row_errors.append("El campo 'sku' es obligatorio.")
            elif row_sku in seen_skus:
                row_errors.append(f"El SKU '{row_sku}' está duplicado en el archivo.")
            else:
                seen_skus.add(row_sku)

            if not row_name:
                row_errors.append("El campo 'name' es obligatorio.")

            sale_price = None
            try:
                sale_price = Decimal(row_sale_price_str)
                if sale_price < 0:
                    row_errors.append("El campo 'sale_price' no puede ser negativo.")
            except (ValueError, InvalidOperation):
                row_errors.append("El campo 'sale_price' debe ser un número válido.")

            cost_price = Decimal("0.00")
            if row_cost_price_str:
                try:
                    cost_price = Decimal(row_cost_price_str)
                    if cost_price < 0:
                        row_errors.append("El campo 'cost_price' no puede ser negativo.")
                except (ValueError, InvalidOperation):
                    row_errors.append("El campo 'cost_price' debe ser un número válido.")

            min_stock = Decimal("0.00")
            if row_min_stock_str:
                try:
                    min_stock = Decimal(row_min_stock_str)
                    if min_stock < 0:
                        row_errors.append("El campo 'min_stock' no puede ser negativo.")
                except (ValueError, InvalidOperation):
                    row_errors.append("El campo 'min_stock' debe ser un número válido.")

            if row_barcode:
                if row_barcode in seen_barcodes:
                    row_errors.append(f"El código de barras '{row_barcode}' está duplicado en el archivo.")
                else:
                    seen_barcodes.add(row_barcode)
                    conflicting_product = (
                        Product.objects.filter(barcode=row_barcode).exclude(sku=row_sku).first()
                    )
                    if conflicting_product:
                        row_errors.append(
                            f"El código de barras '{row_barcode}' ya está registrado en el producto '{conflicting_product.sku}'."
                        )

            is_active = row_is_active_str not in ("false", "0", "no", "inactive")

            if row_errors:
                errors.append({"linea": index, "sku": row_sku or "N/A", "errores": row_errors})
            else:
                products_to_save.append(
                    {
                        "sku": row_sku,
                        "name": row_name,
                        "sale_price": sale_price,
                        "cost_price": cost_price,
                        "min_stock": min_stock,
                        "barcode": row_barcode or None,
                        "description": row_description,
                        "category_name": row_category_name,
                        "is_active": is_active,
                    }
                )

        if errors:
            return Response(
                {"error": "El archivo contiene errores de validación.", "detalles": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not products_to_save:
            return Response(
                {"error": "El archivo no contiene filas de datos para procesar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                imported_count = 0
                updated_count = 0
                category_cache = {}

                for item in products_to_save:
                    category_obj = None
                    c_name = item["category_name"]
                    if c_name:
                        if c_name not in category_cache:
                            cat = Category.objects.filter(name__iexact=c_name).first()
                            if not cat:
                                cat = Category.objects.create(name=c_name)
                            category_cache[c_name] = cat
                        category_obj = category_cache[c_name]

                    product, created = Product.objects.get_or_create(
                        sku=item["sku"],
                        defaults={
                            "name": item["name"],
                            "sale_price": item["sale_price"],
                            "cost_price": item["cost_price"],
                            "min_stock": item["min_stock"],
                            "barcode": item["barcode"],
                            "description": item["description"],
                            "category": category_obj,
                            "is_active": item["is_active"],
                        },
                    )

                    if not created:
                        product.name = item["name"]
                        product.sale_price = item["sale_price"]
                        product.cost_price = item["cost_price"]
                        product.min_stock = item["min_stock"]
                        product.barcode = item["barcode"]
                        product.description = item["description"]
                        if category_obj:
                            product.category = category_obj
                        product.is_active = item["is_active"]
                        product.save()
                        updated_count += 1
                    else:
                        imported_count += 1

            return Response(
                {
                    "mensaje": "Carga masiva finalizada con éxito.",
                    "creados": imported_count,
                    "actualizados": updated_count,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": f"Error al procesar la base de datos: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["get"], url_path="sample-csv")
    def sample_csv(self, request):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="productos_muestra.csv"'
        response.write(b"\xef\xbb\xbf")
        writer = csv.writer(response)
        writer.writerow(
            [
                "sku",
                "name",
                "description",
                "sale_price",
                "cost_price",
                "min_stock",
                "category",
                "barcode",
                "is_active",
            ]
        )
        writer.writerow(
            [
                "PROD001",
                "Coca Cola 350ml",
                "Lata de Coca Cola de 350ml",
                "1.50",
                "1.00",
                "10.00",
                "Bebidas",
                "7401005123456",
                "true",
            ]
        )
        writer.writerow(
            [
                "PROD002",
                "Papas Fritas Naturales",
                "Bolsa de papas fritas naturales 50g",
                "2.00",
                "1.30",
                "15.00",
                "Snacks",
                "7401005123457",
                "true",
            ]
        )
        writer.writerow(
            [
                "PROD003",
                "Agua Purificada 500ml",
                "Botella de agua purificada",
                "1.00",
                "0.50",
                "20.00",
                "Bebidas",
                "",
                "true",
            ]
        )
        return response


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
