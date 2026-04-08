export function extractApiErrorMessage(error, fallbackMessage = "Ha ocurrido un error.") {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  const data = error?.response?.data;

  if (data && typeof data === "object") {
    const firstValue = Object.values(data)[0];

    if (Array.isArray(firstValue) && firstValue.length > 0) {
      return String(firstValue[0]);
    }

    if (typeof firstValue === "string" && firstValue.trim()) {
      return firstValue;
    }
  }

  return fallbackMessage;
}
