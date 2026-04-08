from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import Branch, TimeStampedModel


class Category(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    name = models.CharField(max_length=120)
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="children",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "inventory_category"
        ordering = ["name"]
        unique_together = [("parent", "name")]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["parent", "is_active"]),
        ]

    def clean(self):
        current = self.parent
        while current is not None:
            if current.pk == self.pk:
                raise ValidationError("No se permite crear ciclos entre categorías.")
            current = current.parent

    def __str__(self) -> str:
        return self.name


class Product(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
        null=True,
        blank=True,
    )
    sku = models.CharField(max_length=60, unique=True)
    barcode = models.CharField(max_length=100, blank=True, null=True, unique=True)
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True, default="")
    sale_price = models.DecimalField(max_digits=12, decimal_places=2)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    min_stock = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "inventory_product"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["sku"]),
            models.Index(fields=["name"]),
            models.Index(fields=["category", "is_active"]),
        ]

    def clean(self):
        if self.sale_price < 0:
            raise ValidationError({"sale_price": "El precio de venta no puede ser negativo."})
        if self.cost_price < 0:
            raise ValidationError({"cost_price": "El precio de costo no puede ser negativo."})
        if self.min_stock < 0:
            raise ValidationError({"min_stock": "El stock mínimo no puede ser negativo."})

    def save(self, *args, **kwargs):
        self.sku = (self.sku or "").strip().upper()
        if self.barcode == "":
            self.barcode = None
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.sku} - {self.name}"


class ReferenceType(models.TextChoices):
    PURCHASE = "PURCHASE", "Compra"
    SALE = "SALE", "Venta"
    SALE_VOID = "SALE_VOID", "Anulación de venta"
    ADJUSTMENT = "ADJUSTMENT", "Ajuste"
    INITIAL = "INITIAL", "Stock inicial"
    TRANSFER = "TRANSFER", "Transferencia"
    SYSTEM = "SYSTEM", "Sistema"


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
    qty_on_hand = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        db_table = "inventory_stock"
        ordering = ["branch__name", "product__name"]
        unique_together = [("branch", "product")]
        indexes = [
            models.Index(fields=["branch", "product"]),
            models.Index(fields=["product"]),
        ]

    def __str__(self) -> str:
        return f"{self.branch} | {self.product} | {self.qty_on_hand}"


class StockMovement(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Type(models.TextChoices):
        IN = "IN", "Entrada"
        OUT = "OUT", "Salida"

    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    type = models.CharField(max_length=10, choices=Type.choices)
    qty = models.DecimalField(max_digits=14, decimal_places=2)
    stock_before = models.DecimalField(max_digits=14, decimal_places=2)
    stock_after = models.DecimalField(max_digits=14, decimal_places=2)
    reference_type = models.CharField(max_length=30, choices=ReferenceType.choices)
    reference_id = models.CharField(max_length=64, null=True, blank=True)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="inventory_movements_created",
        null=True,
        blank=True,
    )
    note = models.TextField(blank=True, default="")

    class Meta:
        db_table = "inventory_movement"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["branch", "product"]),
            models.Index(fields=["reference_type", "reference_id"]),
            models.Index(fields=["type"]),
            models.Index(fields=["created_at"]),
        ]

    def clean(self):
        if self.qty <= 0:
            raise ValidationError({"qty": "La cantidad del movimiento debe ser mayor que cero."})

    def __str__(self) -> str:
        return f"{self.get_type_display()} | {self.product} | {self.qty}"