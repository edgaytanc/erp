export function SaleActions({ canCancel, canConfirm, onCancel, onClear, onConfirm }) {
  return (
    <div className="action-buttons">
      <button
        className="btn btn-primary"
        disabled={!canConfirm}
        onClick={onConfirm}
        type="button"
      >
        Confirmar venta
      </button>
      <button
        className="btn btn-secondary"
        onClick={onClear}
        type="button"
      >
        Nueva venta
      </button>
      <button
        className="btn btn-danger"
        disabled={!canCancel}
        onClick={onCancel}
        type="button"
      >
        Anular
      </button>
      <button
        className="btn btn-success"
        onClick={() => window.print()}
        type="button"
      >
        Imprimir
      </button>
    </div>
  );
}
