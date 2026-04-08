import api from "../../../lib/axios";

export async function listSales(params = {}) {
  const response = await api.get("/sales/", { params });
  return response.data;
}
