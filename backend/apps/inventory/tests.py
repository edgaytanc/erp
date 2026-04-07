from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Branch, Company
from apps.inventory.models import Category, Product, ReferenceType
from apps.inventory.services import apply_inventory_movement


class InventoryAPITestCase(APITestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.admin_user = self.user_model.objects.create_user(
            username="admin",
            password="admin123",
            role="admin",
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

    def test_stock_list_can_filter_low_stock_per_branch(self):
        apply_inventory_movement(
            branch=self.branch,
            product=self.product,
            movement_type="IN",
            qty=Decimal("4.00"),
            reference_type=ReferenceType.PURCHASE,
            reference_id=None,
            unit_cost=Decimal("7.50"),
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
        )

        url = reverse("inventory-stocks-summary")
        response = self.client.get(url, {"branch": str(self.branch.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["low_stock_count"], 1)
        self.assertEqual(response.data["lowest_items"][0]["sku"], "ARROZ-001")