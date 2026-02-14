import uuid
from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator

from apps.core.models import TimeStampedModel, Branch


class Category(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    name = models.CharField(max_length=255, db_index=True)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="children",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "inventory_category"
        unique_together = [("parent", "name")]

    def __str__(self) -> str:
        return self.name


class Product(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    category = models.ForeignKey(
        Category,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="products",
    )

    sku = models.CharField(max_length=64, unique=True, db_index=True)
    barcode = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )

    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, default="")

    # Precio de venta con IVA incluido (según tu negocio)
    sale_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        default=Decimal("0.00"),
    )
    min_stock = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        default=Decimal("0.00"),
    )

    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "inventory_product"
        indexes = [
            models.Index(fields=["name"], name="ix_product_name"),
            models.Index(fields=["category"], name="ix_product_category"),
        ]

    def __str__(self) -> str:
        return f"{self.sku} - {self.name}"


class Stock(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name="stocks",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="stocks",
    )

    qty_on_hand = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.000"))],
        default=Decimal("0.000"),
    )

    class Meta:
        db_table = "inventory_stock"
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "product"],
                name="uq_stock_branch_product",
            ),
        ]
        indexes = [
            models.Index(fields=["branch", "product"], name="ix_stock_branch_product"),
        ]

    def __str__(self) -> str:
        return f"{self.branch_id} {self.product_id} = {self.qty_on_hand}"


class MovementType(models.TextChoices):
    IN_ = "IN", "IN"
    OUT = "OUT", "OUT"
    ADJUST = "ADJUST", "ADJUST"
    VOID = "VOID", "VOID"


class ReferenceType(models.TextChoices):
    SALE = "SALE", "SALE"
    PURCHASE = "PURCHASE", "PURCHASE"
    ADJUSTMENT = "ADJUSTMENT", "ADJUSTMENT"
    VOID = "VOID", "VOID"


class StockMovement(TimeStampedModel):
    """
    Mantengo este nombre porque tu API ya lo usa:
    from .models import Product, StockMovement

    Tabla física: inventory_movement
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name="movements",
        null=True,
        blank=True,
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="movements",
    )

    type = models.CharField(
        max_length=12,
        choices=MovementType.choices,
        db_index=True,
    )
    qty = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )

    unit_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        null=True,
        blank=True,
    )

    reference_type = models.CharField(
        max_length=16,
        choices=ReferenceType.choices,
        db_index=True,
    )
    reference_id = models.UUIDField(null=True, blank=True, db_index=True)

    note = models.TextField(blank=True, default="")

    class Meta:
        db_table = "inventory_movement"
        indexes = [
            models.Index(fields=["branch", "product", "created_at"], name="ix_mov_branch_prod_dt"),
            models.Index(fields=["reference_type", "reference_id"], name="ix_mov_ref"),
        ]

    def __str__(self) -> str:
        return f"{self.type} {self.qty} {self.product_id} @ {self.branch_id}"
