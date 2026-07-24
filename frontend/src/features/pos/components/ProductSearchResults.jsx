import { formatMoney } from "../utils/money";

export function ProductSearchResults({
  isLoading,
  results,
  selectedIndex,
  onSelect,
  onHighlight,
}) {
  if (isLoading) {
    return <div className="pos-search-empty">Buscando productos...</div>;
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div
      className="products-section"
      role="listbox"
      aria-label="Resultados de productos"
    >
      {results.map((product, index) => {
        const isOutOfStock = product.stock !== null && product.stock <= 0;
        return (
          <button
            className={`product-item ${selectedIndex === index ? "selected" : ""} ${isOutOfStock ? "out-of-stock" : ""}`}
            disabled={isOutOfStock}
            key={product.id}
            onClick={() => onSelect(product)}
            onMouseEnter={() => onHighlight(index)}
            type="button"
          >
            <div className="product-info">
              <h4>{product.name}</h4>
              <p>{product.sku}</p>
            </div>
            <div className="product-price">
              <div className="price">{formatMoney(product.price)}</div>
              <div className={`stock ${isOutOfStock ? "out" : ""}`}>
                {product.stock === null
                  ? "Stock sin sucursal"
                  : isOutOfStock
                    ? "Sin stock"
                    : `Stock ${product.stock}`}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
