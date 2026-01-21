# backend/apps/inventory/models.py
from django.db import models


class Product(models.Model):
    sku = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    unit = models.CharField(max_length=20, default="unidad")  # unidad, lb, caja, etc.

    # Precio de venta (IVA incluido según negocio; ventas lo manejará, aquí solo guardamos el precio)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.sku} - {self.name}"


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        PURCHASE = "PURCHASE", "Compra"
        SALE = "SALE", "Venta"
        SALE_VOID = "SALE_VOID", "Anulación de venta"
        ADJUST = "ADJUST", "Ajuste"
        IN = "IN", "Entrada"
        OUT = "OUT", "Salida"

    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="movements")
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)

    # Cantidad positiva SIEMPRE.
    # El efecto en stock lo define movement_type (venta resta, compra suma, anulación suma, etc.)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)

    # Referencia opcional (luego se conectará con ventas/compras)
    reference = models.CharField(max_length=100, blank=True, default="")

    note = models.TextField(blank=True, default="")
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["product", "occurred_at"]),
            models.Index(fields=["movement_type"]),
        ]

    def __str__(self):
        return f"{self.movement_type} {self.product.sku} x {self.quantity}"
