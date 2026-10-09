import { useEffect } from "react";

export function usePosKeyboard({
  enabled = true,
  onConfirm,
  onCancel,
  onSearchFocus,
  onNavigateResults,
  onAddSelectedProduct,
  onEnter,
}) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function handleKeyDown(event) {
      // 1. F2: Enfoque al input de búsqueda
      if (event.key === "F2") {
        event.preventDefault();
        onSearchFocus?.();
        return;
      }

      // 2. F4 o F9: Confirmar / Cobrar
      if (event.key === "F4" || event.key === "F9") {
        event.preventDefault();
        onConfirm?.();
        return;
      }

      // 3. Escape: Cancelar modal / Limpiar
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
        return;
      }

      // Si un modal está abierto, no secuestrar flechas ni Enter globales
      const isModalOpen =
        document.querySelector(".pos-modal-backdrop") !== null;
      if (isModalOpen) {
        return;
      }

      // Si el elemento activo es un input que NO sea el de búsqueda (ej. cantidad),
      // no interceptar flechas ni Enter.
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
      const isSearchInput =
        activeEl && activeEl.classList.contains("search-input");

      if (isInput && !isSearchInput) {
        return;
      }

      // 4. ArrowUp / ArrowDown: Navegar por los resultados
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        onNavigateResults?.(event.key === "ArrowUp" ? "up" : "down");
        return;
      }

      // 5. Enter: Auto-Add / Escáner de código de barras / Selección
      if (event.key === "Enter") {
        event.preventDefault();
        if (onEnter) {
          onEnter();
        } else if (onAddSelectedProduct) {
          onAddSelectedProduct();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    onConfirm,
    onCancel,
    onSearchFocus,
    onNavigateResults,
    onAddSelectedProduct,
    onEnter,
  ]);
}
