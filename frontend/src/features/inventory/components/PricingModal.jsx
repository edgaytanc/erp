import { useState } from "react";

import { Button } from "../../../components/common/Button";
import { extractApiErrorMessage } from "../../../lib/apiError";
import { updateProduct } from "../api/inventoryApi";
import "../../../styles/pos.css";
import "../../../styles/inventory.css";

export function PricingModal({ product, isOpen, onClose, onSuccess }) {
  const [salePrice, setSalePrice] = useState(
    product && Number(product.sale_price || 0) > 0
      ? Number(product.sale_price).toFixed(2)
      : "",
  );
  const [costPrice, setCostPrice] = useState(
    product && Number(product.cost_price || 0) > 0
      ? Number(product.cost_price).toFixed(2)
      : "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !product) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const parsedSale = Number(salePrice);
    const parsedCost = Number(costPrice);

    if (isNaN(parsedSale) || parsedSale <= 0) {
      setError("El precio de venta debe ser un número mayor a 0.");
      return;
    }

    if (isNaN(parsedCost) || parsedCost < 0) {
      setError("El precio de costo no puede ser negativo.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        sale_price: parsedSale.toFixed(2),
        cost_price: parsedCost.toFixed(2),
      };
      const updatedProduct = await updateProduct(product.id, payload);
      if (onSuccess) {
        onSuccess(updatedProduct);
      }
      onClose();
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          "No se pudieron actualizar los precios del producto.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="pos-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        aria-modal="true"
        className="pos-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "480px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: "0 0 0.25rem 0", fontSize: "1.25rem", color: "#0f172a" }}>
              Asignar Precios
            </h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
              Define el precio de venta y costo para el producto ingresado.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
              color: "#64748b",
              padding: "0.25rem",
            }}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            padding: "0.75rem",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ fontWeight: 600, color: "#1e293b" }}>{product.name}</div>
          <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.2rem" }}>
            SKU: <strong>{product.sku}</strong>
            {product.category_name && <span> | Categoría: {product.category_name}</span>}
          </div>
        </div>

        {error && (
          <div
            className="global-alert global-alert--error"
            style={{ padding: "0.6rem 0.75rem", fontSize: "0.85rem" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                Precio de Venta (Q) *
              </span>
              <input
                autoFocus
                className="field__input"
                min="0.01"
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
                required
                step="0.01"
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "1rem",
                }}
                type="number"
                value={salePrice}
              />
            </label>

            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                Precio de Costo (Q) *
              </span>
              <input
                className="field__input"
                min="0.00"
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                required
                step="0.01"
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #cbd5e1",
                  fontSize: "1rem",
                }}
                type="number"
                value={costPrice}
              />
            </label>
          </div>

          <div className="pos-modal__actions" style={{ marginTop: "0.5rem", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Button
              disabled={isSaving}
              onClick={onClose}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Guardando..." : "Guardar Precios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
