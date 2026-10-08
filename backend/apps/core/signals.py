# backend/apps/core/signals.py
from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.core.models import Notification, NotificationType
from apps.inventory.models import Stock
from apps.purchases.models import Purchase, PurchaseStatus


@receiver(post_save, sender=Purchase)
def handle_purchase_notification(sender, instance: Purchase, created: bool, **kwargs):
    """
    Trigger 1 (Compras):
    Conéctate a la creación o confirmación de una Purchase.
    Cuando se registre una nueva orden de compra, el sistema debe crear un
    registro en Notification de tipo NEW_PURCHASE para la sucursal correspondiente.
    """
    if not instance.branch_id:
        return

    reference_str = str(instance.id)
    invoice_label = instance.invoice_number or reference_str[:8]

    if created:
        Notification.objects.create(
            branch=instance.branch,
            notification_type=NotificationType.NEW_PURCHASE,
            title=f"Nueva orden de compra #{invoice_label}",
            message=f"Se ha registrado una nueva orden de compra #{invoice_label}.",
            reference_id=reference_str,
        )
    elif instance.status == PurchaseStatus.CONFIRMED:
        # En caso de confirmación posterior, si no existe una notificación previa registrada para esta compra
        already_notified = Notification.objects.filter(
            branch=instance.branch,
            notification_type=NotificationType.NEW_PURCHASE,
            reference_id=reference_str,
        ).exists()

        if not already_notified:
            Notification.objects.create(
                branch=instance.branch,
                notification_type=NotificationType.NEW_PURCHASE,
                title=f"Nueva orden de compra confirmada #{invoice_label}",
                message=f"Se ha confirmado la orden de compra #{invoice_label}.",
                reference_id=reference_str,
            )


@receiver(post_save, sender=Stock)
def handle_low_stock_notification(sender, instance: Stock, **kwargs):
    """
    Trigger 2 (Stock Mínimo):
    Conéctate a la actualización del inventario/stock.
    Si la cantidad de un producto (qty_on_hand o similar) llega a ser menor
    o igual al min_stock configurado, debes crear una Notification de tipo LOW_STOCK.

    Anti-Spam:
    Antes de crear la notificación de LOW_STOCK, verifica si ya existe una
    notificación de este tipo, para este producto y sucursal, que esté con is_read=False.
    Si ya existe una alerta activa y no leída para este producto, NO crees otra para
    evitar saturar al administrador.
    """
    if not instance.branch_id or not instance.product_id:
        return

    product = instance.product
    if product is None:
        return

    min_stock = product.min_stock
    if min_stock is not None and instance.qty_on_hand <= min_stock:
        has_active_alert = Notification.objects.filter(
            branch=instance.branch,
            notification_type=NotificationType.LOW_STOCK,
            reference_id=str(product.id),
            is_read=False,
        ).exists()

        if not has_active_alert:
            Notification.objects.create(
                branch=instance.branch,
                notification_type=NotificationType.LOW_STOCK,
                title=f"Stock bajo: {product.name}",
                message=(
                    f"El producto '{product.name}' (SKU: {product.sku}) ha alcanzado un stock "
                    f"de {instance.qty_on_hand}, el cual es menor o igual al stock mínimo "
                    f"configurado ({min_stock})."
                ),
                reference_id=str(product.id),
            )
