import api from "../../../lib/axios";

export async function getSalesReport(params = {}) {
  const response = await api.get("/reports/sales/", { params });
  return response.data;
}

export async function getSalesByProductReport(params = {}) {
  const response = await api.get("/reports/sales/by-product/", { params });
  return response.data;
}

export async function getSalesByCategoryReport(params = {}) {
  const response = await api.get("/reports/sales/by-category/", { params });
  return response.data;
}

export async function getCashRegisterReport(params = {}) {
  const response = await api.get("/reports/sales/cash-register/", { params });
  return response.data;
}

export async function getPurchasesReport(params = {}) {
  const response = await api.get("/reports/purchases/", { params });
  return response.data;
}

export async function getPurchasesBySupplierReport(params = {}) {
  const response = await api.get("/reports/purchases/by-supplier/", { params });
  return response.data;
}

export async function getPurchasedProductsReport(params = {}) {
  const response = await api.get("/reports/purchases/products/", { params });
  return response.data;
}

export async function getPurchasesVsSalesReport(params = {}) {
  const response = await api.get("/reports/purchases-vs-sales/", { params });
  return response.data;
}

export async function getInventoryReport(params = {}) {
  const response = await api.get("/reports/inventory/", { params });
  return response.data;
}

export async function getCriticalStockReport(params = {}) {
  const response = await api.get("/reports/inventory/critical-stock/", { params });
  return response.data;
}

export async function getInventoryValueReport(params = {}) {
  const response = await api.get("/reports/inventory/value/", { params });
  return response.data;
}

export async function getInventoryByBranchReport(params = {}) {
  const response = await api.get("/reports/inventory/by-branch/", { params });
  return response.data;
}

export async function getInventoryMovementsReport(params = {}) {
  const response = await api.get("/reports/inventory/movements/", { params });
  return response.data;
}
