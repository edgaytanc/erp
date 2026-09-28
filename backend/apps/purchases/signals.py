from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from .inventory_integration import sync_purchase_inventory
from .models import Purchase, PurchaseStatus


@receiver(post_save, sender=Purchase)
def handle_purchase_stock_sync_signal(sender, instance: Purchase, created: bool, **kwargs):
    """
    Señal post_save en Purchase:
    Al registrar o actualizar una compra con estado CONFIRMED,
    sincroniza automáticamente el stock en la sucursal correspondiente.
    """
    if instance.status == PurchaseStatus.CONFIRMED:
        if instance.items.exists():
            sync_purchase_inventory(purchase=instance)
