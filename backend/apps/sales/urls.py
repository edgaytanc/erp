from rest_framework.routers import DefaultRouter
from .views import SalesHealthViewSet

router = DefaultRouter()
router.register(r"sales/health", SalesHealthViewSet, basename="sales-health")

urlpatterns = router.urls
