import { formatMoney } from "../utils/money";

export function CartItemRow({ item, onRemove, onUpdateQuantity }) {
  const subtotal = Number(item.unitPrice || 0) * item.quantity;

  return (
    <div className="pos-cart-row">
      <div className="pos-cart-row__product">
        <strong>{item.name}</strong>
        <span>{item.sku}</span>
      </div>
      <div className="pos-cart-row__quantity">
        <button type="button" onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}>
          -
        </button>
        <input
          aria-label={`Cantidad de ${item.name}`}
          min="1"
          max={item.stock}
          onChange={(event) => onUpdateQuantity(item.productId, event.target.value)}
          type="number"
          value={item.quantity}
        />
        <button type="button" onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}>
          +
        </button>
      </div>
      <span className="pos-cart-row__price">{formatMoney(item.unitPrice)}</span>
      <strong className="pos-cart-row__subtotal">{formatMoney(subtotal)}</strong>
      <button className="pos-icon-button" onClick={() => onRemove(item.productId)} type="button">
        Quitar
      </button>
    </div>
  );
}
