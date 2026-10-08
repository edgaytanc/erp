# backend/apps/core/tests.py
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.models import Company, Branch, Notification, NotificationType
from apps.inventory.models import Product, Stock
from apps.purchases.models import Purchase, PurchaseStatus, Supplier

User = get_user_model()


class NotificationSystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Configuración básica de compañía y sucursales
        self.company = Company.objects.create(name="Empresa Principal")
        self.branch1 = Branch.objects.create(name="Sucursal Central", company=self.company)
        self.branch2 = Branch.objects.create(name="Sucursal Norte", company=self.company)

        # Usuarios asociados a sucursales
        self.user1 = User.objects.create_user(
            username="user_central",
            password="password123",
            branch=self.branch1,
            role=User.Roles.SALES,
        )
        self.user2 = User.objects.create_user(
            username="user_norte",
            password="password123",
            branch=self.branch2,
            role=User.Roles.SALES,
        )

        # Proveedor para compras
        self.supplier = Supplier.objects.create(name="Distribuidora Global")

        # Producto para inventario (con stock inicial para evitar notificaciones de inicio)
        self.product = Product.objects.create(
            name="Champú Anticaída",
            sku="SHAMP-001",
            cost_price=Decimal("20.00"),
            min_stock=Decimal("10.00"),
        )

        # Limpiamos cualquier notificación generada automáticamente en el setup
        Notification.objects.all().delete()

    def test_notification_creation_and_isolation_by_branch(self):
        """Verifica que cada usuario solo vea notificaciones de su sucursal ordenadas por -created_at."""
        notif1 = Notification.objects.create(
            branch=self.branch1,
            notification_type=NotificationType.NEW_PURCHASE,
            title="Compra 1",
            message="Mensaje 1",
            is_read=False,
        )
        notif2 = Notification.objects.create(
            branch=self.branch1,
            notification_type=NotificationType.LOW_STOCK,
            title="Stock Bajo 1",
            message="Mensaje 2",
            is_read=False,
        )
        notif_branch2 = Notification.objects.create(
            branch=self.branch2,
            notification_type=NotificationType.NEW_PURCHASE,
            title="Compra Branch 2",
            message="Mensaje 3",
            is_read=False,
        )

        # Usuario de Sucursal Central
        self.client.force_authenticate(user=self.user1)
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 2)
        returned_ids = [item["id"] for item in results]
        self.assertIn(str(notif1.id), returned_ids)
        self.assertIn(str(notif2.id), returned_ids)
        self.assertNotIn(str(notif_branch2.id), returned_ids)

        # Orden más reciente primero
        self.assertEqual(returned_ids[0], str(notif2.id))

    def test_mark_as_read_action(self):
        """Verifica la acción personalizada mark_as_read."""
        notif = Notification.objects.create(
            branch=self.branch1,
            notification_type=NotificationType.LOW_STOCK,
            title="Alerta Stock",
            message="Stock crítico",
            is_read=False,
        )

        self.client.force_authenticate(user=self.user1)
        url = f"/api/notifications/{notif.id}/mark_as_read/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_read"])

        notif.refresh_from_db()
        self.assertTrue(notif.is_read)

    def test_mark_all_as_read_action(self):
        """Verifica la acción personalizada mark_all_as_read para la sucursal actual."""
        Notification.objects.create(
            branch=self.branch1,
            notification_type=NotificationType.NEW_PURCHASE,
            title="Compra 1",
            message="Msg 1",
            is_read=False,
        )
        Notification.objects.create(
            branch=self.branch1,
            notification_type=NotificationType.LOW_STOCK,
            title="Stock 1",
            message="Msg 2",
            is_read=False,
        )
        notif_other_branch = Notification.objects.create(
            branch=self.branch2,
            notification_type=NotificationType.LOW_STOCK,
            title="Stock Branch 2",
            message="Msg 3",
            is_read=False,
        )

        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/notifications/mark_all_as_read/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated_count"], 2)

        # Las de branch1 deben estar en True
        self.assertEqual(Notification.objects.filter(branch=self.branch1, is_read=False).count(), 0)

        # La de branch2 debe seguir intacta en False
        notif_other_branch.refresh_from_db()
        self.assertFalse(notif_other_branch.is_read)

    def test_trigger_purchase_creates_notification(self):
        """Trigger 1: Crear una compra debe generar una notificación NEW_PURCHASE."""
        purchase = Purchase.objects.create(
            branch=self.branch1,
            supplier=self.supplier,
            invoice_number="FAC-9901",
            status=PurchaseStatus.DRAFT,
            total_cost=Decimal("150.00"),
        )

        notif = Notification.objects.filter(
            branch=self.branch1,
            notification_type=NotificationType.NEW_PURCHASE,
            reference_id=str(purchase.id),
        ).first()

        self.assertIsNotNone(notif)
        self.assertIn("FAC-9901", notif.title)
        self.assertFalse(notif.is_read)

    def test_trigger_low_stock_and_anti_spam(self):
        """Trigger 2: Stock <= min_stock debe generar LOW_STOCK y evitar spam con alertas no leídas."""
        # Obtenemos stock para branch1 y lo colocamos con cantidad inicial suficiente
        stock = Stock.objects.get(branch=self.branch1, product=self.product)
        stock.qty_on_hand = Decimal("50.00")
        stock.save()

        # Limpiamos notificaciones
        Notification.objects.all().delete()

        # Caso 1: Stock cae a 8.00 (min_stock es 10.00) -> Genera notificación
        stock.qty_on_hand = Decimal("8.00")
        stock.save()

        alerts_count = Notification.objects.filter(
            branch=self.branch1,
            notification_type=NotificationType.LOW_STOCK,
            reference_id=str(self.product.id),
            is_read=False,
        ).count()
        self.assertEqual(alerts_count, 1)

        # Caso 2 (Anti-spam): Stock vuelve a actualizarse a 5.00 con la alerta aún activa y no leída
        stock.qty_on_hand = Decimal("5.00")
        stock.save()

        alerts_count_after = Notification.objects.filter(
            branch=self.branch1,
            notification_type=NotificationType.LOW_STOCK,
            reference_id=str(self.product.id),
            is_read=False,
        ).count()
        self.assertEqual(alerts_count_after, 1)  # NO crea duplicados

        # Caso 3 (Re-notificación): Marcamos la alerta como leída y el stock vuelve a cambiar a 2.00
        alert = Notification.objects.filter(
            branch=self.branch1,
            notification_type=NotificationType.LOW_STOCK,
            reference_id=str(self.product.id),
            is_read=False,
        ).first()
        alert.is_read = True
        alert.save()

        stock.qty_on_hand = Decimal("2.00")
        stock.save()

        total_alerts = Notification.objects.filter(
            branch=self.branch1,
            notification_type=NotificationType.LOW_STOCK,
            reference_id=str(self.product.id),
        ).count()
        self.assertEqual(total_alerts, 2)  # 1 leída y 1 nueva no leída
