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
  onOpenRecommendation,
}) {
  return (
    <div className="search-section">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "4px",
        }}
      >
        <div>
          <h3>Buscar producto</h3>
          <p>Nombre, SKU o código de barra</p>
        </div>
        <button
          type="button"
          className="btn-recommend"
          onClick={onOpenRecommendation}
          disabled={disabled}
          title="Recomendar productos al cliente por necesidades o problemas"
        >
          ✨ Recomendar producto
        </button>
      </div>

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
