from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, StockMovementViewSet, StockViewSet

router = DefaultRouter()
router.register(r"inventory/products", ProductViewSet, basename="products")
router.register(r"inventory/movements", StockMovementViewSet, basename="movements")
router.register(r"inventory/stocks", StockViewSet, basename="stocks")

urlpatterns = router.urls
