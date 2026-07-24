import api from "../../../lib/axios";

export async function listCategories(params = {}) {
  const response = await api.get("/inventory/categories/", { params });
  return response.data;
}

export async function createCategory(payload) {
  const response = await api.post("/inventory/categories/", payload);
  return response.data;
}

export async function updateCategory(categoryId, payload) {
  const response = await api.put(
    `/inventory/categories/${categoryId}/`,
    payload,
  );
  return response.data;
}

export async function deleteCategory(categoryId) {
  const response = await api.delete(`/inventory/categories/${categoryId}/`);
  return response.data;
}

export async function listProducts(params = {}) {
  const response = await api.get("/inventory/products/", { params });
  return response.data;
}

export async function createProduct(payload) {
  const response = await api.post("/inventory/products/", payload);
  return response.data;
}

export async function updateProduct(productId, payload) {
  const response = await api.patch(
    `/inventory/products/${productId}/`,
    payload,
  );
  return response.data;
}

export async function deactivateProduct(productId) {
  const response = await api.delete(`/inventory/products/${productId}/`);
  return response.data;
}

export async function listStocks(params = {}) {
  const response = await api.get("/inventory/stocks/", { params });
  return response.data;
}

export async function getStockSummary(params = {}) {
  const response = await api.get("/inventory/stocks/summary/", { params });
  return response.data;
}

export async function listStockMovements(params = {}) {
  const response = await api.get("/inventory/movements/", { params });
  return response.data;
}

export function unwrapResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}
