from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Branch, Company


class AdminConfigApiTestCase(APITestCase):
    def setUp(self):
        self.user_model = get_user_model()
        self.admin_user = self.user_model.objects.create_user(
            username="admin_config",
            password="admin123",
            role="admin",
        )
        self.sales_user = self.user_model.objects.create_user(
            username="sales_config",
            password="sales123",
            role="sales",
        )

    def authenticate_admin(self):
        self.client.force_authenticate(user=self.admin_user)

    def authenticate_sales(self):
        self.client.force_authenticate(user=self.sales_user)

    def test_only_admin_can_access_config_module(self):
        self.authenticate_sales()
        response = self.client.get(reverse("config-companies-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_manage_company_branch_and_settings(self):
        self.authenticate_admin()

        company_response = self.client.post(
            reverse("config-companies-list"),
            {
                "name": "ERP Demo",
                "tax_id": "1234567-8",
                "address": "Zona 1",
                "phone": "55550000",
                "logo": "https://example.test/logo.png",
                "receipt_header": "Gracias por su compra",
                "receipt_footer": "Vuelva pronto",
            },
            format="json",
        )
        self.assertEqual(company_response.status_code, status.HTTP_201_CREATED)
        company_id = company_response.data["id"]

        branch_response = self.client.post(
            reverse("config-branches-list"),
            {
                "company": company_id,
                "name": "Central",
                "address": "Zona 1",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(branch_response.status_code, status.HTTP_201_CREATED)

        settings_response = self.client.post(
            reverse("config-company-settings-list"),
            {
                "company": company_id,
                "currency_code": "GTQ",
                "currency_symbol": "Q",
                "tax_rate": "0.1200",
                "money_rounding": "0.0100",
                "sale_void_window_minutes": 15,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(settings_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(settings_response.data["tax_rate"]), Decimal("0.1200"))

    def test_admin_can_assign_branch_to_user(self):
        self.authenticate_admin()
        company = Company.objects.create(name="ERP Demo")
        branch = Branch.objects.create(company=company, name="Central")
        user = self.user_model.objects.create_user(
            username="seller_branch",
            password="seller123",
            role="sales",
        )

        response = self.client.patch(
            reverse("users_detail", args=[user.id]),
            {
                "branch": str(branch.id),
                "role": "sales",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.branch_id, branch.id)
