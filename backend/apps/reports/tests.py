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

    def test_daily_utility_report(self):
        self.authenticate_admin()
        self.open_cash_register()

        # Confirm a sale
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

        response = self.client.get(reverse("reports-sales-daily-utility"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["sales_count"], 1)
        self.assertEqual(response.data["summary"]["total_revenue"], "50.00")
        self.assertEqual(response.data["summary"]["total_cost"], "16.00") # 2 * 8.00
        self.assertEqual(response.data["summary"]["utility"], "34.00") # 50.00 - 16.00
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["total_revenue"], "50.00")
        self.assertEqual(response.data["items"][0]["total_cost"], "16.00")
        self.assertEqual(response.data["items"][0]["utility"], "34.00")

    def test_top_selling_products_report(self):
        self.authenticate_admin()
        self.open_cash_register()

        # Create a second product
        product2 = Product.objects.create(
            category=self.category,
            sku="FRIJOL-001",
            name="Frijol",
            sale_price=Decimal("15.00"),
            cost_price=Decimal("5.00"),
            min_stock=Decimal("5.00"),
        )
        register_purchase_entry(
            branch=self.branch,
            product=product2,
            qty=Decimal("15.00"),
            purchase_id="INITIAL2",
            unit_cost=Decimal("5.00"),
            created_by=self.admin_user,
        )

        # Confirm a sale of 6 units of Product 1 (Arroz)
        sale1_response = self.client.post(
            reverse("sales-list"),
            {
                "branch": str(self.branch.id),
                "payment_method": "CASH",
                "items": [
                    {
                        "product": str(self.product.id),
                        "qty": "6.000",
                        "unit_price": "25.00",
                    }
                ],
            },
            format="json",
        )
        self.client.post(
            reverse("sales-confirm", args=[sale1_response.data["id"]]),
            {"cash_received": "200.00"},
            format="json",
        )

        # Confirm a sale of 4 units of Product 2 (Frijol)
        sale2_response = self.client.post(
            reverse("sales-list"),
            {
                "branch": str(self.branch.id),
                "payment_method": "CASH",
                "items": [
                    {
                        "product": str(product2.id),
                        "qty": "4.000",
                        "unit_price": "15.00",
                    }
                ],
            },
            format="json",
        )
        self.client.post(
            reverse("sales-confirm", args=[sale2_response.data["id"]]),
            {"cash_received": "100.00"},
            format="json",
        )

        # Get top selling report with limit=1 (should return only Arroz, as it has 6 units sold)
        response = self.client.get(reverse("reports-sales-top-selling"), {"limit": 1})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["products_count"], 2) # Total distinct products sold
        self.assertEqual(response.data["summary"]["units_sold"], "10.00") # 6 + 4
        self.assertEqual(len(response.data["items"]), 1) # limited by 1
        self.assertEqual(response.data["items"][0]["sku"], "ARROZ-001")
        self.assertEqual(response.data["items"][0]["units_sold"], "6.00")

    def test_product_margin_report(self):
        self.authenticate_admin()
        self.open_cash_register()

        # Confirm a sale of Product 1 (Arroz: sale_price 25.00, cost_price 8.00 -> Margin = (25-8)/25 = 68.0%)
        sale_response = self.client.post(
            reverse("sales-list"),
            {
                "branch": str(self.branch.id),
                "payment_method": "CASH",
                "items": [
                    {
                        "product": str(self.product.id),
                        "qty": "1.000",
                        "unit_price": "25.00",
                    }
                ],
            },
            format="json",
        )
        self.client.post(
            reverse("sales-confirm", args=[sale_response.data["id"]]),
            {"cash_received": "50.00"},
            format="json",
        )

        response = self.client.get(reverse("reports-sales-margin"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["products_count"], 1)
        self.assertAlmostEqual(response.data["summary"]["average_margin"], 68.0)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["sku"], "ARROZ-001")
        self.assertAlmostEqual(response.data["items"][0]["margin"], 68.0)

    def test_supplier_details_report(self):
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

        response = self.client.get(reverse("reports-purchases-supplier-details"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_cost"], "28.50")
        self.assertEqual(response.data["summary"]["total_qty"], "3.00")
        self.assertEqual(response.data["summary"]["products_count"], 1)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["supplier_name"], "Proveedor Demo")
        self.assertEqual(response.data["items"][0]["product_name"], "Arroz")
        self.assertEqual(response.data["items"][0]["qty"], "3.00")
        self.assertEqual(response.data["items"][0]["total_cost"], "28.50")

    def test_general_products_report(self):
        self.authenticate_admin()

        # Crear un segundo producto sin stock
        product_no_stock = Product.objects.create(
            category=self.category,
            sku="FRIJOL-001",
            name="Frijol",
            sale_price=Decimal("15.00"),
            cost_price=Decimal("5.00"),
            min_stock=Decimal("10.00"),
        )

        # Crear una segunda sucursal y agregar stock al producto 1
        branch_secundaria = Branch.objects.create(company=self.company, name="Secundaria")
        register_purchase_entry(
            branch=branch_secundaria,
            product=self.product,
            qty=Decimal("5.00"),
            purchase_id="INITIAL_SEC",
            unit_cost=Decimal("8.00"),
            created_by=self.admin_user,
        )

        # 1. Consulta global (sin filtro branch):
        # self.product tiene 10 en Central + 5 en Secundaria = 15.00
        # product_no_stock tiene 0.00
        url = reverse("reports-inventory-general-products")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_products"], 2)
        self.assertEqual(response.data["summary"]["total_stock"], "15.00")
        self.assertEqual(len(response.data["items"]), 2)

        items_by_sku = {item["sku"]: item for item in response.data["items"]}
        
        # Validar campos del producto con stock
        arroz_item = items_by_sku["ARROZ-001"]
        self.assertEqual(arroz_item["name"], "Arroz")
        self.assertEqual(arroz_item["category_name"], "Abarrotes")
        self.assertEqual(arroz_item["sale_price"], "25.00")
        self.assertEqual(arroz_item["cost_price"], "8.00")
        self.assertEqual(arroz_item["qty_on_hand"], "15.00")
        self.assertEqual(arroz_item["min_stock"], "5.00")

        # Validar campos del producto sin stock
        frijol_item = items_by_sku["FRIJOL-001"]
        self.assertEqual(frijol_item["name"], "Frijol")
        self.assertEqual(frijol_item["category_name"], "Abarrotes")
        self.assertEqual(frijol_item["sale_price"], "15.00")
        self.assertEqual(frijol_item["cost_price"], "5.00")
        self.assertEqual(frijol_item["qty_on_hand"], "0.00")
        self.assertEqual(frijol_item["min_stock"], "10.00")

        # 2. Consulta filtrada por sucursal específica (Central)
        # self.product debe tener 10.00 en Central
        response_branch = self.client.get(url, {"branch": str(self.branch.id)})
        self.assertEqual(response_branch.status_code, status.HTTP_200_OK)
        items_branch = {item["sku"]: item for item in response_branch.data["items"]}
        self.assertEqual(items_branch["ARROZ-001"]["qty_on_hand"], "10.00")
        self.assertEqual(items_branch["FRIJOL-001"]["qty_on_hand"], "0.00")

        # 3. Consulta filtrada por sucursal Secundaria
        response_sec = self.client.get(url, {"branch": str(branch_secundaria.id)})
        self.assertEqual(response_sec.status_code, status.HTTP_200_OK)
        items_sec = {item["sku"]: item for item in response_sec.data["items"]}
        self.assertEqual(items_sec["ARROZ-001"]["qty_on_hand"], "5.00")
        self.assertEqual(items_sec["FRIJOL-001"]["qty_on_hand"], "0.00")

        # 4. Verificar que productos con stock=0 siempre están incluidos
        self.assertTrue(any(item["qty_on_hand"] == "0.00" for item in response.data["items"]))
        self.assertTrue(any(item["qty_on_hand"] != "0.00" for item in response.data["items"]))





