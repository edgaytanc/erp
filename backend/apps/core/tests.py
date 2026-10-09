# backend/apps/core/tests.py
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.models import Company, Branch, Notification, NotificationType
from apps.inventory.models import Product, Stock
from apps.purchases.models import Purchase, PurchaseStatus, Supplier
from apps.sales.models import Sale, SaleItem, SaleStatus

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


class DashboardAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(name="Corporación ERP")
        self.branch1 = Branch.objects.create(name="Sucursal Centro", company=self.company)
        self.branch2 = Branch.objects.create(name="Sucursal Sur", company=self.company)

        # Usuario asociado a Branch 1
        self.branch_user = User.objects.create_user(
            username="admin_centro",
            password="password123",
            branch=self.branch1,
            role=User.Roles.ADMIN,
        )

        # Usuario Gerente General / Admin Global (SIN sucursal asignada)
        self.global_admin = User.objects.create_user(
            username="gerente_general",
            password="password123",
            branch=None,
            role=User.Roles.ADMIN,
        )

        self.supplier = Supplier.objects.create(name="Distribuidor Central")

        # Productos
        self.product_a = Product.objects.create(
            name="Arroz Especial 1kg",
            sku="ARR-001",
            cost_price=Decimal("10.00"),
            min_stock=Decimal("15.00"),
        )
        self.product_b = Product.objects.create(
            name="Aceite Vegetal 1L",
            sku="ACE-001",
            cost_price=Decimal("15.00"),
            min_stock=Decimal("5.00"),
        )

        # Stock en Branch 1 (Stock bajo para product_a: 5 <= 15)
        Stock.objects.filter(branch=self.branch1, product=self.product_a).update(
            qty_on_hand=Decimal("5.00"),
            sale_price=Decimal("15.00"),
        )
        Stock.objects.filter(branch=self.branch1, product=self.product_b).update(
            qty_on_hand=Decimal("20.00"),
            sale_price=Decimal("22.00"),
        )

        # Stock en Branch 2 (Stock en cero para product_b: 0 <= 5)
        Stock.objects.filter(branch=self.branch2, product=self.product_a).update(
            qty_on_hand=Decimal("30.00"),
            sale_price=Decimal("15.00"),
        )
        Stock.objects.filter(branch=self.branch2, product=self.product_b).update(
            qty_on_hand=Decimal("0.00"),
            sale_price=Decimal("22.00"),
        )

        now = timezone.now()

        # Venta confirmada en Branch 1: total 150.00 (costo: 10 unid * 10 = 100, utilidad = 50)
        self.sale_b1 = Sale.objects.create(
            branch=self.branch1,
            cashier_id=self.branch_user.id,
            status=SaleStatus.CONFIRMED,
            sold_at=now,
            subtotal=Decimal("150.00"),
            total=Decimal("150.00"),
            payment_method="CASH",
        )
        SaleItem.objects.create(
            sale=self.sale_b1,
            product=self.product_a,
            qty=Decimal("10.00"),
            unit_price=Decimal("15.00"),
            subtotal=Decimal("150.00"),
        )

        # Venta confirmada en Branch 2: total 220.00 (costo: 10 unid * 15 = 150, utilidad = 70)
        self.sale_b2 = Sale.objects.create(
            branch=self.branch2,
            cashier_id=self.branch_user.id,
            status=SaleStatus.CONFIRMED,
            sold_at=now,
            subtotal=Decimal("220.00"),
            total=Decimal("220.00"),
            payment_method="CARD",
        )
        SaleItem.objects.create(
            sale=self.sale_b2,
            product=self.product_b,
            qty=Decimal("10.00"),
            unit_price=Decimal("22.00"),
            subtotal=Decimal("220.00"),
        )

        # Compra confirmada en Branch 1: 80.00
        Purchase.objects.create(
            branch=self.branch1,
            supplier=self.supplier,
            invoice_number="INV-B1-01",
            status=PurchaseStatus.CONFIRMED,
            purchased_at=now,
            total_cost=Decimal("80.00"),
        )

        # Compra confirmada en Branch 2: 120.00
        Purchase.objects.create(
            branch=self.branch2,
            supplier=self.supplier,
            invoice_number="INV-B2-01",
            status=PurchaseStatus.CONFIRMED,
            purchased_at=now,
            total_cost=Decimal("120.00"),
        )

    def test_dashboard_summary_scoped_to_user_branch(self):
        """El usuario con sucursal asignada solo ve los datos de su sucursal."""
        self.client.force_authenticate(user=self.branch_user)
        response = self.client.get("/api/dashboard/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        # Scope
        self.assertEqual(data["scope"]["branch_id"], str(self.branch1.id))
        self.assertEqual(data["scope"]["branch_name"], "Sucursal Centro")
        self.assertFalse(data["scope"]["is_global"])

        # KPIs solo de Branch 1
        self.assertEqual(data["kpis"]["total_sales"], 150.00)
        self.assertEqual(data["kpis"]["sales_count"], 1)
        self.assertEqual(data["kpis"]["total_purchases"], 80.00)
        self.assertEqual(data["kpis"]["purchases_count"], 1)
        # Utilidad = 150.00 - 100.00 = 50.00
        self.assertEqual(data["kpis"]["estimated_gross_profit"], 50.00)
        # Stock bajo en Branch 1: solo product_a (5 <= 15)
        self.assertEqual(data["kpis"]["low_stock_count"], 1)

        # Alertas críticas
        self.assertEqual(len(data["alerts"]), 1)
        self.assertEqual(data["alerts"][0]["product_name"], "Arroz Especial 1kg")
        self.assertEqual(data["alerts"][0]["branch_id"], str(self.branch1.id))

        # Actividad reciente: Venta B1 y Compra B1
        self.assertTrue(all(item["branch_id"] == str(self.branch1.id) for item in data["recent_activity"]))

        # Gráfico de 7 días
        self.assertEqual(len(data["chart_data"]), 7)
        matching_point = next(p for p in data["chart_data"] if p["sales"] > 0)
        self.assertEqual(matching_point["sales"], 150.00)
        self.assertEqual(matching_point["purchases"], 80.00)

    def test_dashboard_summary_global_admin_consolidates_all_branches(self):
        """El Admin Global sin sucursal asignada ve el consolidado de TODAS las sucursales."""
        self.client.force_authenticate(user=self.global_admin)
        response = self.client.get("/api/dashboard/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        # Scope
        self.assertIsNone(data["scope"]["branch_id"])
        self.assertTrue(data["scope"]["is_global"])

        # KPIs consolidados: Ventas (150 + 220 = 370.00), Compras (80 + 120 = 200.00)
        self.assertEqual(data["kpis"]["total_sales"], 370.00)
        self.assertEqual(data["kpis"]["sales_count"], 2)
        self.assertEqual(data["kpis"]["total_purchases"], 200.00)
        self.assertEqual(data["kpis"]["purchases_count"], 2)
        # Costo total = 100 + 150 = 250, Utilidad = 370 - 250 = 120.00
        self.assertEqual(data["kpis"]["estimated_gross_profit"], 120.00)

        # Stock bajo en total: product_a en Branch 1 (5 <= 15) y product_b en Branch 2 (0 <= 5)
        self.assertEqual(data["kpis"]["low_stock_count"], 2)
        self.assertEqual(data["kpis"]["out_of_stock_count"], 1)

        # Alertas deben incluir ambos productos
        self.assertEqual(len(data["alerts"]), 2)
        # El primero debe ser el que tiene stock 0 (product_b)
        self.assertEqual(data["alerts"][0]["qty_on_hand"], 0.00)
        self.assertTrue(data["alerts"][0]["is_out_of_stock"])

        # Gráfico consolida ventas y compras de ambas sucursales
        self.assertEqual(len(data["chart_data"]), 7)
        matching_point = next(p for p in data["chart_data"] if p["sales"] > 0)
        self.assertEqual(matching_point["sales"], 370.00)
        self.assertEqual(matching_point["purchases"], 200.00)

        # Actividad reciente incluye transacciones de ambas sucursales
        branch_ids_in_activity = {item["branch_id"] for item in data["recent_activity"]}
        self.assertIn(str(self.branch1.id), branch_ids_in_activity)
        self.assertIn(str(self.branch2.id), branch_ids_in_activity)
