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
  const companyTaxId = ticket.company_tax_id;
  const companyPhone = ticket.company_phone;
  const companyAddress = ticket.company_address;
  const receiptHeader = ticket.receipt_header;
  const receiptFooter = ticket.receipt_footer || "Gracias por su compra";
  const subtotal = ticket.subtotal || 0;
  const tax = ticket.tax || 0;
  const total = ticket.total || ticket.sale?.totals?.total || 0;
  const cashReceived = ticket.cash_received;
  const cashChange = ticket.cash_change;
  const paymentMethod = ticket.payment_method;

  return (
    <section className="pos-panel pos-ticket">
      <div className="pos-ticket__header">
        <strong>{companyName}</strong>
        {branchName ? <span>{branchName}</span> : null}
        {companyTaxId ? <span>NIT {companyTaxId}</span> : null}
        {companyPhone ? <span>Tel. {companyPhone}</span> : null}
        {companyAddress ? <span>{companyAddress}</span> : null}
        {receiptHeader ? <span>{receiptHeader}</span> : null}
      </div>
      <div className="pos-ticket__meta">
        <span>Ticket</span>
        <strong>{saleId}</strong>
        <span>Estado</span>
        <strong>{status}</strong>
        <span>Pago</span>
        <strong>{paymentMethod === "CASH" ? "Efectivo" : paymentMethod}</strong>
        <span>Fecha</span>
        {soldAt ? <span>{new Date(soldAt).toLocaleString("es-GT")}</span> : null}
      </div>
      <div className="pos-ticket__items">
        {items.map((item) => (
          <div className="pos-ticket__item" key={item.id || item.productId || item.product}>
            <div>
              <span>{item.product_name || item.name}</span>
              <small>
                {Number(item.qty || item.quantity)} x{" "}
                {formatMoney(item.unit_price || item.unitPrice || 0)}
              </small>
            </div>
            <strong>
              {formatMoney(
                item.subtotal || Number(item.unit_price || item.unitPrice || 0) * Number(item.qty || item.quantity),
              )}
            </strong>
          </div>
        ))}
      </div>
      <div className="pos-ticket__totals">
        <div>
          <span>Subtotal</span>
          <strong>{formatMoney(subtotal)}</strong>
        </div>
        <div>
          <span>Impuestos</span>
          <strong>{formatMoney(tax)}</strong>
        </div>
        <div className="pos-ticket__total">
          <span>Total</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        {paymentMethod === "CASH" ? (
          <>
            <div>
              <span>Recibido</span>
              <strong>{formatMoney(cashReceived)}</strong>
            </div>
            <div>
              <span>Vuelto</span>
              <strong>{formatMoney(cashChange)}</strong>
            </div>
          </>
        ) : null}
      </div>
      <div className="pos-ticket__footer">{receiptFooter}</div>
    </section>
  );
}
