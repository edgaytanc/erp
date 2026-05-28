from django.urls import path

from .views import InventoryReportView, PurchasesReportView, SalesReportView

urlpatterns = [
    path("reports/sales/", SalesReportView.as_view(), name="reports-sales"),
    path("reports/purchases/", PurchasesReportView.as_view(), name="reports-purchases"),
    path("reports/inventory/", InventoryReportView.as_view(), name="reports-inventory"),
]
