import { CartItemRow } from "./CartItemRow";

export function CartPanel({ items, onRemove, onUpdateQuantity }) {
  return (
    <div className="cart-section">
      <h3>Carrito</h3>
      <p>Actualización inmediata de cantidades</p>

      {items.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-cart-icon">🛒</div>
          <p>El carrito está vacío</p>
        </div>
      ) : (
        <div id="cart-content">
          <div className="cart-header">
            <div>Producto</div>
            <div>Cant.</div>
            <div>Precio</div>
            <div>Total</div>
            <div></div>
          </div>
          {items.map((item) => (
            <CartItemRow
              item={item}
              key={item.productId}
              onRemove={onRemove}
              onUpdateQuantity={onUpdateQuantity}
            />
          ))}
        </div>
      )}
    </div>
  );
}
