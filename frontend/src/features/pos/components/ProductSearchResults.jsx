import { formatMoney } from "../utils/money";

export function ProductSearchResults({ isLoading, results, selectedIndex, onSelect, onHighlight }) {
  if (isLoading) {
    return <div className="pos-search-empty">Buscando productos...</div>;
  }

  if (results.length === 0) {
    return <div className="pos-search-empty">Sin productos para esta busqueda.</div>;
  }

  return (
    <div className="pos-search-results" role="listbox" aria-label="Resultados de productos">
      {results.map((product, index) => (
        <button
          className={`pos-search-result ${selectedIndex === index ? "pos-search-result--active" : ""}`}
          disabled={product.stock !== null && product.stock <= 0}
          key={product.id}
          onClick={() => onSelect(product)}
          onMouseEnter={() => onHighlight(index)}
          type="button"
        >
          <span>
            <strong>{product.name}</strong>
            <small>{product.sku}</small>
          </span>
          <span>
            <strong>{formatMoney(product.price)}</strong>
            <small>{product.stock === null ? "Stock sin sucursal" : product.stock <= 0 ? "Sin stock" : `Stock ${product.stock}`}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
