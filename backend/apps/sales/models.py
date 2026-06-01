import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import Branch, TimeStampedModel
from apps.inventory.models import Product


class SaleStatus(models.TextChoices):
    DRAFT = "DRAFT", "DRAFT"
    CONFIRMED = "CONFIRMED", "CONFIRMED"
    VOID = "VOID", "VOID"


class CashRegisterStatus(models.TextChoices):
    OPEN = "OPEN", "OPEN"
    CLOSED = "CLOSED", "CLOSED"


class CashRegisterSession(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="cash_sessions")
    cashier = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cash_sessions",
    )
    business_date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=12,
        choices=CashRegisterStatus.choices,
        default=CashRegisterStatus.OPEN,
        db_index=True,
    )
    opening_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    closing_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        null=True,
        blank=True,
    )
    opened_at = models.DateTimeField(db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "sales_cash_register_session"
        ordering = ["-opened_at"]
        indexes = [
            models.Index(fields=["branch", "business_date"], name="ix_cash_branch_date"),
            models.Index(fields=["cashier", "business_date"], name="ix_cash_cashier_date"),
            models.Index(fields=["status", "opened_at"], name="ix_cash_status_opened"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "cashier", "business_date"],
                name="uq_cash_session_daily_cashier",
            ),
        ]

    def __str__(self) -> str:
        return f"Caja {self.branch_id} - {self.cashier_id} - {self.business_date}"


class Sale(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="sales")
    cashier_id = models.BigIntegerField(db_index=True)

    status = models.CharField(
        max_length=12,
        choices=SaleStatus.choices,
        default=SaleStatus.DRAFT,
        db_index=True,
    )
    payment_method = models.CharField(max_length=32, blank=True, default="")

    subtotal = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        default=Decimal("0.00"),
    )
    tax = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        default=Decimal("0.00"),
    )
    total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        default=Decimal("0.00"),
    )

    sold_at = models.DateTimeField(null=True, blank=True, db_index=True)
    voided_at = models.DateTimeField(null=True, blank=True, db_index=True)
    void_reason = models.TextField(blank=True, default="")

    class Meta:
        db_table = "sales_sale"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["branch", "sold_at"], name="ix_sale_branch_dt"),
            models.Index(fields=["cashier_id", "sold_at"], name="ix_sale_cashier_dt"),
            models.Index(fields=["branch", "voided_at"], name="ix_sale_branch_void_dt"),
        ]

    def __str__(self) -> str:
        return f"Venta {self.id} - {self.status}"


class SaleItem(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="sale_items")

    qty = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    subtotal = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        db_table = "sales_sale_item"
        indexes = [
            models.Index(fields=["sale"], name="ix_sale_item_sale"),
            models.Index(fields=["product"], name="ix_sale_item_product"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["sale", "product"], name="uq_sale_item_sale_product"),
        ]

    def __str__(self) -> str:
        return f"{self.product_id} x {self.qty}"
