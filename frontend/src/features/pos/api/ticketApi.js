import api from "../../../lib/axios";

export async function getSaleTicket(saleId) {
  const response = await api.get(`/sales/${saleId}/ticket/`);
  return response.data;
}
