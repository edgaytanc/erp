from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Branch, Company
from apps.inventory.models import Category, Product, ReferenceType, Stock, StockMovement
from apps.purchases.models import Purchase, PurchaseStatus, Supplier


class PurchasesApiIntegrationTestCase(APITestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.admin_user = self.user_model.objects.create_user(
            username="admin_purchases",
            password="admin123",
            role="admin",
        )
        self.purchases_user = self.user_model.objects.create_user(
            username="buyer",
            password="buyer123",
            role="purchases",
        )
        self.sales_user = self.user_model.objects.create_user(
            username="seller",
            password="seller123",
            role="sales",
        )

        self.company = Company.objects.create(name="ERP Demo")
        self.branch = Branch.objects.create(company=self.company, name="Central", is_active=True)
        self.category = Category.objects.create(name="Abarrotes")
        self.product = Product.objects.create(
            category=self.category,
            sku="ARROZ-001",
            name="Arroz",
            sale_price=Decimal("25.00"),
            cost_price=Decimal("8.00"),
            min_stock=Decimal("5.00"),
        )
        self.product_2 = Product.objects.create(
            category=self.category,
            sku="FRIJOL-001",
            name="Frijol",
            sale_price=Decimal("18.00"),
            cost_price=Decimal("7.50"),
            min_stock=Decimal("3.00"),
        )
        self.supplier = Supplier.objects.create(
            name="Proveedor Demo",
            contact_name="Mario",
            phone="55555555",
            address="Zona 1",
            is_active=True,
        )

    def authenticate_purchases(self):
        self.client.force_authenticate(user=self.purchases_user)

    def authenticate_sales(self):
        self.client.force_authenticate(user=self.sales_user)

    def purchase_payload(self):
        return {
            "branch": str(self.branch.id),
            "supplier": str(self.supplier.id),
            "invoice_number": "FAC-001",
            "items": [
                {
                    "product": str(self.product.id),
                    "qty": "3.000",
                    "unit_cost": "9.50",
                },
                {
                    "product": str(self.product_2.id),
                    "qty": "2.000",
                    "unit_cost": "8.25",
                },
            ],
        }

    def test_supplier_crud_is_available_for_purchases_role(self):
        self.authenticate_purchases()

        create_response = self.client.post(
            reverse("suppliers-list"),
            {
                "name": "Proveedor Nuevo",
                "contact_name": "Ana",
                "phone": "44444444",
                "address": "Zona 10",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        supplier_id = create_response.data["id"]

        list_response = self.client.get(reverse("suppliers-list"))
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 2)

        update_response = self.client.patch(
            reverse("suppliers-detail", args=[supplier_id]),
            {"phone": "77777777"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["phone"], "77777777")

    def test_sales_role_cannot_access_purchases_module(self):
        self.authenticate_sales()

        response = self.client.get(reverse("suppliers-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_and_confirm_purchase_impacts_inventory_and_updates_cost(self):
        self.authenticate_purchases()

        create_response = self.client.post(reverse("purchases-list"), self.purchase_payload(), format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["status"], PurchaseStatus.DRAFT)
        self.assertEqual(len(create_response.data["items"]), 2)

        purchase_id = create_response.data["id"]

        confirm_response = self.client.post(reverse("purchases-confirm", args=[purchase_id]), {}, format="json")
        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.assertEqual(confirm_response.data["status"], PurchaseStatus.CONFIRMED)
        self.assertEqual(confirm_response.data["total_cost"], "45.00")
        self.assertIsNotNone(confirm_response.data["purchased_at"])

        stock_product_1 = Stock.objects.get(branch=self.branch, product=self.product)
        stock_product_2 = Stock.objects.get(branch=self.branch, product=self.product_2)
        self.assertEqual(stock_product_1.qty_on_hand, Decimal("3.00"))
        self.assertEqual(stock_product_2.qty_on_hand, Decimal("2.00"))

        self.product.refresh_from_db()
        self.product_2.refresh_from_db()
        self.assertEqual(self.product.cost_price, Decimal("9.50"))
        self.assertEqual(self.product_2.cost_price, Decimal("8.25"))

        movements = StockMovement.objects.filter(reference_type=ReferenceType.PURCHASE, reference_id=str(purchase_id))
        self.assertEqual(movements.count(), 2)

    def test_confirm_purchase_is_idempotent_and_does_not_duplicate_stock(self):
        self.authenticate_purchases()
        create_response = self.client.post(reverse("purchases-list"), self.purchase_payload(), format="json")
        purchase_id = create_response.data["id"]

        first_confirm = self.client.post(reverse("purchases-confirm", args=[purchase_id]), {}, format="json")
        second_confirm = self.client.post(reverse("purchases-confirm", args=[purchase_id]), {}, format="json")

        self.assertEqual(first_confirm.status_code, status.HTTP_200_OK)
        self.assertEqual(second_confirm.status_code, status.HTTP_200_OK)

        stock_product_1 = Stock.objects.get(branch=self.branch, product=self.product)
        self.assertEqual(stock_product_1.qty_on_hand, Decimal("3.00"))
        self.assertEqual(
            StockMovement.objects.filter(reference_type=ReferenceType.PURCHASE, reference_id=str(purchase_id)).count(),
            2,
        )

    def test_cannot_confirm_purchase_without_items(self):
        self.authenticate_purchases()
        purchase = Purchase.objects.create(branch=self.branch, supplier=self.supplier)

        response = self.client.post(reverse("purchases-confirm", args=[purchase.id]), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("sin items", response.data["detail"])

    def test_cannot_edit_confirmed_purchase(self):
        self.authenticate_purchases()
        create_response = self.client.post(reverse("purchases-list"), self.purchase_payload(), format="json")
        purchase_id = create_response.data["id"]
        self.client.post(reverse("purchases-confirm", args=[purchase_id]), {}, format="json")

        response = self.client.patch(
            reverse("purchases-detail", args=[purchase_id]),
            {"invoice_number": "FAC-EDITADA"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Solo DRAFT", response.data["detail"])

    def test_cancel_purchase_allows_draft_but_blocks_confirmed(self):
        self.authenticate_purchases()
        create_response = self.client.post(reverse("purchases-list"), self.purchase_payload(), format="json")
        purchase_id = create_response.data["id"]

        cancel_response = self.client.post(
            reverse("purchases-cancel", args=[purchase_id]),
            {"reason": "Factura anulada"},
            format="json",
        )
        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_response.data["status"], PurchaseStatus.CANCELLED)
        self.assertEqual(cancel_response.data["cancel_reason"], "Factura anulada")

        second_confirm = self.client.post(reverse("purchases-confirm", args=[purchase_id]), {}, format="json")
        self.assertEqual(second_confirm.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancelada", second_confirm.data["detail"])

    def test_cannot_cancel_confirmed_purchase(self):
        self.authenticate_purchases()
        create_response = self.client.post(reverse("purchases-list"), self.purchase_payload(), format="json")
        purchase_id = create_response.data["id"]
        self.client.post(reverse("purchases-confirm", args=[purchase_id]), {}, format="json")

        response = self.client.post(
            reverse("purchases-cancel", args=[purchase_id]),
            {"reason": "Tarde"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Solo se puede cancelar", response.data["detail"])

    def test_create_purchase_rejects_duplicate_products(self):
        self.authenticate_purchases()
        payload = self.purchase_payload()
        payload["items"] = [
            {
                "product": str(self.product.id),
                "qty": "1.000",
                "unit_cost": "9.50",
            },
            {
                "product": str(self.product.id),
                "qty": "2.000",
                "unit_cost": "9.75",
            },
        ]

        response = self.client.post(reverse("purchases-list"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("productos repetidos", str(response.data).lower())

    def test_create_purchase_rejects_inactive_supplier(self):
        self.authenticate_purchases()
        self.supplier.is_active = False
        self.supplier.save(update_fields=["is_active"])

        response = self.client.post(reverse("purchases-list"), self.purchase_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("proveedor", str(response.data).lower())