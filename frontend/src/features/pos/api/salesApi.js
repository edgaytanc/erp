import api from "../../../lib/axios";

export async function listSales(params = {}) {
  const response = await api.get("/sales/", { params });
  return response.data;
}

export async function createSale(payload) {
  const response = await api.post("/sales/", payload);
  return response.data;
}

export async function updateSale(saleId, payload) {
  const response = await api.patch(`/sales/${saleId}/`, payload);
  return response.data;
}

export async function confirmSale(saleId, payload = {}) {
  const response = await api.post(`/sales/${saleId}/confirm/`, payload);
  return response.data;
}

export async function voidSale(saleId, payload = {}) {
  const response = await api.post(`/sales/${saleId}/void/`, payload);
  return response.data;
}

export async function getCurrentCashRegister() {
  const response = await api.get("/cash-register/current/");
  return response.data;
}

export async function openCashRegister(payload) {
  const response = await api.post("/cash-register/open/", payload);
  return response.data;
}

export async function closeCashRegister(payload) {
  const response = await api.post("/cash-register/close/", payload);
  return response.data;
}
