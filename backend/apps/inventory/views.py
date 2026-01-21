from rest_framework import viewsets
from .models import Product, StockMovement
from .serializers import ProductSerializer, StockMovementSerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by("id")
    serializer_class = ProductSerializer


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related("product").all().order_by("-occurred_at")
    serializer_class = StockMovementSerializer
