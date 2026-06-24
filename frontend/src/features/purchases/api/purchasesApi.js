import api from "../../../lib/axios";

export async function listSuppliers(params = {}) {
  const response = await api.get("/suppliers/", { params });
  return response.data;
}

export async function createSupplier(payload) {
  const response = await api.post("/suppliers/", payload);
  return response.data;
}

export async function updateSupplier(supplierId, payload) {
  const response = await api.put(`/suppliers/${supplierId}/`, payload);
  return response.data;
}

export async function deleteSupplier(supplierId) {
  const response = await api.delete(`/suppliers/${supplierId}/`);
  return response.data;
}

export async function listPurchases(params = {}) {
  const response = await api.get("/purchases/", { params });
  return response.data;
}

export async function listDraftPurchases(params = {}) {
  const response = await api.get("/purchases/drafts/", { params });
  return response.data;
}

export async function createPurchase(payload) {
  const response = await api.post("/purchases/", payload);
  return response.data;
}

export async function confirmPurchase(purchaseId) {
  const response = await api.post(`/purchases/${purchaseId}/confirm/`, {});
  return response.data;
}

export function unwrapResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}
