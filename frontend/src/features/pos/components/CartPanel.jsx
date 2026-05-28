import { CartItemRow } from "./CartItemRow";

export function CartPanel({ items, onRemove, onUpdateQuantity }) {
  return (
    <section className="pos-panel pos-panel--cart">
      <div className="pos-panel__header">
        <div>
          <h2>Carrito</h2>
          <p>Actualizacion inmediata de cantidades</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="pos-cart-empty">
          <strong>Carrito vacio</strong>
          <span>Busca un producto y presiona Enter para agregarlo.</span>
        </div>
      ) : (
        <div className="pos-cart-list">
          <div className="pos-cart-head">
            <span>Producto</span>
            <span>Cant.</span>
            <span>Precio</span>
            <span>Total</span>
            <span />
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
    </section>
  );
}
