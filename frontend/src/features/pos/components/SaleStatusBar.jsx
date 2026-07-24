const statusLabels = {
  idle: "Venta en edición",
  syncing: "Sincronizando venta",
  confirmed: "Venta confirmada",
  cancelled: "Venta anulada",
  error: "Requiere atención",
};

export function SaleStatusBar({ cartCount, draftSaleId, status, branchName }) {
  return (
    <div className="status-bar">
      <div className="status-item">
        <span className={`status-dot status-dot--${status}`} />
        <strong>{statusLabels[status] || statusLabels.idle}</strong>
      </div>
      <div className="status-item">
        <strong>{cartCount}</strong>{" "}
        {cartCount === 1 ? "producto" : "productos"} en carrito
      </div>
      {draftSaleId ? (
        <div className="status-item">
          Draft <strong>{String(draftSaleId).slice(0, 8)}</strong>
        </div>
      ) : (
        <div className="status-item">Sin draft</div>
      )}
      {branchName ? (
        <div className="status-item">
          Sucursal: <strong>{branchName}</strong>
        </div>
      ) : null}
      <div className="shortcuts">
        <span>
          <span className="shortcut">F2</span> buscar
        </span>
        <span>
          <span className="shortcut">↑↓</span> navegar
        </span>
        <span>
          <span className="shortcut">Enter</span> agregar
        </span>
        <span>
          <span className="shortcut">F4/F9</span> cobrar
        </span>
        <span>
          <span className="shortcut">Esc</span> cancelar
        </span>
      </div>
    </div>
  );
}
