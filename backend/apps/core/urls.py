# backend/apps/core/urls.py
from __future__ import annotations

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import DashboardAPIView, NotificationViewSet, health

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("health/", health, name="health"),
    path("dashboard/summary/", DashboardAPIView.as_view(), name="dashboard-summary"),
    path("dashboard/", DashboardAPIView.as_view(), name="dashboard"),
    path("", include(router.urls)),
]
