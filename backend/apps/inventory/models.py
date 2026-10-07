from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import Branch, TimeStampedModel


class SkinType(models.TextChoices):
    # Cuidado Personal
    GRASA = "GRASA", "Piel Grasa"
    SECA = "SECA", "Piel Seca"
    MIXTA = "MIXTA", "Piel Mixta"
    SENS = "SENS", "Piel Sensible"
    NORM = "NORM", "Piel Normal"
    CAB_GRASO = "CAB_GRASO", "Cabello Graso"
    CAB_SECO = "CAB_SECO", "Cabello Seco"
    # Minimarket General
    CONSUMO = "CONSUMO", "Consumo Humano (Abarrotes/Bebidas)"
    ROPA = "ROPA", "Cuidado de la Ropa"
    SUPERFICIES = "SUPERFICIES", "Limpieza de Superficies"
    SALUD = "SALUD", "Salud General"
    TODO = "TODO", "Todo Uso"


class TargetProblem(models.TextChoices):
    # Cuidado Personal y Salud
    ACNE = "ACNE", "Acné"
    MANCHAS = "MANCHAS", "Manchas en la Piel"
    ARRUGAS = "ARRUGAS", "Arrugas / Líneas de expresión"
    CAIDA = "CAIDA", "Caída de Cabello"
    CASPA = "CASPA", "Caspa"
    ROJEZ = "ROJEZ", "Rojez / Irritación"
    DOLOR = "DOLOR", "Dolor / Malestar General"
    # Minimarket General
    SUCIEDAD = "SUCIEDAD", "Suciedad / Grasa Doméstica"
    MANCHAS_ROPA = "MANCHAS_ROPA", "Manchas en Ropa"
    MAL_OLOR = "MAL_OLOR", "Mal Olor"
    SED = "SED", "Sed / Deshidratación"
    HAMBRE = "HAMBRE", "Hambre / Antojo"
    FALTA_ENERGIA = "FALTA_ENERGIA", "Falta de Energía / Deficiencia"
    NINGUNO = "NINGUNO", "Recreación / Ocio"


