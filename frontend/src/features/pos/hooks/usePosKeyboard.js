import { useEffect } from "react";

export function usePosKeyboard({ enabled = true, onConfirm, onClear, onSearchFocus }) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "F2") {
        event.preventDefault();
        onSearchFocus?.();
      }

      if (event.key === "F9") {
        event.preventDefault();
        onConfirm?.();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClear?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onClear, onConfirm, onSearchFocus]);
}
