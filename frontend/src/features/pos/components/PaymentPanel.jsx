const paymentMethods = [
  { label: "Efectivo", value: "CASH" },
  { label: "Tarjeta", value: "CARD" },
  { label: "Transferencia", value: "TRANSFER" },
];

export function PaymentPanel({ paymentMethod, onChange }) {
  return (
    <section className="pos-panel">
      <div className="pos-panel__header">
        <div>
          <h2>Pago</h2>
          <p>Metodo de pago de la venta</p>
        </div>
      </div>
      <div className="pos-payment-options">
        {paymentMethods.map((method) => (
          <button
            className={`pos-payment-option ${paymentMethod === method.value ? "pos-payment-option--active" : ""}`}
            key={method.value}
            onClick={() => onChange(method.value)}
            type="button"
          >
            {method.label}
          </button>
        ))}
      </div>
    </section>
  );
}
