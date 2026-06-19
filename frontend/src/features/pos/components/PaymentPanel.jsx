const paymentMethods = [
  { label: "Efectivo", value: "CASH" },
  { label: "Tarjeta", value: "CARD" },
  { label: "Transferencia", value: "TRANSFER" },
];

export function PaymentPanel({ paymentMethod, onChange }) {
  return (
    <div className="payment-section">
      <h3>Pago</h3>
      <p>Método de pago de la venta</p>
      <div className="payment-methods">
        {paymentMethods.map((method) => (
          <button
            className={`payment-method ${paymentMethod === method.value ? "active" : ""}`}
            key={method.value}
            onClick={() => onChange(method.value)}
            type="button"
          >
            {method.label}
          </button>
        ))}
      </div>
    </div>
  );
}
