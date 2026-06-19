import { formatMoney } from "../utils/money";

export function CartTotals({ totals }) {
  return (
    <div className="summary-section">
      <div className="summary-row">
        <span className="label">Subtotal</span>
        <span className="value">{formatMoney(totals.subtotal)}</span>
      </div>
      <div className="summary-row">
        <span className="label">Descuento</span>
        <span className="value">{formatMoney(totals.discount)}</span>
      </div>
      <div className="summary-row">
        <span className="label">Impuestos</span>
        <span className="value">{formatMoney(totals.tax)}</span>
      </div>
      <div className="summary-total">
        <span className="label">Total</span>
        <span className="value">{formatMoney(totals.total)}</span>
      </div>
    </div>
  );
}
