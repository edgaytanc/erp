from django.urls import path

from .views import (
    CriticalStockReportView,
    InventoryByBranchReportView,
    InventoryMovementsReportView,
    InventoryReportView,
    InventoryValueReportView,
    PurchasedProductsReportView,
    PurchasesBySupplierReportView,
    PurchasesReportView,
    PurchasesVsSalesReportView,
    SalesByCategoryReportView,
    SalesByProductReportView,
    SalesReportView,
)

urlpatterns = [
    path("reports/sales/", SalesReportView.as_view(), name="reports-sales"),
    path(
        "reports/sales/by-product/",
        SalesByProductReportView.as_view(),
        name="reports-sales-by-product",
    ),
    path(
        "reports/sales/by-category/",
        SalesByCategoryReportView.as_view(),
        name="reports-sales-by-category",
    ),
    path("reports/purchases/", PurchasesReportView.as_view(), name="reports-purchases"),
    path(
        "reports/purchases/by-supplier/",
        PurchasesBySupplierReportView.as_view(),
        name="reports-purchases-by-supplier",
    ),
    path(
        "reports/purchases/products/",
        PurchasedProductsReportView.as_view(),
        name="reports-purchased-products",
    ),
    path(
        "reports/purchases-vs-sales/",
        PurchasesVsSalesReportView.as_view(),
        name="reports-purchases-vs-sales",
    ),
    path("reports/inventory/", InventoryReportView.as_view(), name="reports-inventory"),
    path(
        "reports/inventory/critical-stock/",
        CriticalStockReportView.as_view(),
        name="reports-critical-stock",
    ),
    path(
        "reports/inventory/value/",
        InventoryValueReportView.as_view(),
        name="reports-inventory-value",
    ),
    path(
        "reports/inventory/by-branch/",
        InventoryByBranchReportView.as_view(),
        name="reports-inventory-by-branch",
    ),
    path(
        "reports/inventory/movements/",
        InventoryMovementsReportView.as_view(),
        name="reports-inventory-movements",
    ),
]
