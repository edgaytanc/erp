import { useEffect, useState } from "react";

import { Button } from "../../../components/common/Button";
import {
  listProductsNeedingPricing,
  unwrapResults,
} from "../api/inventoryApi";
import { PricingModal } from "./PricingModal";
import "../../../styles/inventory.css";

export function PricingAlertSection({ onProductUpdated, initialProducts }) {
  const [alerts, setAlerts] = useState(initialProducts || []);
  const [isLoading, setIsLoading] = useState(!initialProducts);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  async function loadAlerts() {
    setIsLoading(true);
    try {
      const response = await listProductsNeedingPricing({ page_size: 50 });
      setAlerts(unwrapResults(response));
    } catch (err) {
      console.error("Error al cargar alertas de precios:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!initialProducts) {
      loadAlerts();
    } else {
      setAlerts(initialProducts);
    }
  }, [initialProducts]);

  function handleSuccess(updatedProduct) {
    // Quita el producto inmediatamente de la lista de alertas
    setAlerts((prev) => prev.filter((p) => p.id !== updatedProduct.id));
    setSuccessMessage(`Precios asignados correctamente a "${updatedProduct.name}".`);
    setTimeout(() => setSuccessMessage(null), 4000);

    if (onProductUpdated) {
      onProductUpdated(updatedProduct);
    }
  }

  if (isLoading && alerts.length === 0) {
    return null;
  }

  if (alerts.length === 0 && !successMessage) {
    return null;
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {successMessage && (
        <div
          className="inventory-alert inventory-alert--success"
          style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}
        >
          ✓ {successMessage}
        </div>
      )}

      {alerts.length > 0 && (
        <section
          className="inventory-alert inventory-alert--error"
          aria-label="Alertas de precios de productos"
          style={{ display: "grid", gap: "0.85rem" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem",
              borderBottom: "1px solid #fecaca",
              paddingBottom: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }} role="img" aria-label="Alerta">
                ⚠️
              </span>
              <span style={{ fontSize: "1rem", fontWeight: 700 }}>
                Alerta de Precios: {alerts.length} producto{alerts.length > 1 ? "s" : ""} recién ingresado{alerts.length > 1 ? "s" : ""} sin precio
              </span>
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#7f1d1d" }}>
              Requieren precio de venta y costo para poder comercializarse
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gap: "0.5rem",
              maxHeight: "280px",
              overflowY: "auto",
              paddingRight: "0.25rem",
            }}
          >
            {alerts.map((product) => {
              const sale = Number(product.sale_price || 0);
              const cost = Number(product.cost_price || 0);
              const missingParts = [];
              if (sale <= 0) missingParts.push("Precio venta: Q 0.00");
              if (cost <= 0) missingParts.push("Costo: Q 0.00");

              return (
                <article
                  key={product.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    background: "#ffffff",
                    border: "1px solid #fca5a5",
                    borderRadius: "0.5rem",
                    padding: "0.6rem 0.85rem",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
                      <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                        {product.name}
                      </strong>
                      <span style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600 }}>
                        [{product.sku}]
                      </span>
                      {product.category_name && (
                        <span style={{ color: "#475569", fontSize: "0.75rem" }}>
                          • {product.category_name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#b91c1c", marginTop: "0.2rem", fontWeight: 600 }}>
                      ⚠️ {missingParts.join(" | ") || "Sin precios válidos"}
                    </div>
                  </div>

                  <Button
                    onClick={() => setSelectedProduct(product)}
                    type="button"
                    style={{
                      padding: "0.4rem 0.85rem",
                      fontSize: "0.825rem",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Asignar Precios
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {selectedProduct && (
        <PricingModal
          isOpen={Boolean(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          onSuccess={handleSuccess}
          product={selectedProduct}
        />
      )}
    </div>
  );
}
