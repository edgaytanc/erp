from __future__ import annotations

from decimal import Decimal
from django.core.cache import cache

from apps.core.models import Company
from .models import CompanySettings


DEFAULT_TAX_RATE = Decimal("0.1200")
DEFAULT_ROUNDING = Decimal("0.0100")
DEFAULT_SALE_VOID_WINDOW_MINUTES = 10


def get_company_settings(company: Company) -> CompanySettings | None:
    key = f"company_settings:{company.id}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    settings = CompanySettings.objects.filter(company=company, is_active=True).first()
    cache.set(key, settings, 60)
    return settings


def get_tax_rate(company: Company) -> Decimal:
    settings = get_company_settings(company)
    return settings.tax_rate if settings else DEFAULT_TAX_RATE


def get_money_rounding(company: Company) -> Decimal:
    settings = get_company_settings(company)
    return settings.money_rounding if settings else DEFAULT_ROUNDING


def get_sale_void_window_minutes(company: Company) -> int:
    settings = get_company_settings(company)
    if not settings:
        return DEFAULT_SALE_VOID_WINDOW_MINUTES
    return int(settings.sale_void_window_minutes)
