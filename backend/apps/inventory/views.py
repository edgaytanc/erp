from rest_framework import viewsets
from apps.accounts.permissions import ModuleRolePermission
from .models import Product, StockMovement
from .serializers import ProductSerializer, StockMovementSerializer


class ProductViewSet(viewsets.ModelViewSet):
    """
    Módulo: inventory
    - Admin: full
    - Purchases: SOLO lectura
    - Sales: sin acceso
    """
    module_name = "inventory"
    permission_classes = [ModuleRolePermission]

    queryset = Product.objects.all().order_by("id")
    serializer_class = ProductSerializer


class StockMovementViewSet(viewsets.ModelViewSet):
    """
    Módulo: inventory
    - Admin: full
    - Purchases: SOLO lectura
    - Sales: sin acceso
    """
    module_name = "inventory"
    permission_classes = [ModuleRolePermission]

    queryset = StockMovement.objects.select_related("product").all().order_by("-occurred_at")
    serializer_class = StockMovementSerializer
