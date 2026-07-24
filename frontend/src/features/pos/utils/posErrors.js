export function getPosErrorMessage(error) {
  const status = error?.response?.status;
  const detail =
    error?.response?.data?.detail || error?.response?.data?.message;

  if (detail) {
    return detail;
  }

  if (status === 400) {
    return "La venta tiene datos invalidos. Revisa cantidades y productos.";
  }

  if (status === 403) {
    return "Tu usuario no tiene permisos para completar esta accion.";
  }

  if (status === 404) {
    return "No encontramos el recurso solicitado.";
  }

  if (status === 409) {
    return "Hay un conflicto con la venta. Puede ser stock insuficiente o un estado no valido.";
  }

  return "No se pudo completar la accion. Intenta nuevamente.";
}
