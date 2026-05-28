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
      onAddProduct(results[selectedIndex]);
    }
  }

  return (
    <section className="pos-panel pos-panel--search">
      <div className="pos-panel__header">
        <div>
          <h2>Buscar producto</h2>
          <p>Nombre, SKU o codigo de barra</p>
        </div>
      </div>
      <input
        autoFocus
        className="pos-search-input"
        disabled={disabled}
        onChange={(event) => onSearchTermChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Tu usuario necesita una sucursal asignada" : "Escanea o escribe para agregar..."}
        ref={inputRef}
        type="search"
        value={searchTerm}
      />
      <ProductSearchResults
        isLoading={isLoading}
        onHighlight={onHighlight}
        onSelect={onAddProduct}
        results={results}
        selectedIndex={selectedIndex}
      />
    </section>
  );
}
