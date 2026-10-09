// frontend/src/features/dashboard/api/dashboardApi.js
import api from "../../../lib/axios";

/**
 * Consulta el resumen gerencial del Dashboard (KPIs, gráfica de 7 días, alertas y actividad reciente).
 * @param {Object} params - Parámetros opcionales de búsqueda (ej. { branch: "<uuid>" })
 * @returns {Promise<Object>} Resumen con scope, kpis, chart_data, alerts y recent_activity.
 */
export async function getDashboardSummary(params = {}) {
  const response = await api.get("/dashboard/summary/", { params });
  return response.data;
}
