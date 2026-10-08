import api from "../../../lib/axios";

/**
 * Obtiene la lista de notificaciones para el usuario/sucursal actual.
 * Parámetros opcionales: { is_read, notification_type, branch, page }
 */
export async function listNotifications(params = {}) {
  const response = await api.get("/notifications/", { params });
  return response.data;
}

/**
 * Marca una notificación específica como leída en el backend.
 */
export async function markNotificationAsRead(id) {
  const response = await api.post(`/notifications/${id}/mark_as_read/`);
  return response.data;
}

/**
 * Marca todas las notificaciones no leídas de la sucursal actual como leídas.
 */
export async function markAllNotificationsAsRead() {
  const response = await api.post("/notifications/mark_all_as_read/");
  return response.data;
}

/**
 * Extrae los resultados de una respuesta paginada o lista directa.
 */
export function unwrapResults(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}
