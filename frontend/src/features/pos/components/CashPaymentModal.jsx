import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/common/Button";
import { formatMoney } from "../utils/money";

export function CashPaymentModal({ onClose, onConfirm, open, total }) {
  const [cashReceived, setCashReceived] = useState("");
  const numericTotal = Number(total || 0);
  const numericReceived = Number(cashReceived || 0);
  const change = useMemo(
    () => Math.max(0, numericReceived - numericTotal),
    [numericReceived, numericTotal],
  );
  const isValid = cashReceived !== "" && numericReceived >= numericTotal;

  useEffect(() => {
    if (open) {
      setCashReceived(numericTotal ? numericTotal.toFixed(2) : "");
    }
  }, [numericTotal, open]);

  // Generación inteligente de sugerencias rápidas de efectivo
  const quickCashSuggestions = useMemo(() => {
    if (!numericTotal) return [];

    const suggestions = new Set();
    suggestions.add(numericTotal);

    // Billetes estándar de Quetzales (Q)
    const commonBills = [10, 20, 50, 100, 200];
    commonBills.forEach((bill) => {
      if (bill >= numericTotal) {
        suggestions.add(bill);
      }
    });

    // Múltiplos redondeados hacia arriba
    const ceil10 = Math.ceil(numericTotal / 10) * 10;
    if (ceil10 >= numericTotal) suggestions.add(ceil10);

    const ceil50 = Math.ceil(numericTotal / 50) * 50;
    if (ceil50 >= numericTotal) suggestions.add(ceil50);

    const ceil100 = Math.ceil(numericTotal / 100) * 100;
    if (ceil100 >= numericTotal) suggestions.add(ceil100);

    return Array.from(suggestions)
      .map(Number)
      .sort((a, b) => a - b)
      .slice(0, 6);
  }, [numericTotal]);

  // Confirmar mediante teclado (F4 o F9) cuando el modal está abierto y es válido
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "F4" || event.key === "F9") {
        event.preventDefault();
        if (isValid) {
          onConfirm({ cashReceived: numericReceived.toFixed(2) });
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isValid, numericReceived, onConfirm]);

  if (!open) return null;

  function handleSubmit(event) {
    event.preventDefault();
    if (!isValid) return;
    onConfirm({ cashReceived: numericReceived.toFixed(2) });
  }

  return (
    <div className="pos-modal-backdrop">
      <form className="pos-modal pos-cash-modal" onSubmit={handleSubmit}>
        <h2>Pago en efectivo</h2>
        <p>
          Confirma con cuanto cancela el cliente y verifica el vuelto antes de
          cerrar la venta.
        </p>
        <div className="pos-cash-summary">
          <div>
            <span>Total a cobrar</span>
            <strong>{formatMoney(numericTotal)}</strong>
          </div>
          <label>
            <span>Efectivo recibido</span>
            <input
              autoFocus
              min="0"
              onChange={(event) => setCashReceived(event.target.value)}
              step="0.01"
              type="number"
              value={cashReceived}
            />
          </label>

          {/* Botones de sugerencias de pago rápido */}
          {quickCashSuggestions.length > 0 && (
            <div className="quick-cash-container">
              <span>Accesos rápidos de pago:</span>
              <div className="quick-cash-grid">
                {quickCashSuggestions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`quick-cash-btn ${numericReceived === value ? "active" : ""}`}
                    onClick={() => setCashReceived(value.toFixed(2))}
                  >
                    {value === numericTotal ? "Exacto: " : ""}Q
                    {value.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span>Vuelto</span>
            <strong>{formatMoney(change)}</strong>
          </div>
        </div>
        {!isValid ? (
          <div className="pos-cash-warning">
            El efectivo recibido debe cubrir el total.
          </div>
        ) : null}
        <div className="pos-modal__actions">
          <Button disabled={!isValid} type="submit">
            Confirmar venta
          </Button>
          <Button onClick={onClose} type="button" variant="secondary">
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
