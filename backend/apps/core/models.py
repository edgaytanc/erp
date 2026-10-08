import uuid
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Company(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    name = models.CharField(max_length=255)
    tax_id = models.CharField(max_length=64, blank=True, default="")
    address = models.TextField(blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="")

    # Para recibos/tickets
    logo = models.CharField(max_length=512, blank=True, default="")  # ruta/URL (lo moveremos a FileField en E11 si querés)
    receipt_header = models.TextField(blank=True, default="")
    receipt_footer = models.TextField(blank=True, default="")

    class Meta:
        db_table = "core_company"

    def __str__(self) -> str:
        return self.name


class Branch(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    company = models.ForeignKey(
        Company, on_delete=models.PROTECT, related_name="branches"
    )
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "core_branch"
        indexes = [
            models.Index(fields=["company", "is_active"], name="ix_branch_company_active"),
        ]

    def __str__(self) -> str:
        return f"{self.name}"


class NotificationType(models.TextChoices):
    LOW_STOCK = "LOW_STOCK", "Stock Mínimo"
    NEW_PURCHASE = "NEW_PURCHASE", "Nueva Compra"


class Notification(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="Sucursal",
    )
    notification_type = models.CharField(
        max_length=32,
        choices=NotificationType.choices,
        db_index=True,
        verbose_name="Tipo de notificación",
    )
    title = models.CharField(
        max_length=255,
        verbose_name="Título",
    )
    message = models.TextField(
        verbose_name="Mensaje",
    )
    is_read = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Leída",
    )
    reference_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        verbose_name="ID de referencia",
    )

    class Meta:
        db_table = "core_notification"
        ordering = ["-created_at"]
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"
        indexes = [
            models.Index(fields=["branch", "is_read"], name="ix_notif_branch_read"),
            models.Index(fields=["branch", "-created_at"], name="ix_notif_branch_created"),
        ]

    def __str__(self) -> str:
        return f"[{self.get_notification_type_display()}] {self.title} - {self.branch.name}"
