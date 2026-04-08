import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from apps.core.models import TimeStampedModel, Branch
from apps.inventory.models import Product


class Supplier(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    name = models.CharField(max_length=255, db_index=True)
    contact_name = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="")
    address = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "purchases_supplier"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class PurchaseStatus(models.TextChoices):
    DRAFT = "DRAFT", "DRAFT"
    CONFIRMED = "CONFIRMED", "CONFIRMED"
    CANCELLED = "CANCELLED", "CANCELLED"


class Purchase(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="purchases")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchases")

    invoice_number = models.CharField(max_length=64, blank=True, default="", db_index=True)
    status = models.CharField(max_length=12, choices=PurchaseStatus.choices, default=PurchaseStatus.DRAFT, db_index=True)

    purchased_at = models.DateTimeField(null=True, blank=True, db_index=True)
    total_cost = models.DecimalField(
        max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))], default=Decimal("0.00")
    )
    cancelled_at = models.DateTimeField(null=True, blank=True, db_index=True)
    cancel_reason = models.TextField(blank=True, default="")

    class Meta:
        db_table = "purchases_purchase"
        indexes = [
            models.Index(fields=["branch", "purchased_at"], name="ix_purchase_branch_dt"),
            models.Index(fields=["supplier", "purchased_at"], name="ix_purchase_supplier_dt"),
            models.Index(fields=["branch", "cancelled_at"], name="ix_purchase_branch_cancel_dt"),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Compra {self.id} - {self.status}"


class PurchaseItem(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="purchase_items")

    qty = models.DecimalField(max_digits=14, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))])
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])

    class Meta:
        db_table = "purchases_purchase_item"
        indexes = [
            models.Index(fields=["purchase"], name="ix_purchase_item_purchase"),
            models.Index(fields=["product"], name="ix_purchase_item_product"),
        ]

    def __str__(self) -> str:
        return f"{self.product_id} x {self.qty}"