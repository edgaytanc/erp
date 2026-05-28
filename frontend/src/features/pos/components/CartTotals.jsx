import { formatMoney } from "../utils/money";

export function CartTotals({ totals }) {
  return (
    <section className="pos-panel pos-panel--totals">
      <div className="pos-total-line">
        <span>Subtotal</span>
        <strong>{formatMoney(totals.subtotal)}</strong>
      </div>
      <div className="pos-total-line">
        <span>Descuento</span>
        <strong>{formatMoney(totals.discount)}</strong>
      </div>
      <div className="pos-total-line">
        <span>Impuestos</span>
        <strong>{formatMoney(totals.tax)}</strong>
      </div>
      <div className="pos-total-line pos-total-line--grand">
        <span>Total</span>
        <strong>{formatMoney(totals.total)}</strong>
      </div>
    </section>
  );
}
