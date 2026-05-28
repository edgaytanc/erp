from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.models import Branch


class User(AbstractUser):
    class Roles(models.TextChoices):
        ADMIN = "admin", "Administrador"
        PURCHASES = "purchases", "Encargado de Compras"
        SALES = "sales", "Vendedor"

    role = models.CharField(
        max_length=20,
        choices=Roles.choices,
        default=Roles.SALES,
        db_index=True,
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        related_name="users",
        null=True,
        blank=True,
    )

    def is_admin(self) -> bool:
        return self.role == self.Roles.ADMIN or self.is_superuser

    def is_purchases(self) -> bool:
        return self.role == self.Roles.PURCHASES

    def is_sales(self) -> bool:
        return self.role == self.Roles.SALES

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"
