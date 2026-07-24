import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

from apps.core.models import TimeStampedModel, Company


class CompanySettings(TimeStampedModel):
    """
    Configuración mínima por empresa.

    tax_rate: tasa IVA en formato decimal:
      - 0.12 => 12%
      - 0.00 => sin IVA

    sale_void_window_minutes:
      - Ventana (minutos) para que el rol Sales pueda anular una venta.
      - Admin siempre puede anular (regla de negocio).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    company = models.OneToOneField(
        Company,
        on_delete=models.CASCADE,
        related_name="settings",
    )

    currency_code = models.CharField(max_length=3, default="GTQ", db_index=True)
    currency_symbol = models.CharField(max_length=8, default="Q")

    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=Decimal("0.1200"),
        validators=[
            MinValueValidator(Decimal("0.0000")),
            MaxValueValidator(Decimal("1.0000")),
        ],
        help_text="Tasa IVA. Ej: 0.1200 = 12%",
    )

    money_rounding = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        default=Decimal("0.0100"),
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text="Redondeo monetario. Ej: 0.0100 = 2 decimales",
    )

    # ✅ NUEVO: ventana de anulación para Sales
    sale_void_window_minutes = models.PositiveIntegerField(
        default=10,
        validators=[MinValueValidator(0), MaxValueValidator(1440)],
        help_text="Minutos para que Sales pueda anular una venta confirmada. 0 = no puede anular.",
    )

    max_cash_sessions_per_day = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Número máximo de aperturas/cierres de caja por día.",
    )

    logo_url = models.URLField(
        max_length=512,
        blank=True,
        default="",
        help_text="URL del logo de la empresa para visualización en el ticket/recibo.",
    )

    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "config_company_settings"

    def __str__(self) -> str:
        return f"Settings {self.company.name}"
