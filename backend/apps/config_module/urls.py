from rest_framework.routers import DefaultRouter

from .views import BranchViewSet, CompanySettingsViewSet, CompanyViewSet

router = DefaultRouter()
router.register(r"config/companies", CompanyViewSet, basename="config-companies")
router.register(r"config/branches", BranchViewSet, basename="config-branches")
router.register(r"config/company-settings", CompanySettingsViewSet, basename="config-company-settings")

urlpatterns = router.urls
