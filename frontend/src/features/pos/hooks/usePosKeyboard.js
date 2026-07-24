import { useEffect } from "react";

export function usePosKeyboard({
  enabled = true,
  onConfirm,
  onCancel,
  onSearchFocus,
  onNavigateResults,
  onAddSelectedProduct,
}) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function handleKeyDown(event) {
      // 1. F2: Focus Search Input
      if (event.key === "F2") {
        event.preventDefault();
        onSearchFocus?.();
        return;
      }

      // 2. F4 or F9: Confirm / Cobrar
      if (event.key === "F4" || event.key === "F9") {
        event.preventDefault();
        onConfirm?.();
        return;
      }

      // 3. Escape: Cancel / Clear
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
        return;
      }

      // Check if a modal is open. If so, do not hijack global Arrows or Enter.
      const isModalOpen =
        document.querySelector(".pos-modal-backdrop") !== null;
      if (isModalOpen) {
        return;
      }

      // Also, if the active element is an input (e.g. quantity input),
      // we don't want to hijack ArrowUp/ArrowDown or Enter.
      // Exception: the search input itself.
      const activeEl = document.activeElement;
      const isInput = activeEl && activeEl.tagName === "INPUT";
      const isSearchInput =
        activeEl && activeEl.classList.contains("search-input");

      if (isInput && !isSearchInput) {
        return;
      }

      // 4. ArrowUp / ArrowDown: Navigate Results
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        onNavigateResults?.(event.key === "ArrowUp" ? "up" : "down");
        return;
      }

      // 5. Enter: Add Selected Product
      if (event.key === "Enter") {
        event.preventDefault();
        onAddSelectedProduct?.();
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
  ]);
}
