from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from apps.core.models import Branch, Company
from .models import CompanySettings
from .serializers import (
    BranchSerializer,
    CompanySerializer,
    CompanySettingsSerializer,
    PublicCompanyBrandingSerializer,
)


class AdminConfigPermissionMixin:
    permission_classes = [IsAuthenticated, IsAdminRole]


class CompanyViewSet(AdminConfigPermissionMixin, viewsets.ModelViewSet):
    queryset = Company.objects.all().order_by("name")
    serializer_class = CompanySerializer


class PublicCompanyBrandingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        company = Company.objects.order_by("created_at", "name").first()

        if not company:
            return Response({"name": "ERP", "logo": ""})

        return Response(PublicCompanyBrandingSerializer(company).data)


class BranchViewSet(AdminConfigPermissionMixin, viewsets.ModelViewSet):
    serializer_class = BranchSerializer

    def get_queryset(self):
        qs = Branch.objects.select_related("company").all().order_by("name")
        company_id = self.request.query_params.get("company")
        is_active = self.request.query_params.get("is_active")

        if company_id:
            qs = qs.filter(company_id=company_id)

        if is_active in ("1", "true", "True"):
            qs = qs.filter(is_active=True)
        elif is_active in ("0", "false", "False"):
            qs = qs.filter(is_active=False)

        return qs


class CompanySettingsViewSet(AdminConfigPermissionMixin, viewsets.ModelViewSet):
    serializer_class = CompanySettingsSerializer

    def get_queryset(self):
        qs = CompanySettings.objects.select_related("company").all().order_by("company__name")
        company_id = self.request.query_params.get("company")

        if company_id:
            qs = qs.filter(company_id=company_id)

        return qs
