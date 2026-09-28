from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.inventory.views import PosRecommendationView
from .views import CashRegisterViewSet, SaleViewSet

router = DefaultRouter()
router.register(r"sales", SaleViewSet, basename="sales")
router.register(r"cash-register", CashRegisterViewSet, basename="cash-register")

urlpatterns = router.urls + [
    path("pos/recommendations/", PosRecommendationView.as_view(), name="sales-pos-recommendations"),
]
