import { ProductSearchResults } from "./ProductSearchResults";

export function ProductSearch({
  inputRef,
  disabled,
  results,
  searchTerm,
  selectedIndex,
  onAddProduct,
  onHighlight,
  onSearchTermChange,
  isLoading,
}) {
  return (
    <div className="search-section">
      <h3>Buscar producto</h3>
      <p>Nombre, SKU o código de barra</p>
      <input
        autoFocus
        className="search-input"
        disabled={disabled}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder={
          disabled
            ? "Tu usuario necesita una sucursal asignada"
            : "Escanea o escribe para agregar..."
        }
        ref={inputRef}
        type="text"
        value={searchTerm}
      />
      <ProductSearchResults
        isLoading={isLoading}
        onHighlight={onHighlight}
        onSelect={onAddProduct}
        results={results}
        selectedIndex={selectedIndex}
      />
    </div>
  );
}
