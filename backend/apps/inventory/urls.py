from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, StockMovementViewSet

router = DefaultRouter()
router.register(r"inventory/products", ProductViewSet, basename="products")
router.register(r"inventory/movements", StockMovementViewSet, basename="movements")

urlpatterns = router.urls
