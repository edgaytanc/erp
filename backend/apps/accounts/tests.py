from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

User = get_user_model()


class AuthFlowTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="admin1", password="Admin12345", role="admin")
        self.purchases = User.objects.create_user(username="buyer1", password="Buyer12345", role="purchases")
        self.sales = User.objects.create_user(username="seller1", password="Seller12345", role="sales")

    def _login(self, username, password):
        res = self.client.post(reverse("token_obtain_pair"), {"username": username, "password": password}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)
        return res.data["access"]

    def test_me_requires_auth(self):
        res = self.client.get(reverse("me"))
        self.assertEqual(res.status_code, 401)

    def test_me_ok(self):
        token = self._login("seller1", "Seller12345")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = self.client.get(reverse("me"))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["username"], "seller1")
        self.assertEqual(res.data["role"], "sales")

    def test_users_is_admin_only(self):
        url = reverse("users_list_create")

        token = self._login("buyer1", "Buyer12345")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get(url).status_code, 403)

        token = self._login("seller1", "Seller12345")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get(url).status_code, 403)

        token = self._login("admin1", "Admin12345")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get(url).status_code, 200)
