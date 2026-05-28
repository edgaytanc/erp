import api from "../../../lib/axios";

export async function listCategories(params = {}) {
  const response = await api.get("/inventory/categories/", { params });
  return response.data;
}

export async function createCategory(payload) {
  const response = await api.post("/inventory/categories/", payload);
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

export function unwrapResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}
