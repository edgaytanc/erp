from __future__ import annotations

import csv
import io
import re
import uuid
from decimal import Decimal, InvalidOperation

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db import transaction
from django.db.models import (
    Case,
    Count,
    DecimalField,
    F,
    Max,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Sum,
    TextField,
    Value,
    When,
)
from django.db.models.functions import Coalesce, Concat
from django.http import HttpResponse
from rest_framework import mixins, status, views, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.permissions import ModuleRolePermission
from apps.core.models import Branch

from .models import (
    Category,
    Product,
    ProductBenefit,
    SkinType,
    Stock,
    StockMovement,
    TargetProblem,
)
from .serializers import (
    CategorySerializer,
    ProductRecommendationSerializer,
    ProductSerializer,
    StockMovementSerializer,
    StockSerializer,
)
from .services import (
    InventoryService,
    initialize_product_stocks,
    register_adjustment,
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

    def _get_branch_id(self) -> str | None:
        """
        Determina el branch_id del contexto actual:
        1. Query param 'branch_id' o 'branch'.
        2. Sucursal asignada al usuario autenticado (user.branch_id o user.branch).
        """
        request = self.request
        if not request:
            return None
        branch_param = request.query_params.get("branch_id") or request.query_params.get("branch")
        if branch_param:
            return str(branch_param).strip()
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            if getattr(user, "branch_id", None):
                return str(user.branch_id)
            if getattr(user, "branch", None):
                return str(user.branch.id)
        return None

    def get_queryset(self):
        branch_id = self._get_branch_id()

        # Construir subquery y prefetch optimizados para evitar problemas de N+1 queries
        if branch_id:
            stock_subquery = Stock.objects.filter(
                product_id=OuterRef("pk"),
                branch_id=branch_id,
            ).values("sale_price")[:1]

            branch_stock_prefetch = Prefetch(
                "stocks",
                queryset=Stock.objects.filter(branch_id=branch_id),
                to_attr="prefetched_branch_stocks",
            )
        else:
            stock_subquery = Stock.objects.filter(
                product_id=OuterRef("pk"),
            ).values("sale_price")[:1]

            branch_stock_prefetch = Prefetch(
                "stocks",
                queryset=Stock.objects.all(),
                to_attr="prefetched_branch_stocks",
            )

        qs = (
            Product.objects.select_related("category")
            .prefetch_related(branch_stock_prefetch)
            .annotate(
                sale_price=Coalesce(
                    Subquery(stock_subquery),
                    Value(None, output_field=DecimalField(max_digits=12, decimal_places=2, null=True)),
                    output_field=DecimalField(max_digits=12, decimal_places=2, null=True),
                )
            )
        )

        category_id = self.request.query_params.get("category")
        is_active = self.request.query_params.get("is_active")
        sku = self.request.query_params.get("sku")
        barcode = self.request.query_params.get("barcode")
        name = self.request.query_params.get("name")
        skin_type = self.request.query_params.get("skin_type")
        q = self.request.query_params.get("q")
        search = self.request.query_params.get("search")

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

        if name:
            qs = qs.filter(name__icontains=name)

        if skin_type:
            qs = qs.filter(skin_type=skin_type)

        search_term = q or search
        if search_term:
            qs = qs.filter(
                Q(name__icontains=search_term)
                | Q(sku__icontains=search_term)
                | Q(barcode__icontains=search_term)
                | Q(description__icontains=search_term)
                | Q(keywords__icontains=search_term)
            )

        needs_pricing = self.request.query_params.get("needs_pricing")
        if needs_pricing in ("1", "true", "True"):
            qs = qs.filter(
                Q(sale_price__lte=Decimal("0.00"))
                | Q(cost_price__lte=Decimal("0.00"))
                | Q(sale_price__isnull=True)
                | Q(cost_price__isnull=True)
            )

        return qs.order_by(*self.ordering)

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        product.is_active = False
        product.save(update_fields=["is_active", "updated_at"])
        return Response(status=204)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        # Validación estricta de permisos si se intenta actualizar el sale_price
        if "sale_price" in request.data:
            user = request.user
            if not (user and user.is_authenticated):
                return Response(
                    {"detail": "Las credenciales de autenticación no fueron provistas."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Debe tener rol de Administrador
            is_admin = getattr(user, "is_admin", lambda: False)()
            if not is_admin:
                return Response(
                    {"detail": "Solo los administradores tienen permiso para modificar el precio de venta."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Determinar la sucursal a la que se aplicará el cambio de precio
            branch_id = (
                request.query_params.get("branch_id")
                or request.query_params.get("branch")
                or request.data.get("branch_id")
                or request.data.get("branch")
                or getattr(user, "branch_id", None)
                or (user.branch.id if getattr(user, "branch", None) else None)
            )

            # Si el usuario es administrador asignado a una sucursal específica (no superusuario),
            # no puede modificar precios de otra sucursal
            if not user.is_superuser and getattr(user, "branch_id", None):
                if branch_id and str(branch_id) != str(user.branch_id):
                    return Response(
                        {"detail": "No tienes permiso para modificar el precio de una sucursal distinta a la tuya."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
                branch_id = user.branch_id

            target_branch = None
            if branch_id:
                try:
                    target_branch = Branch.objects.filter(id=branch_id, is_active=True).first()
                except Exception:
                    target_branch = None

            if not target_branch:
                target_branch = Branch.objects.filter(is_active=True).first()

            if not target_branch:
                return Response(
                    {"detail": "No se encontró una sucursal activa para asignar el precio."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validar valor decimal de sale_price
            new_sale_price_raw = request.data.get("sale_price")
            try:
                new_sale_price = Decimal(str(new_sale_price_raw))
                if new_sale_price < Decimal("0.00"):
                    return Response(
                        {"sale_price": ["El precio de venta no puede ser negativo."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except (ValueError, TypeError, InvalidOperation):
                return Response(
                    {"sale_price": ["El precio de venta debe ser un número decimal válido."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Actualizar únicamente el registro relacional (Stock) de ESA sucursal específica
            stock, _ = Stock.objects.get_or_create(
                branch=target_branch,
                product=instance,
                defaults={"qty_on_hand": Decimal("0.00"), "sale_price": new_sale_price},
            )
            stock.sale_price = new_sale_price
            stock.save(update_fields=["sale_price", "updated_at"])

            # Actualizar en memoria en instance
            instance.sale_price = new_sale_price

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="needs-pricing")
    def needs_pricing(self, request):
        """
        GET /api/inventory/products/needs-pricing/
        Retorna los productos activos que requieren actualización de precios (precio_venta <= 0 o precio_costo <= 0).
        """
        qs = (
            self.get_queryset()
            .filter(
                Q(sale_price__lte=Decimal("0.00"))
                | Q(cost_price__lte=Decimal("0.00"))
                | Q(sale_price__isnull=True)
                | Q(cost_price__isnull=True)
            )
            .filter(is_active=True)
            .order_by("-created_at")
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="attribute-choices")
    def attribute_choices(self, request):
        """
        GET /api/inventory/products/attribute-choices/
        Retorna el diccionario de opciones disponibles para SkinType, TargetProblem y ProductBenefit.
        """
        return Response(
            {
                "skin_types": [{"value": val, "label": lbl} for val, lbl in SkinType.choices],
                "target_problems": [{"value": val, "label": lbl} for val, lbl in TargetProblem.choices],
                "benefits": [{"value": val, "label": lbl} for val, lbl in ProductBenefit.choices],
            },
            status=status.HTTP_200_OK,
        )

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
                    "error": f"El archivo CSV no contiene las columnas obligatorias: {', '.join(sorted(missing_cols))}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        errors = []
        products_to_save = []
        seen_skus = set()
        seen_barcodes = set()

        valid_skin_types = set(SkinType.values)
        valid_problems = set(TargetProblem.values)
        valid_benefits = set(ProductBenefit.values)

        for index, row in enumerate(reader, start=2):
            row_sku = (row.get("sku") or "").strip().upper()
            row_name = (row.get("name") or "").strip()
            row_sale_price_str = (row.get("sale_price") or "").strip()
            row_cost_price_str = (row.get("cost_price") or "0.00").strip()
            row_min_stock_str = (row.get("min_stock") or "0.00").strip()
            row_barcode = (row.get("barcode") or "").strip()
            row_description = (row.get("description") or "").strip()
            row_category_name = (row.get("category") or row.get("category_name") or "").strip()
            row_skin_type_raw = row.get("skin_type")
            row_target_problems_raw = row.get("target_problems")
            row_benefits_raw = row.get("benefits")
            row_keywords = (row.get("keywords") or "").strip()
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

            # Manejo de opcionales y Arrays semánticos para el motor de búsqueda
            if row_skin_type_raw is not None and str(row_skin_type_raw).strip():
                clean_skin_type = str(row_skin_type_raw).strip()
                skin_type = clean_skin_type.upper() if clean_skin_type.upper() in valid_skin_types else clean_skin_type
            else:
                skin_type = ""

            target_problems = []
            if row_target_problems_raw is not None and str(row_target_problems_raw).strip():
                for p in str(row_target_problems_raw).split(","):
                    p_clean = p.strip()
                    if p_clean:
                        p_val = p_clean.upper() if p_clean.upper() in valid_problems else p_clean
                        if p_val not in target_problems:
                            target_problems.append(p_val)

            benefits = []
            if row_benefits_raw is not None and str(row_benefits_raw).strip():
                for b in str(row_benefits_raw).split(","):
                    b_clean = b.strip()
                    if b_clean:
                        b_val = b_clean.upper() if b_clean.upper() in valid_benefits else b_clean
                        if b_val not in benefits:
                            benefits.append(b_val)

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
                        "skin_type": skin_type,
                        "target_problems": target_problems,
                        "benefits": benefits,
                        "keywords": row_keywords,
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
                active_branches = list(Branch.objects.filter(is_active=True))

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
                            "cost_price": item["cost_price"],
                            "min_stock": item["min_stock"],
                            "barcode": item["barcode"],
                            "description": item["description"],
                            "category": category_obj,
                            "skin_type": item["skin_type"],
                            "target_problems": item["target_problems"],
                            "benefits": item["benefits"],
                            "keywords": item["keywords"],
                            "is_active": item["is_active"],
                        },
                    )

                    suggested_price = (
                        item["sale_price"]
                        if item["sale_price"] is not None and item["sale_price"] > Decimal("0.00")
                        else (item["cost_price"] or Decimal("0.00"))
                    )

                    if not created:
                        product.name = item["name"]
                        product.cost_price = item["cost_price"]
                        product.min_stock = item["min_stock"]
                        product.barcode = item["barcode"]
                        product.description = item["description"]
                        if item["skin_type"]:
                            product.skin_type = item["skin_type"]
                        if item["target_problems"]:
                            product.target_problems = item["target_problems"]
                        if item["benefits"]:
                            product.benefits = item["benefits"]
                        if item["keywords"]:
                            product.keywords = item["keywords"]
                        if category_obj:
                            product.category = category_obj
                        product.is_active = item["is_active"]
                        product.save()

                        # En actualización: actualizar o crear los registros relacionales de Stock
                        for branch in active_branches:
                            stock, s_created = Stock.objects.get_or_create(
                                branch=branch,
                                product=product,
                                defaults={
                                    "qty_on_hand": Decimal("0.00"),
                                    "sale_price": suggested_price,
                                },
                            )
                            if not s_created and item["sale_price"] is not None:
                                stock.sale_price = suggested_price
                                stock.save(update_fields=["sale_price", "updated_at"])

                        updated_count += 1
                    else:
                        # Al crear un Product nuevo, iterar sobre todas las sucursales activas
                        # y crear el registro relacional (Stock) con el precio sugerido o de costo
                        initialize_product_stocks(
                            product=product,
                            suggested_sale_price=suggested_price,
                        )
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
                "skin_type",
                "target_problems",
                "benefits",
                "is_active",
            ]
        )
        writer.writerow(
            [
                "PROD001",
                "Gel Limpiador Facial Ácido Salicílico",
                "Limpiador espumoso para poros y control de grasa.",
                "125.00",
                "75.00",
                "10.00",
                "Cuidado Facial",
                "7401005123456",
                "GRASA",
                "ACNE, ROJEZ",
                "SEBOCONT, CALMANTE",
                "true",
            ]
        )
        writer.writerow(
            [
                "PROD002",
                "Detergente Líquido Multiusos Desinfectante",
                "Limpiador desinfectante concentrado para pisos y superficies.",
                "45.00",
                "25.00",
                "15.00",
                "Limpieza",
                "7401005123457",
                "TODO",
                "SUCIEDAD, MAL_OLOR",
                "LIMPIEZA, AROMA",
                "true",
            ]
        )
        writer.writerow(
            [
                "PROD003",
                "Shampoo Fortificante Anti-Caída",
                "Estimula el folículo capilar y frena la caída.",
                "85.00",
                "45.00",
                "20.00",
                "Cuidado Capilar",
                "",
                "CAB_GRASO",
                "CAIDA, CASPA",
                "ESTIMCAP",
                "true",
            ]
        )
        return response

    @action(
        detail=False,
        methods=["post"],
        url_path="import-stock-csv",
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_stock_csv(self, request):
        return StockViewSet._handle_import_stock_csv(request)

    @action(detail=False, methods=["get"], url_path="sample-stock-csv")
    def sample_stock_csv(self, request):
        return StockViewSet._handle_sample_stock_csv(request)


class PosRecommendationView(views.APIView):
    """
    GET /api/pos/recommendations/?q=<texto>&branch_id=<UUID>
    Busca semánticamente productos recomendados en base a PostgreSQL Full-Text Search
    (SearchVector, SearchQuery, SearchRank) ponderando nombre, keywords, beneficios,
    problemas específicos, tipo de piel y descripción.
    Filtra estrictamente por productos con stock > 0 en la sucursal indicada y los ordena por SearchRank descendente.
    """
    module_name = "sales"
    permission_classes = [ModuleRolePermission]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        branch_id = request.query_params.get("branch_id") or request.query_params.get("branch")

        if not branch_id:
            return Response(
                {"detail": "El parámetro 'branch_id' es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not q:
            return Response([], status=status.HTTP_200_OK)

        # Subquery para obtener la cantidad exacta de stock disponible en la sucursal indicada
        stock_subquery = Stock.objects.filter(
            branch_id=branch_id,
            product_id=OuterRef("pk"),
        ).values("qty_on_hand")[:1]

        # Subquery para obtener el precio de venta en la sucursal indicada
        price_subquery = Stock.objects.filter(
            branch_id=branch_id,
            product_id=OuterRef("pk"),
        ).values("sale_price")[:1]

        # Filtro estricto: producto activo y con stock > 0 en la sucursal indicada
        qs = (
            Product.objects.filter(
                is_active=True,
                stocks__branch_id=branch_id,
                stocks__qty_on_hand__gt=Decimal("0.00"),
            )
            .annotate(
                stock_qty=Subquery(stock_subquery),
                sale_price=Subquery(price_subquery),
            )
            .distinct()
        )

        # Construcción de representaciones legibles para los TextChoices (SkinType, TargetProblem, ProductBenefit)
        skin_type_cases = [
            When(skin_type=choice.value, then=Value(f"{choice.label} {choice.value} "))
            for choice in SkinType
        ]
        skin_type_expr = Case(*skin_type_cases, default=Value(""), output_field=TextField())

        target_problem_cases = [
            Case(
                When(target_problems__contains=[choice.value], then=Value(f"{choice.label} {choice.value} ")),
                default=Value(""),
                output_field=TextField(),
            )
            for choice in TargetProblem
        ]
        target_problems_expr = Concat(*target_problem_cases, output_field=TextField())

        benefit_cases = [
            Case(
                When(benefits__contains=[choice.value], then=Value(f"{choice.label} {choice.value} ")),
                default=Value(""),
                output_field=TextField(),
            )
            for choice in ProductBenefit
        ]
        benefits_expr = Concat(*benefit_cases, output_field=TextField())

        # Anotación de los textos legibles combinados
        qs = qs.annotate(
            _search_skin_type=skin_type_expr,
            _search_target_problems=target_problems_expr,
            _search_benefits=benefits_expr,
        )

        # SearchVector con ponderaciones estratégicas de PostgreSQL:
        # Peso A: Nombre del producto y palabras clave (keywords)
        # Peso B: Beneficios, problemas objetivo y tipo de piel (con sus representaciones legibles)
        # Peso C: Descripción del producto
        search_vector = (
            SearchVector("name", weight="A", config="spanish")
            + SearchVector("keywords", weight="A", config="spanish")
            + SearchVector("_search_benefits", weight="B", config="spanish")
            + SearchVector("_search_target_problems", weight="B", config="spanish")
            + SearchVector("_search_skin_type", weight="B", config="spanish")
            + SearchVector("description", weight="C", config="spanish")
        )

        # Tokenización de términos significativos para soportar consultas conversacionales
        tokens = [
            t.strip()
            for t in re.findall(r"[\wáéíóúüñÁÉÍÓÚÜÑ]+", q, flags=re.UNICODE)
            if len(t.strip()) >= 2
        ]

        search_query_web = SearchQuery(q, config="spanish", search_type="websearch")
        if tokens:
            token_query = SearchQuery(tokens[0], config="spanish")
            for token in tokens[1:]:
                token_query = token_query | SearchQuery(token, config="spanish")
            combined_query = search_query_web | token_query
        else:
            combined_query = search_query_web

        # Cálculo de SearchRank y filtrado de resultados relevantes
        ranked_qs = (
            qs.annotate(
                search_vector=search_vector,
                rank=SearchRank(search_vector, combined_query),
            )
            .filter(rank__gt=0.0001)
            .order_by("-rank", "name")
        )

        limit_raw = request.query_params.get("limit", "20")
        try:
            limit = max(1, min(int(limit_raw), 50))
        except ValueError:
            limit = 20

        serializer = ProductRecommendationSerializer(ranked_qs[:limit], many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


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
    ordering_fields = ["qty_on_hand", "sale_price", "product__sku", "product__name", "updated_at"]
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

    @action(
        detail=False,
        methods=["post"],
        url_path="import-stock-csv",
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_stock_csv(self, request):
        return self._handle_import_stock_csv(request)

    @action(detail=False, methods=["get"], url_path="sample-stock-csv")
    def sample_stock_csv(self, request):
        return self._handle_sample_stock_csv(request)

    @staticmethod
    def _handle_import_stock_csv(request):
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

        if not reader.fieldnames:
            return Response(
                {"error": "El archivo CSV está vacío o no contiene encabezados válidos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Normalizar nombres de columnas a minúsculas sin espacios
        reader.fieldnames = [h.strip().lower() for h in reader.fieldnames if h is not None]
        headers = set(reader.fieldnames)
        required_cols = {"sku", "branch_id", "physical_qty"}

        missing_cols = required_cols - headers
        if missing_cols:
            return Response(
                {
                    "error": f"El archivo CSV no contiene las columnas obligatorias: {', '.join(sorted(missing_cols))}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        errors = []
        rows_to_process = []
        seen_keys = set()
        product_cache = {}
        branch_cache = {}

        for index, row in enumerate(reader, start=2):
            if not any(v and str(v).strip() for v in row.values()):
                continue

            row_sku = (row.get("sku") or "").strip()
            row_branch_id = (row.get("branch_id") or "").strip()
            row_qty_str = (row.get("physical_qty") or "").strip()
            row_note = (row.get("note") or "").strip()

            row_errors = []

            if not row_sku:
                row_errors.append("El campo 'sku' es obligatorio.")

            if not row_branch_id:
                row_errors.append("El campo 'branch_id' es obligatorio.")

            physical_qty = None
            if not row_qty_str:
                row_errors.append("El campo 'physical_qty' es obligatorio.")
            else:
                try:
                    physical_qty = Decimal(row_qty_str)
                    if physical_qty < Decimal("0.00"):
                        row_errors.append("El campo 'physical_qty' debe ser mayor o igual a 0.")
                except (ValueError, InvalidOperation):
                    row_errors.append("El campo 'physical_qty' debe ser un número válido.")

            if row_sku and row_branch_id:
                key = (row_sku.upper(), row_branch_id.lower())
                if key in seen_keys:
                    row_errors.append(
                        f"El producto con SKU '{row_sku}' y sucursal '{row_branch_id}' está duplicado en el archivo."
                    )
                else:
                    seen_keys.add(key)

            product = None
            if row_sku:
                sku_upper = row_sku.upper()
                if sku_upper not in product_cache:
                    product_cache[sku_upper] = Product.objects.filter(sku__iexact=row_sku).first()
                product = product_cache[sku_upper]
                if not product:
                    row_errors.append(f"No existe el producto con SKU '{row_sku}'.")

            branch = None
            if row_branch_id:
                branch_key = row_branch_id.lower()
                if branch_key not in branch_cache:
                    try:
                        uuid.UUID(row_branch_id)
                        branch_cache[branch_key] = Branch.objects.filter(id=row_branch_id).first()
                    except (ValueError, AttributeError):
                        branch_cache[branch_key] = None
                branch = branch_cache[branch_key]
                if not branch:
                    row_errors.append(f"No existe la sucursal con ID '{row_branch_id}'.")

            if row_errors:
                errors.append({"linea": index, "sku": row_sku or "N/A", "errores": row_errors})
            else:
                rows_to_process.append(
                    {
                        "product": product,
                        "branch": branch,
                        "physical_qty": physical_qty,
                        "note": row_note,
                    }
                )

        if errors:
            return Response(
                {"error": "El archivo contiene errores de validación.", "detalles": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not rows_to_process:
            return Response(
                {"error": "El archivo no contiene filas de datos para procesar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                adjusted_count = 0
                unchanged_count = 0

                for item in rows_to_process:
                    prod = item["product"]
                    br = item["branch"]
                    phys_qty = item["physical_qty"]
                    item_note = item["note"]

                    stock = InventoryService.get_or_create_stock(prod, br)
                    difference = Decimal(str(phys_qty)) - stock.qty_on_hand

                    if difference != Decimal("0.00"):
                        register_adjustment(
                            branch=br,
                            product=prod,
                            qty=difference,
                            created_by=request.user if request.user and request.user.is_authenticated else None,
                            note=item_note or "Inventario Físico / Ajuste por CSV",
                        )
                        adjusted_count += 1
                    else:
                        unchanged_count += 1

            return Response(
                {
                    "mensaje": "Carga masiva de inventario físico finalizada con éxito.",
                    "ajustados": adjusted_count,
                    "sin_cambios": unchanged_count,
                    "total": len(rows_to_process),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": f"Error al procesar el ajuste de inventario: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @staticmethod
    def _handle_sample_stock_csv(request):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="inventario_fisico_muestra.csv"'
        response.write(b"\xef\xbb\xbf")
        writer = csv.writer(response)
        writer.writerow(["sku", "branch_id", "physical_qty", "note"])

        sample_branch = Branch.objects.filter(is_active=True).first()
        branch_id_example = str(sample_branch.id) if sample_branch else "00000000-0000-0000-0000-000000000000"

        sample_prod = Product.objects.filter(is_active=True).first()
        sample_sku = sample_prod.sku if sample_prod else "PROD001"

        writer.writerow([sample_sku, branch_id_example, "50.00", "Inventario Inicial 2026"])
        writer.writerow(["PROD002", branch_id_example, "120.00", "Conteo físico bodega principal"])
        return response
