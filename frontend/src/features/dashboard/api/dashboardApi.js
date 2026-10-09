// frontend/src/features/dashboard/api/dashboardApi.js
import api from "../../../lib/axios";

/**
 * Consulta el resumen gerencial del Dashboard Administrativo (KPIs, gráfica de 7 días, alertas y actividad reciente).
 * @param {Object} params - Parámetros opcionales de búsqueda (ej. { branch: "<uuid>" })
 * @returns {Promise<Object>} Resumen con scope, kpis, chart_data, alerts y recent_activity.
 */
export async function getDashboardSummary(params = {}) {
  const response = await api.get("/dashboard/summary/", { params });
  return response.data;
}

/**
 * Consulta el resumen del Dashboard exclusivo para el rol de Compras (Purchasing).
 * Retorna KPIs de compras e inventario, gráfico de 7 días de compras, alertas de stock crítico y actividad reciente.
 * @param {Object} params - Parámetros opcionales de búsqueda (ej. { branch: "<uuid>" })
 * @returns {Promise<Object>} Resumen con scope, kpis, chart_data, alerts y recent_activity.
 */
export async function getPurchasingDashboardSummary(params = {}) {
  const response = await api.get("/dashboard/purchasing-summary/", { params });
  return response.data;
}
