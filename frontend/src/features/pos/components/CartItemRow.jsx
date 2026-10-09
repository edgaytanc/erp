import { formatMoney } from "../utils/money";

export function CartItemRow({
  item,
  onFocusSearch,
  onRemove,
  onUpdateQuantity,
}) {
  const subtotal = Number(item.unitPrice || 0) * item.quantity;

  const handleDecrease = () => {
    onUpdateQuantity(item.productId, item.quantity - 1);
    onFocusSearch?.();
  };

  const handleIncrease = () => {
    onUpdateQuantity(item.productId, item.quantity + 1);
    onFocusSearch?.();
  };

  const handleInputChange = (event) => {
    const value = Number(event.target.value);
    onUpdateQuantity(item.productId, value, false);
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onFocusSearch?.();
    }
  };

  const handleInputBlur = () => {
    onFocusSearch?.();
  };

  const handleRemove = () => {
    onRemove(item.productId);
    onFocusSearch?.();
  };

  return (
    <div className="cart-item">
      <div className="cart-item-info">
        <div className="cart-item-name" title={item.name}>
          {item.name}
        </div>
        <div className="cart-item-sku">{item.sku}</div>
      </div>
      <div className="quantity-controls">
        <button
          aria-label={`Disminuir cantidad de ${item.name}`}
          className="qty-btn"
          onClick={handleDecrease}
          type="button"
        >
          -
        </button>
        <input
          aria-label={`Cantidad de ${item.name}`}
          className="qty-value"
          max={item.stock}
          min="1"
          onBlur={handleInputBlur}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          type="number"
          value={item.quantity}
        />
        <button
          aria-label={`Aumentar cantidad de ${item.name}`}
          className="qty-btn"
          onClick={handleIncrease}
          type="button"
        >
          +
        </button>
      </div>
      <div className="cart-item-price">{formatMoney(item.unitPrice)}</div>
      <div className="cart-item-total">{formatMoney(subtotal)}</div>
      <button
        aria-label={`Quitar ${item.name} del carrito`}
        className="btn-remove"
        onClick={handleRemove}
        type="button"
      >
        Quitar
      </button>
    </div>
  );
}
