export function formatMoney(value) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatNumber(value) {
  return new Intl.NumberFormat("es-GT", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartIsoDate() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function unwrapResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

export function valueFor(row, key, type) {
  const value = row?.[key];

  if (type === "money") return formatMoney(value);
  if (type === "number") return formatNumber(value);
  if (type === "percentage") return `${formatNumber(value)}%`;
  if (type === "date")
    return value ? new Date(value).toLocaleString("es-GT") : "Sin fecha";
  if (key === "type")
    return value === "IN"
      ? "Entrada"
      : value === "OUT"
        ? "Salida"
        : value || "-";
  if (key === "status")
    return value === "OPEN"
      ? "Abierta"
      : value === "CLOSED"
        ? "Cerrada"
        : value || "-";
  return value ?? "-";
}

export function selectedBranchLabel(branchId, branches, data) {
  if (data?.scope?.branch_name) return data.scope.branch_name;
  if (!branchId) return "Todas las sucursales";
  return (
    branches.find((branch) => branch.id === branchId)?.name ||
    "Sucursal seleccionada"
  );
}
