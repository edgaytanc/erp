const statusLabels = {
  idle: "Venta en edicion",
  syncing: "Sincronizando venta",
  confirmed: "Venta confirmada",
  cancelled: "Venta anulada",
  error: "Requiere atencion",
};

export function SaleStatusBar({ cartCount, draftSaleId, status }) {
  return (
    <section className="pos-status-bar" aria-label="Estado de venta">
      <div>
        <span className={`pos-status-dot pos-status-dot--${status}`} />
        <strong>{statusLabels[status] || statusLabels.idle}</strong>
      </div>
      <span>{cartCount} productos en carrito</span>
      {draftSaleId ? <span>Draft {String(draftSaleId).slice(0, 8)}</span> : <span>Sin draft</span>}
      <span>F2 buscar</span>
      <span>F9 confirmar</span>
      <span>Esc limpiar</span>
    </section>
  );
}
