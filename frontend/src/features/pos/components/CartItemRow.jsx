import { formatMoney } from "../utils/money";

export function CartItemRow({ item, onRemove, onUpdateQuantity }) {
  const subtotal = Number(item.unitPrice || 0) * item.quantity;

  return (
    <div className="cart-item">
      <div>
        <div className="cart-item-name">{item.name}</div>
        <div className="cart-item-sku">{item.sku}</div>
      </div>
      <div className="quantity-controls">
        <button
          className="qty-btn"
          onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
          type="button"
        >
          -
        </button>
        <input
          aria-label={`Cantidad de ${item.name}`}
          className="qty-value"
          min="1"
          max={item.stock}
          onChange={(event) => onUpdateQuantity(item.productId, Number(event.target.value))}
          type="number"
          value={item.quantity}
        />
        <button
          className="qty-btn"
          onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
          type="button"
        >
          +
        </button>
      </div>
      <div className="cart-item-price">{formatMoney(item.unitPrice)}</div>
      <div className="cart-item-total">{formatMoney(subtotal)}</div>
      <button
        className="btn-remove"
        onClick={() => onRemove(item.productId)}
        type="button"
      >
        Quitar
      </button>
    </div>
  );
}
