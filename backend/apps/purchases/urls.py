from rest_framework.routers import DefaultRouter
from .views import PurchaseViewSet, SupplierViewSet

router = DefaultRouter()
router.register(r"purchases", PurchaseViewSet, basename="purchases")
router.register(r"suppliers", SupplierViewSet, basename="suppliers")

urlpatterns = router.urls
