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
        <p>Confirma con cuanto cancela el cliente y verifica el vuelto antes de cerrar la venta.</p>
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
          <div>
            <span>Vuelto</span>
            <strong>{formatMoney(change)}</strong>
          </div>
        </div>
        {!isValid ? (
          <div className="pos-cash-warning">El efectivo recibido debe cubrir el total.</div>
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
