from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, ProductViewSet, StockMovementViewSet, StockViewSet

router = DefaultRouter()
router.register(r"inventory/categories", CategoryViewSet, basename="inventory-categories")
router.register(r"inventory/products", ProductViewSet, basename="inventory-products")
router.register(r"inventory/movements", StockMovementViewSet, basename="inventory-movements")
router.register(r"inventory/stocks", StockViewSet, basename="inventory-stocks")

urlpatterns = router.urls