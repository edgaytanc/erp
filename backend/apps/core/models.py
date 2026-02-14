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
