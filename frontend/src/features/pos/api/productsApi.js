import api from "../../../lib/axios";

export async function searchProducts(params = {}) {
  const response = await api.get("/inventory/products/", { params });
  return response.data;
}
