import { useState } from "react";

import { Button } from "../../../components/common/Button";

export function CancelSaleModal({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState("");

  if (!open) {
    return null;
  }

  return (
    <div className="pos-modal-backdrop" role="presentation">
      <section aria-modal="true" className="pos-modal" role="dialog">
        <h2>Anular venta</h2>
        <p>Esta accion revierte la venta confirmada e impacta inventario.</p>
        <label className="pos-cancel-reason" htmlFor="pos-cancel-reason">
          <span>Motivo</span>
          <textarea
            id="pos-cancel-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo de anulacion"
            rows="3"
            value={reason}
          />
        </label>
        <div className="pos-modal__actions">
          <Button onClick={() => onConfirm(reason)}>Confirmar anulacion</Button>
          <Button onClick={onClose} variant="secondary">
            Volver
          </Button>
        </div>
      </section>
    </div>
  );
}