class ProductBenefit(models.TextChoices):
    # Cuidado Personal y Salud
    HIDRAT = "HIDRAT", "Hidratación"
    SEBOCONT = "SEBOCONT", "Control de Sebo"
    ANTIAGE = "ANTIAGE", "Anti-edad / Firmeza"
    DESPIGM = "DESPIGM", "Despigmentante / Aclarador"
    CALMANTE = "CALMANTE", "Calmante / Relajante"
    PROTSOL = "PROTSOL", "Protección Solar"
    ESTIMCAP = "ESTIMCAP", "Estimulación Capilar"
    ALIVIO = "ALIVIO", "Alivio Rápido / Curativo"
    # Minimarket General
    LIMPIEZA = "LIMPIEZA", "Limpieza Profunda"
    DESINFEC = "DESINFEC", "Desinfección / Antibacterial"
    NUTRICION = "NUTRICION", "Nutrición / Alimentación"
    REFRESCANTE = "REFRESCANTE", "Refrescante / Quita Sed"
    AROMA = "AROMA", "Aromatizante / Perfumado"
    ENTRETEN = "ENTRETEN", "Entretenimiento / Social"


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
    sku = models.CharField(max_length=60, unique=True, blank=True)
    barcode = models.CharField(max_length=100, blank=True, null=True, unique=True)
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True, default="")
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    min_stock = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    is_active = models.BooleanField(default=True)

    skin_type = models.CharField(
        max_length=20,
        choices=SkinType.choices,
        blank=True,
        default="",
    )
    target_problems = ArrayField(
        models.CharField(max_length=20, choices=TargetProblem.choices),
        blank=True,
        default=list,
    )
    benefits = ArrayField(
        models.CharField(max_length=20, choices=ProductBenefit.choices),
        blank=True,
        default=list,
    )
    keywords = models.TextField(blank=True, default="")

    class Meta:
        db_table = "inventory_product"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["sku"]),
            models.Index(fields=["name"]),
            models.Index(fields=["category", "is_active"]),
            models.Index(fields=["skin_type"]),
        ]

    def __init__(self, *args, **kwargs):
        initial_sale = kwargs.pop("sale_price", None)
        super().__init__(*args, **kwargs)
        if initial_sale is not None:
            self._initial_sale_price = Decimal(str(initial_sale))

    def refresh_from_db(self, *args, **kwargs):
        if hasattr(self, "_sale_price_override"):
            delattr(self, "_sale_price_override")
        if hasattr(self, "_initial_sale_price"):
            delattr(self, "_initial_sale_price")
        if "sale_price" in self.__dict__:
            del self.__dict__["sale_price"]
        super().refresh_from_db(*args, **kwargs)

    def clean(self):
        if self.cost_price < 0:
            raise ValidationError({"cost_price": "El precio de costo no puede ser negativo."})
        if self.min_stock < 0:
            raise ValidationError({"min_stock": "El stock mínimo no puede ser negativo."})

    @property
    def sale_price(self) -> Decimal:
        """
        Propiedad calculada para retrocompatibilidad.
        Retorna el precio anotado en la consulta SQL (Subquery),
        el precio de la sucursal prefetch, el precio del primer stock existente,
        el precio sugerido inicial en memoria, o el costo.
        """
        if hasattr(self, "_sale_price_override"):
            return self._sale_price_override

        if "sale_price" in self.__dict__:
            val = self.__dict__["sale_price"]
            if val is not None:
                return Decimal(str(val))

        if hasattr(self, "prefetched_branch_stocks") and self.prefetched_branch_stocks:
            return self.prefetched_branch_stocks[0].sale_price

        first_stock = self.stocks.first()
        if first_stock and first_stock.sale_price is not None:
            return first_stock.sale_price

        if getattr(self, "_initial_sale_price", None) is not None:
            return self._initial_sale_price

        return self.cost_price if self.cost_price is not None else Decimal("0.00")

    @sale_price.setter
    def sale_price(self, value):
        self._sale_price_override = Decimal(str(value)) if value is not None else None

    @property
    def needs_pricing(self) -> bool:
        """
        Indica si el producto requiere actualización de precios.
        Retorna True si el precio de costo es menor o igual a 0,
        o si no tiene precios registrados en sucursales o alguno es menor o igual a 0.
        """
        cost = self.cost_price if self.cost_price is not None else Decimal("0.00")
        if cost <= Decimal("0.00"):
            return True

        branch_prices = list(self.stocks.values_list("sale_price", flat=True))
        if not branch_prices:
            initial = getattr(self, "_initial_sale_price", None)
            if initial is not None:
                return initial <= Decimal("0.00")
            return True

        return any(price <= Decimal("0.00") for price in branch_prices)

    def _generate_sequential_sku(self) -> str:
        existing_skus = Product.objects.filter(sku__startswith="PROD-").values_list("sku", flat=True)
        max_num = 0
        for item in existing_skus:
            parts = item.split("-", 1)
            if len(parts) == 2 and parts[1].isdigit():
                num = int(parts[1])
                if num > max_num:
                    max_num = num

        next_num = max_num + 1
        candidate = f"PROD-{next_num:04d}"
        while Product.objects.filter(sku=candidate).exists():
            next_num += 1
            candidate = f"PROD-{next_num:04d}"
        return candidate

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        suggested_sale = getattr(self, "_initial_sale_price", None)

        if self.barcode == "":
            self.barcode = None

        if self.sku:
            self.sku = self.sku.strip().upper()
        else:
            self.sku = self._generate_sequential_sku()

        super().save(*args, **kwargs)

        if is_new:
            from apps.inventory.services import initialize_product_stocks
            initialize_product_stocks(self, suggested_sale_price=suggested_sale)

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


class StockManager(models.Manager):
    def create(self, **kwargs):
        branch = kwargs.get("branch")
        product = kwargs.get("product")
        if branch and product:
            existing = self.filter(branch=branch, product=product).first()
            if existing:
                for k, v in kwargs.items():
                    if k != "id":
                        setattr(existing, k, v)
                existing.save()
                return existing
        return super().create(**kwargs)


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
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    objects = StockManager()

    class Meta:
        db_table = "inventory_stock"
        ordering = ["branch__name", "product__name"]
        unique_together = [("branch", "product")]
        indexes = [
            models.Index(fields=["branch", "product"]),
            models.Index(fields=["product"]),
        ]

    def clean(self):
        if self.qty_on_hand < 0:
            raise ValidationError({"qty_on_hand": "El stock disponible no puede ser negativo."})
        if self.sale_price < 0:
            raise ValidationError({"sale_price": "El precio de venta no puede ser negativo."})

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