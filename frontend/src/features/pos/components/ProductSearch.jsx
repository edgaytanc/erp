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
  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onHighlight(selectedIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      onHighlight(selectedIndex - 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (results[selectedIndex]) {
        onAddProduct(results[selectedIndex]);
      }
    }
  }

  return (
    <div className="search-section">
      <h3>Buscar producto</h3>
      <p>Nombre, SKU o código de barra</p>
      <input
        autoFocus
        className="search-input"
        disabled={disabled}
        onChange={(event) => onSearchTermChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Tu usuario necesita una sucursal asignada" : "Escanea o escribe para agregar..."}
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
