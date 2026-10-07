import { useState, useRef, useEffect } from "react";
import { getRecommendations } from "../api/productsApi";
import { formatMoney } from "../utils/money";
import { PRODUCT_BENEFIT_MAP } from "../../inventory/constants/productAttributes";

export function ProductRecommendationModal({
  isOpen,
  onClose,
  branchId,
  onAddProduct,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);
  const [addedProductIds, setAddedProductIds] = useState(new Set());
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    } else {
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setError(null);
      setAddedProductIds(new Set());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSearch(e) {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (!branchId) {
      setError("No hay una sucursal seleccionada para consultar el stock.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await getRecommendations({ q: trimmed, branchId });
      setResults(data);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Error al obtener recomendaciones.",
      );
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  }

  function handleAddToCart(product) {
    const branchPrice =
      product.branch_price !== undefined && product.branch_price !== null
        ? product.branch_price
        : product.sale_price !== undefined && product.sale_price !== null
          ? product.sale_price
          : product.price ?? 0;

    onAddProduct({
      id: product.id,
      sku: product.sku,
      name: product.name,
      price: branchPrice,
      sale_price: branchPrice,
      branch_price: branchPrice,
      stock: product.stock,
    });

    setAddedProductIds((prev) => new Set(prev).add(product.id));
  }

  function getMainBenefitLabel(product) {
    if (product.main_benefit) {
      return product.main_benefit;
    }
    if (product.benefits && product.benefits.length > 0) {
      const first = product.benefits[0];
      return PRODUCT_BENEFIT_MAP[first] || first;
    }
    return "Cuidado especializado";
  }

  return (
    <div
      className="pos-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="pos-modal pos-modal--wide"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>✨</span> Recomendación Semántica
            </h2>
            <p style={{ margin: 0, color: "#64748b" }}>
              Busca productos cruzando atributos dermatológicos, beneficios, problemas y palabras clave.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: "4px 10px", fontSize: "16px", lineHeight: 1 }}
            title="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <div className="pos-modal__body">
          <form onSubmit={handleSearch}>
            <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: 700, fontSize: "0.95rem" }}>
              ¿Qué necesita el cliente?
            </label>
            <textarea
              ref={textareaRef}
              className="pos-recommendation-textarea"
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej: Cliente con piel mixta a grasa, busca tratamiento para acné, controlar brillo y manchas en el rostro..."
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Presiona <strong>Enter</strong> o haz clic en buscar
              </span>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || !query.trim()}
                style={{ padding: "8px 18px" }}
              >
                {isLoading ? "Buscando..." : "Buscar recomendaciones"}
              </button>
            </div>
          </form>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                borderRadius: "6px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {isLoading && (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
              <p style={{ fontSize: "1rem", fontWeight: 600 }}>🔍 Analizando necesidades y stock en tiempo real...</p>
            </div>
          )}

          {!isLoading && hasSearched && results.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "2rem", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
              <p style={{ margin: 0, fontWeight: 600, color: "#475569" }}>
                No se encontraron productos disponibles con stock para esta consulta.
              </p>
              <small style={{ color: "#94a3b8" }}>
                Prueba describiendo el tipo de piel (grasa, seca, mixta) o el problema (acné, manchas, arrugas).
              </small>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>
                  {results.length} {results.length === 1 ? "producto recomendado" : "productos recomendados"} con stock
                </span>
              </div>
              <div className="pos-recommendation-grid">
                {results.map((product) => {
                  const isAdded = addedProductIds.has(product.id);
                  const mainBenefit = getMainBenefitLabel(product);
                  const branchPrice =
                    product.branch_price !== undefined && product.branch_price !== null
                      ? product.branch_price
                      : product.sale_price !== undefined && product.sale_price !== null
                        ? product.sale_price
                        : product.price ?? 0;

                  return (
                    <article className="pos-recommendation-card" key={product.id}>
                      <div className="pos-recommendation-card__header">
                        <span className="pos-recommendation-card__sku">{product.sku}</span>
                        <h4 className="pos-recommendation-card__title">{product.name}</h4>
                        <div style={{ marginTop: "4px" }}>
                          <span className="pos-recommendation-card__benefit" title="Beneficio principal">
                            ⭐ {mainBenefit}
                          </span>
                        </div>
                      </div>

                      <div className="pos-recommendation-card__meta">
                        <div>
                          <div className="pos-recommendation-card__price">
                            {formatMoney(branchPrice)}
                          </div>
                          <span className="pos-recommendation-card__stock">
                            Stock: {product.stock}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleAddToCart(product)}
                          style={{
                            padding: "6px 12px",
                            fontSize: "13px",
                            backgroundColor: isAdded ? "#16a34a" : undefined,
                          }}
                        >
                          {isAdded ? "✓ En carrito" : "Agregar al carrito"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="pos-modal__actions" style={{ marginTop: "1rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
