from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Branch, Company
from apps.inventory.models import Category, Product, ReferenceType, Stock, StockMovement
from apps.inventory.services import (
    apply_inventory_movement,
    register_adjustment,
    register_purchase_entry,
    register_sale_output,
    register_sale_void_entry,
)


class InventoryAPITestCase(APITestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.admin_user = self.user_model.objects.create_user(
            username="admin",
            password="admin123",
            role="admin",
        )
        self.sales_user = self.user_model.objects.create_user(
            username="seller_inventory_read",
            password="seller123",
            role="sales",
        )
        self.company = Company.objects.create(name="ERP Demo")
        self.branch = Branch.objects.create(company=self.company, name="Central")
        self.category = Category.objects.create(name="Abarrotes")
        self.product = Product.objects.create(
            category=self.category,
            sku="ARROZ-001",
            name="Arroz",
            sale_price=Decimal("10.00"),
            cost_price=Decimal("7.50"),
            min_stock=Decimal("5.00"),
        )
        self.client.force_authenticate(user=self.admin_user)

    def test_category_crud_prevents_cycles(self):
        parent = Category.objects.create(name="Padre")
        child = Category.objects.create(name="Hija", parent=parent)

        url = reverse("inventory-categories-detail", args=[parent.id])
        response = self.client.patch(url, {"parent": str(child.id)}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", response.data)

    def test_product_list_supports_text_search(self):
        Product.objects.create(
            sku="FRIJOL-001",
            name="Frijol negro",
            sale_price=Decimal("12.00"),
            cost_price=Decimal("8.00"),
            min_stock=Decimal("3.00"),
        )

        url = reverse("inventory-products-list")
        response = self.client.get(url, {"q": "frijol"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["sku"], "FRIJOL-001")

    def test_product_can_be_updated(self):
        new_category = Category.objects.create(name="Bebidas")

        response = self.client.patch(
            reverse("inventory-products-detail", args=[self.product.id]),
            {
                "category": str(new_category.id),
                "sale_price": "15.50",
                "cost_price": "8.25",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertEqual(self.product.category, new_category)
        self.assertEqual(self.product.sale_price, Decimal("15.50"))
        self.assertEqual(self.product.cost_price, Decimal("8.25"))

    def test_product_delete_deactivates_without_removing(self):
        response = self.client.delete(reverse("inventory-products-detail", args=[self.product.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.product.refresh_from_db()
        self.assertFalse(self.product.is_active)

    def test_sales_role_can_read_inventory_for_pos(self):
        self.client.force_authenticate(user=self.sales_user)

        products_response = self.client.get(reverse("inventory-products-list"), {"q": "arroz"})
        stocks_response = self.client.get(reverse("inventory-stocks-list"), {"branch": str(self.branch.id)})

        self.assertEqual(products_response.status_code, status.HTTP_200_OK)
        self.assertEqual(stocks_response.status_code, status.HTTP_200_OK)

    def test_sales_role_cannot_write_inventory(self):
        self.client.force_authenticate(user=self.sales_user)

        response = self.client.post(
            reverse("inventory-products-list"),
            {
                "category": str(self.category.id),
                "sku": "VENTA-001",
                "name": "Producto desde POS",
                "sale_price": "1.00",
                "cost_price": "1.00",
                "min_stock": "1.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_stock_list_can_filter_low_stock_per_branch(self):
        apply_inventory_movement(
            branch=self.branch,
            product=self.product,
            movement_type="IN",
            qty=Decimal("4.00"),
            reference_type=ReferenceType.PURCHASE,
            reference_id=None,
            unit_cost=Decimal("7.50"),
            created_by=self.admin_user,
        )

        url = reverse("inventory-stocks-list")
        response = self.client.get(url, {"branch": str(self.branch.id), "low": 1})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["product_sku"], "ARROZ-001")
        self.assertTrue(response.data["results"][0]["is_below_min_stock"])

    def test_stock_summary_returns_low_stock_count(self):
        apply_inventory_movement(
            branch=self.branch,
            product=self.product,
            movement_type="IN",
            qty=Decimal("2.00"),
            reference_type=ReferenceType.PURCHASE,
            reference_id=None,
            unit_cost=Decimal("7.50"),
            created_by=self.admin_user,
        )

        url = reverse("inventory-stocks-summary")
        response = self.client.get(url, {"branch": str(self.branch.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["low_stock_count"], 1)
        self.assertEqual(response.data["lowest_items"][0]["sku"], "ARROZ-001")


class InventoryServiceIntegrationTestCase(TestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.admin_user = self.user_model.objects.create_user(
            username="inventory_admin",
            password="admin123",
            role="admin",
        )
        self.company = Company.objects.create(name="ERP Demo")
        self.branch = Branch.objects.create(company=self.company, name="Central")
        self.category = Category.objects.create(name="General")
        self.product = Product.objects.create(
            category=self.category,
            sku="PROD-001",
            name="Producto demo",
            sale_price=Decimal("25.00"),
            cost_price=Decimal("10.00"),
            min_stock=Decimal("5.00"),
        )

    def test_purchase_entry_creates_auditable_movement_and_updates_stock(self):
        movement = register_purchase_entry(
            branch=self.branch,
            product=self.product,
            qty=Decimal("10.00"),
            purchase_id=123,
            unit_cost=Decimal("9.50"),
            created_by=self.admin_user,
        )

        stock = Stock.objects.get(branch=self.branch, product=self.product)

        self.assertEqual(movement.type, StockMovement.Type.IN)
        self.assertEqual(movement.reference_type, ReferenceType.PURCHASE)
        self.assertEqual(movement.reference_id, "123")
        self.assertEqual(movement.stock_before, Decimal("0.00"))
        self.assertEqual(movement.stock_after, Decimal("10.00"))
        self.assertEqual(stock.qty_on_hand, Decimal("10.00"))

    def test_sale_output_decreases_stock_and_stores_before_after(self):
        register_purchase_entry(
            branch=self.branch,
            product=self.product,
            qty=Decimal("10.00"),
            purchase_id=123,
            created_by=self.admin_user,
        )

        movement = register_sale_output(
            branch=self.branch,
            product=self.product,
            qty=Decimal("4.00"),
            sale_id=456,
            created_by=self.admin_user,
        )

        stock = Stock.objects.get(branch=self.branch, product=self.product)

        self.assertEqual(movement.type, StockMovement.Type.OUT)
        self.assertEqual(movement.stock_before, Decimal("10.00"))
        self.assertEqual(movement.stock_after, Decimal("6.00"))
        self.assertEqual(stock.qty_on_hand, Decimal("6.00"))

    def test_sale_void_restores_stock(self):
        register_purchase_entry(
            branch=self.branch,
            product=self.product,
            qty=Decimal("10.00"),
            purchase_id=123,
            created_by=self.admin_user,
        )
        register_sale_output(
            branch=self.branch,
            product=self.product,
            qty=Decimal("4.00"),
            sale_id=456,
            created_by=self.admin_user,
        )

        movement = register_sale_void_entry(
            branch=self.branch,
            product=self.product,
            qty=Decimal("4.00"),
            sale_id=456,
            created_by=self.admin_user,
        )

        stock = Stock.objects.get(branch=self.branch, product=self.product)
        self.assertEqual(movement.reference_type, ReferenceType.SALE_VOID)
        self.assertEqual(movement.stock_before, Decimal("6.00"))
        self.assertEqual(movement.stock_after, Decimal("10.00"))
        self.assertEqual(stock.qty_on_hand, Decimal("10.00"))

    def test_negative_stock_is_blocked(self):
        with self.assertRaisesMessage(Exception, "Stock insuficiente"):
            register_sale_output(
                branch=self.branch,
                product=self.product,
                qty=Decimal("1.00"),
                sale_id=999,
                created_by=self.admin_user,
            )

    def test_adjustment_out_reduces_stock(self):
        register_purchase_entry(
            branch=self.branch,
            product=self.product,
            qty=Decimal("8.00"),
            purchase_id=321,
            created_by=self.admin_user,
        )

        movement = register_adjustment(
            branch=self.branch,
            product=self.product,
            qty=Decimal("-3.00"),
            created_by=self.admin_user,
            note="Merma",
        )

        stock = Stock.objects.get(branch=self.branch, product=self.product)
        self.assertEqual(movement.type, StockMovement.Type.OUT)
        self.assertEqual(stock.qty_on_hand, Decimal("5.00"))
