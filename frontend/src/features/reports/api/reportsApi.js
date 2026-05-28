import api from "../../../lib/axios";

export async function getSalesReport(params = {}) {
  const response = await api.get("/reports/sales/", { params });
  return response.data;
}

export async function getPurchasesReport(params = {}) {
  const response = await api.get("/reports/purchases/", { params });
  return response.data;
}

export async function getInventoryReport(params = {}) {
  const response = await api.get("/reports/inventory/", { params });
  return response.data;
}
