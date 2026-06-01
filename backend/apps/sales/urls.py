from rest_framework.routers import DefaultRouter
from .views import CashRegisterViewSet, SaleViewSet

router = DefaultRouter()
router.register(r"sales", SaleViewSet, basename="sales")
router.register(r"cash-register", CashRegisterViewSet, basename="cash-register")

urlpatterns = router.urls
