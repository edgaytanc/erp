from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.config_module.models import CompanySettings
from apps.core.models import Branch, Company
from apps.inventory.models import Category, Product, ReferenceType, Stock, StockMovement
from apps.inventory.services import register_purchase_entry
from apps.sales.models import Sale, SaleStatus


class SalesApiIntegrationTestCase(APITestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.admin_user = self.user_model.objects.create_user(
            username="admin_sales",
            password="admin123",
            role="admin",
        )
        self.sales_user = self.user_model.objects.create_user(
            username="seller",
            password="seller123",
            role="sales",
        )
        self.purchases_user = self.user_model.objects.create_user(
            username="buyer",
            password="buyer123",
            role="purchases",
        )

        self.company = Company.objects.create(
            name="ERP Demo",
            tax_id="1234567-8",
            address="Zona 1",
            phone="55550000",
            receipt_header="Gracias por su compra",
            receipt_footer="Vuelva pronto",
            logo="/media/logo.png",
        )
        CompanySettings.objects.create(
            company=self.company,
            tax_rate=Decimal("0.1200"),
            money_rounding=Decimal("0.0100"),
            sale_void_window_minutes=10,
            is_active=True,
        )

        self.branch = Branch.objects.create(company=self.company, name="Central", is_active=True)
        self.category = Category.objects.create(name="Abarrotes")
        self.product = Product.objects.create(
            category=self.category,
            sku="ARROZ-001",
            name="Arroz",
            sale_price=Decimal("25.00"),
            cost_price=Decimal("8.00"),
            min_stock=Decimal("5.00"),
            is_active=True,
        )
        self.product_2 = Product.objects.create(
            category=self.category,
            sku="FRIJOL-001",
            name="Frijol",
            sale_price=Decimal("18.00"),
            cost_price=Decimal("7.50"),
            min_stock=Decimal("3.00"),
            is_active=True,
        )

        register_purchase_entry(
            branch=self.branch,
            product=self.product,
            qty=Decimal("10.00"),
            purchase_id="STOCK-1",
            unit_cost=Decimal("8.00"),
        )
        register_purchase_entry(
            branch=self.branch,
            product=self.product_2,
            qty=Decimal("5.00"),
            purchase_id="STOCK-2",
            unit_cost=Decimal("7.50"),
        )

    def authenticate_sales(self):
        self.client.force_authenticate(user=self.sales_user)

    def authenticate_admin(self):
        self.client.force_authenticate(user=self.admin_user)

    def authenticate_purchases(self):
        self.client.force_authenticate(user=self.purchases_user)

    def sale_payload(self):
        return {
            "branch": str(self.branch.id),
            "payment_method": "CASH",
            "items": [
                {
                    "product": str(self.product.id),
                    "qty": "2.000",
                    "unit_price": "25.00",
                },
                {
                    "product": str(self.product_2.id),
                    "qty": "1.000",
                    "unit_price": "18.00",
                },
            ],
        }

    def test_purchases_role_cannot_access_sales_module(self):
        self.authenticate_purchases()
        response = self.client.get(reverse("sales-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_sale_as_draft_recomputes_totals(self):
        self.authenticate_sales()
        response = self.client.post(reverse("sales-list"), self.sale_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], SaleStatus.DRAFT)
        self.assertEqual(response.data["subtotal"], "60.71")
        self.assertEqual(response.data["tax"], "7.29")
        self.assertEqual(response.data["total"], "68.00")
        self.assertEqual(len(response.data["items"]), 2)
        self.assertEqual(response.data["cashier_id"], str(self.sales_user.id))

    def test_quick_create_sale_works(self):
        self.authenticate_sales()
        response = self.client.post(reverse("sales-quick"), self.sale_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], SaleStatus.DRAFT)

    def test_create_sale_rejects_duplicate_products(self):
        self.authenticate_sales()
        payload = self.sale_payload()
        payload["items"] = [
            {"product": str(self.product.id), "qty": "1.000", "unit_price": "25.00"},
            {"product": str(self.product.id), "qty": "2.000", "unit_price": "25.00"},
        ]

        response = self.client.post(reverse("sales-list"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("productos repetidos", str(response.data).lower())

    def test_sales_role_cannot_override_price(self):
        self.authenticate_sales()
        payload = self.sale_payload()
        payload["items"][0]["unit_price"] = "24.00"

        response = self.client.post(reverse("sales-list"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("solo admin puede modificar el precio", str(response.data).lower())

    def test_admin_can_override_price(self):
        self.authenticate_admin()
        payload = self.sale_payload()
        payload["items"][0]["unit_price"] = "24.00"

        response = self.client.post(reverse("sales-list"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["total"], "66.00")

    def test_confirm_sale_impacts_inventory(self):
        self.authenticate_sales()
        create_response = self.client.post(reverse("sales-list"), self.sale_payload(), format="json")
        sale_id = create_response.data["id"]

        confirm_response = self.client.post(reverse("sales-confirm", args=[sale_id]), {}, format="json")
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.assertEqual(confirm_response.data["status"], SaleStatus.CONFIRMED)
        self.assertIsNotNone(confirm_response.data["sold_at"])

        stock_product_1 = Stock.objects.get(branch=self.branch, product=self.product)
        stock_product_2 = Stock.objects.get(branch=self.branch, product=self.product_2)
        self.assertEqual(stock_product_1.qty_on_hand, Decimal("8.00"))
        self.assertEqual(stock_product_2.qty_on_hand, Decimal("4.00"))

        self.assertEqual(
            StockMovement.objects.filter(reference_type=ReferenceType.SALE, reference_id=sale_id).count(),
            2,
        )

    def test_confirm_sale_is_idempotent(self):
        self.authenticate_sales()
        create_response = self.client.post(reverse("sales-list"), self.sale_payload(), format="json")
        sale_id = create_response.data["id"]

        first_confirm = self.client.post(reverse("sales-confirm", args=[sale_id]), {}, format="json")
        second_confirm = self.client.post(reverse("sales-confirm", args=[sale_id]), {}, format="json")

        self.assertEqual(first_confirm.status_code, status.HTTP_200_OK)
        self.assertEqual(second_confirm.status_code, status.HTTP_200_OK)
        self.assertEqual(
            StockMovement.objects.filter(reference_type=ReferenceType.SALE, reference_id=sale_id).count(),
            2,
        )
        self.assertEqual(Stock.objects.get(branch=self.branch, product=self.product).qty_on_hand, Decimal("8.00"))

    def test_confirm_sale_rejects_insufficient_stock(self):
        self.authenticate_sales()
        payload = self.sale_payload()
        payload["items"][0]["qty"] = "99.000"
        create_response = self.client.post(reverse("sales-list"), payload, format="json")
        sale_id = create_response.data["id"]

        response = self.client.post(reverse("sales-confirm", args=[sale_id]), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("stock insuficiente", response.data["detail"].lower())

    def test_cannot_edit_confirmed_sale(self):
        self.authenticate_sales()
        create_response = self.client.post(reverse("sales-list"), self.sale_payload(), format="json")
        sale_id = create_response.data["id"]
        self.client.post(reverse("sales-confirm", args=[sale_id]), {}, format="json")

        response = self.client.patch(
            reverse("sales-detail", args=[sale_id]),
            {"payment_method": "CARD"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("solo draft", response.data["detail"].lower())

    def test_void_sale_reverts_stock(self):
        self.authenticate_sales()
        create_response = self.client.post(reverse("sales-list"), self.sale_payload(), format="json")
        sale_id = create_response.data["id"]
        self.client.post(reverse("sales-confirm", args=[sale_id]), {}, format="json")

        response = self.client.post(
            reverse("sales-void", args=[sale_id]),
            {"reason": "Cliente devolvió el pedido"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], SaleStatus.VOID)
        self.assertEqual(response.data["void_reason"], "Cliente devolvió el pedido")

        stock_product_1 = Stock.objects.get(branch=self.branch, product=self.product)
        stock_product_2 = Stock.objects.get(branch=self.branch, product=self.product_2)
        self.assertEqual(stock_product_1.qty_on_hand, Decimal("10.00"))
        self.assertEqual(stock_product_2.qty_on_hand, Decimal("5.00"))

        self.assertEqual(
            StockMovement.objects.filter(reference_type=ReferenceType.SALE_VOID, reference_id=sale_id).count(),
            2,
        )

    def test_void_sale_is_idempotent(self):
        self.authenticate_sales()
        create_response = self.client.post(reverse("sales-list"), self.sale_payload(), format="json")
        sale_id = create_response.data["id"]
        self.client.post(reverse("sales-confirm", args=[sale_id]), {}, format="json")

        first_void = self.client.post(reverse("sales-void", args=[sale_id]), {"reason": "x"}, format="json")
        second_void = self.client.post(reverse("sales-void", args=[sale_id]), {"reason": "y"}, format="json")

        self.assertEqual(first_void.status_code, status.HTTP_200_OK)
        self.assertEqual(second_void.status_code, status.HTTP_200_OK)
        self.assertEqual(
            StockMovement.objects.filter(reference_type=ReferenceType.SALE_VOID, reference_id=sale_id).count(),
            2,
        )

    def test_sales_role_cannot_void_after_window(self):
        self.authenticate_sales()
        create_response = self.client.post(reverse("sales-list"), self.sale_payload(), format="json")
        sale_id = create_response.data["id"]
        self.client.post(reverse("sales-confirm", args=[sale_id]), {}, format="json")

        sale = Sale.objects.get(pk=sale_id)
        sale.sold_at = timezone.now() - timedelta(minutes=30)
        sale.save(update_fields=["sold_at", "updated_at"])

        response = self.client.post(reverse("sales-void", args=[sale_id]), {"reason": "tarde"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ventana de anulación vencida", response.data["detail"].lower())

    def test_admin_can_void_after_window(self):
        self.authenticate_sales()
        create_response = self.client.post(reverse("sales-list"), self.sale_payload(), format="json")
        sale_id = create_response.data["id"]
        self.client.post(reverse("sales-confirm", args=[sale_id]), {}, format="json")

        sale = Sale.objects.get(pk=sale_id)
        sale.sold_at = timezone.now() - timedelta(minutes=30)
        sale.save(update_fields=["sold_at", "updated_at"])

        self.authenticate_admin()
        response = self.client.post(reverse("sales-void", args=[sale_id]), {"reason": "admin ok"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], SaleStatus.VOID)

    def test_ticket_endpoint_returns_company_and_items(self):
        self.authenticate_sales()
        create_response = self.client.post(reverse("sales-list"), self.sale_payload(), format="json")
        sale_id = create_response.data["id"]
        self.client.post(reverse("sales-confirm", args=[sale_id]), {}, format="json")

        response = self.client.get(reverse("sales-ticket", args=[sale_id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["company_name"], "ERP Demo")
        self.assertEqual(response.data["branch_name"], "Central")
        self.assertEqual(len(response.data["items"]), 2)
        self.assertEqual(response.data["receipt_footer"], "Vuelva pronto")