from rest_framework.routers import DefaultRouter
from .views import PurchasesHealthViewSet

router = DefaultRouter()
router.register(r"purchases/health", PurchasesHealthViewSet, basename="purchases-health")

urlpatterns = router.urls
