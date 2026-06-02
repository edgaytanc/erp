from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.config_module.models import CompanySettings
from apps.core.models import Branch, Company
from apps.inventory.models import Category, Product
from apps.inventory.services import register_purchase_entry
from apps.purchases.models import Supplier
from apps.sales.services import open_cash_session


class ReportsApiTestCase(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin_user = user_model.objects.create_user(
            username="admin_reports",
            password="admin123",
            role="admin",
        )
        self.sales_user = user_model.objects.create_user(
            username="seller_reports",
            password="seller123",
            role="sales",
        )
        self.company = Company.objects.create(name="ERP Demo")
        CompanySettings.objects.create(company=self.company, tax_rate=Decimal("0.1200"), is_active=True)
        self.branch = Branch.objects.create(company=self.company, name="Central")
        self.category = Category.objects.create(name="Abarrotes")
        self.product = Product.objects.create(
            category=self.category,
            sku="ARROZ-001",
            name="Arroz",
            sale_price=Decimal("25.00"),
            cost_price=Decimal("8.00"),
            min_stock=Decimal("5.00"),
        )
        self.supplier = Supplier.objects.create(name="Proveedor Demo")

        register_purchase_entry(
            branch=self.branch,
            product=self.product,
            qty=Decimal("10.00"),
            purchase_id="INITIAL",
            unit_cost=Decimal("8.00"),
            created_by=self.admin_user,
        )

    def authenticate_admin(self):
        self.client.force_authenticate(user=self.admin_user)

    def open_cash_register(self):
        return open_cash_session(
            branch=self.branch,
            cashier=self.admin_user,
            opening_amount=Decimal("100.00"),
        )

    def test_reports_are_admin_only(self):
        self.client.force_authenticate(user=self.sales_user)
        response = self.client.get(reverse("reports-sales"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sales_report_returns_confirmed_sales_totals(self):
        self.authenticate_admin()
        self.open_cash_register()
        sale_response = self.client.post(
            reverse("sales-list"),
            {
                "branch": str(self.branch.id),
                "payment_method": "CASH",
                "items": [
                    {
                        "product": str(self.product.id),
                        "qty": "2.000",
                        "unit_price": "25.00",
                    }
                ],
            },
            format="json",
        )
        self.client.post(
            reverse("sales-confirm", args=[sale_response.data["id"]]),
            {"cash_received": "100.00"},
            format="json",
        )

        response = self.client.get(reverse("reports-sales"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["sales_count"], 1)
        self.assertEqual(response.data["summary"]["total"], "50.00")
        self.assertEqual(len(response.data["items"]), 1)

    def test_purchases_report_returns_confirmed_purchase_totals(self):
        self.authenticate_admin()
        purchase_response = self.client.post(
            reverse("purchases-list"),
            {
                "branch": str(self.branch.id),
                "supplier": str(self.supplier.id),
                "invoice_number": "FAC-001",
                "items": [
                    {
                        "product": str(self.product.id),
                        "qty": "3.000",
                        "unit_cost": "9.50",
                    }
                ],
            },
            format="json",
        )
        self.client.post(reverse("purchases-confirm", args=[purchase_response.data["id"]]), {}, format="json")

        response = self.client.get(reverse("reports-purchases"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["purchases_count"], 1)
        self.assertEqual(response.data["summary"]["total_cost"], "28.50")
        self.assertEqual(len(response.data["items"]), 1)

    def test_inventory_report_returns_current_stock_value(self):
        self.authenticate_admin()
        response = self.client.get(reverse("reports-inventory"), {"branch": str(self.branch.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["sku_count"], 1)
        self.assertEqual(response.data["summary"]["total_qty"], "10.00")
        self.assertEqual(response.data["summary"]["inventory_value"], "80.00")
        self.assertEqual(response.data["items"][0]["sku"], "ARROZ-001")
