import { formatMoney } from "../utils/money";

export function TicketPreview({ ticket }) {
  if (!ticket) {
    return (
      <section className="pos-panel pos-ticket">
        <div className="pos-ticket__empty">El ticket aparecera al confirmar la venta.</div>
      </section>
    );
  }

  const items = ticket.items || ticket.sale?.items || [];
  const saleId = ticket.id || ticket.sale?.id;
  const status = ticket.status || ticket.sale?.status;
  const soldAt = ticket.sold_at || ticket.sale?.confirmedAt;
  const companyName = ticket.company_name || ticket.businessName || "ERP POS";
  const branchName = ticket.branch_name;
  const receiptFooter = ticket.receipt_footer || "Gracias por su compra";
  const total = ticket.total || ticket.sale?.totals?.total || 0;

  return (
    <section className="pos-panel pos-ticket">
      <div className="pos-ticket__header">
        <strong>{companyName}</strong>
        {branchName ? <span>{branchName}</span> : null}
        <span>Ticket {saleId}</span>
        <span>{status}</span>
        {soldAt ? <span>{new Date(soldAt).toLocaleString("es-GT")}</span> : null}
      </div>
      <div className="pos-ticket__items">
        {items.map((item) => (
          <div className="pos-ticket__item" key={item.id || item.productId || item.product}>
            <span>
              {Number(item.qty || item.quantity)} x {item.product_name || item.name}
            </span>
            <strong>{formatMoney(item.subtotal || Number(item.unit_price || item.unitPrice || 0) * Number(item.qty || item.quantity))}</strong>
          </div>
        ))}
      </div>
      <div className="pos-ticket__total">
        <span>Total</span>
        <strong>{formatMoney(total)}</strong>
      </div>
      <div className="pos-ticket__footer">{receiptFooter}</div>
    </section>
  );
}
