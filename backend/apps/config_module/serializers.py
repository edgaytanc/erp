from rest_framework import serializers

from apps.core.models import Branch, Company
from .models import CompanySettings


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "tax_id",
            "address",
            "phone",
            "logo",
            "receipt_header",
            "receipt_footer",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PublicCompanyBrandingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["name", "logo"]


class BranchSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = Branch
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "address",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company_name", "created_at", "updated_at"]


class CompanySettingsSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = CompanySettings
        fields = [
            "id",
            "company",
            "company_name",
            "currency_code",
            "currency_symbol",
            "tax_rate",
            "money_rounding",
            "sale_void_window_minutes",
            "max_cash_sessions_per_day",
            "logo_url",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company_name", "created_at", "updated_at"]
