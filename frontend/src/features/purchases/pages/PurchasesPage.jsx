import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { Field } from "../../../components/common/Field";
import { useAuth } from "../../../contexts/AuthContext";
import { extractApiErrorMessage } from "../../../lib/apiError";
import { listProducts } from "../../inventory/api/inventoryApi";
import {
  confirmPurchase,
  createPurchase,
  createSupplier,
  listPurchases,
  listSuppliers,
  listDraftPurchases,
  unwrapResults,
  updateSupplier,
  deleteSupplier,
} from "../api/purchasesApi";
import "../../../styles/purchases.css";

const emptySupplierForm = {
  name: "",
  contact_name: "",
  phone: "",
  address: "",
  is_active: true,
};

const emptyItemForm = {
  product: "",
  qty: "1.000",
  unit_cost: "0.00",
};

const modalStyles = `
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-out;
}

.modal-content {
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 0.75rem;
  background: #ffffff;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.3s ease-out;
}

.modal-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 1.5rem;
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .modal-grid {
    grid-template-columns: 1fr;
  }
}

.supplier-list-container {
  border-right: 1px solid #edf2f7;
  padding-right: 1.5rem;
  max-height: 60vh;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .supplier-list-container {
    border-right: none;
    padding-right: 0;
    max-height: 30vh;
  }
}

.supplier-item {
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #edf2f7;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.supplier-item:hover {
  background-color: #f8fafc;
  border-color: #cbd5e1;
}

.supplier-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.supplier-item-actions {
  display: flex;
  gap: 0.25rem;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
`;

export function PurchasesPage() {
  const { user } = useAuth();
  const branchId = user?.branch || "";
  const branchName = user?.branch_name || "";

  // Tabs state
  const [activeTab, setActiveTab] = useState("new_purchase");

  // Suppliers states
  const [suppliers, setSuppliers] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);

  // Products and purchases states
  const [products, setProducts] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [draftPurchases, setDraftPurchases] = useState([]);

  // Quick supplier creation form
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);

  // Modal supplier form
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [modalSupplierForm, setModalSupplierForm] = useState(emptySupplierForm);
  const [modalError, setModalError] = useState(null);
  const [modalSuccess, setModalSuccess] = useState(null);
  const [isSavingModalSupplier, setIsSavingModalSupplier] = useState(false);

  // Purchase items form
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [items, setItems] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [createdPurchase, setCreatedPurchase] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const totalCost = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.qty || 0) * Number(item.unit_cost || 0),
        0,
      ),
    [items],
  );

  async function loadPurchasesData(nextSearch = productSearch) {
    setIsLoading(true);
    setError(null);

    try {
      const [
        suppliersResponse,
        productsResponse,
        purchasesResponse,
        draftsResponse,
      ] = await Promise.all([
        listSuppliers(),
        listProducts({
          q: nextSearch,
          is_active: true,
          page_size: 30,
          ordering: "name",
        }),
        listPurchases({ page_size: 10, branch: branchId }),
        listDraftPurchases({ branch: branchId }),
      ]);

      const suppliersList = unwrapResults(suppliersResponse);
      setAllSuppliers(suppliersList);
      setSuppliers(suppliersList.filter((supplier) => supplier.is_active));
      setProducts(unwrapResults(productsResponse));
      setRecentPurchases(unwrapResults(purchasesResponse));
      setDraftPurchases(unwrapResults(draftsResponse));
    } catch (requestError) {
      setError(
        extractApiErrorMessage(requestError, "No se pudo cargar compras."),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPurchasesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPurchasesData(productSearch);
    }, 300);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearch]);

  function updateSupplierField(field, value) {
    setSupplierForm((current) => ({ ...current, [field]: value }));
  }

  function updateItemField(field, value) {
    setItemForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreateSupplier(event) {
    event.preventDefault();

    if (!supplierForm.name.trim()) {
      setError("Escribe el nombre del proveedor.");
      return;
    }

    setIsSavingSupplier(true);
    setError(null);
    setSuccess(null);

    try {
      const supplier = await createSupplier({
        ...supplierForm,
        name: supplierForm.name.trim(),
        contact_name: supplierForm.contact_name.trim(),
        phone: supplierForm.phone.trim(),
        address: supplierForm.address.trim(),
      });

      setAllSuppliers((current) =>
        [...current, supplier].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSuppliers((current) =>
        [...current, supplier].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSupplierId(supplier.id);
      setSupplierForm(emptySupplierForm);
      setSuccess("Proveedor creado.");
    } catch (requestError) {
      setError(
        extractApiErrorMessage(requestError, "No se pudo crear el proveedor."),
      );
    } finally {
      setIsSavingSupplier(false);
    }
  }

  // Modal handlers
  function handleEditSupplierClick(supplier) {
    setEditingSupplierId(supplier.id);
    setModalSupplierForm({
      name: supplier.name || "",
      contact_name: supplier.contact_name || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      is_active: supplier.is_active,
    });
    setModalError(null);
    setModalSuccess(null);
  }

  function handleCancelEditSupplier() {
    setEditingSupplierId(null);
    setModalSupplierForm(emptySupplierForm);
    setModalError(null);
    setModalSuccess(null);
  }

  async function handleSaveModalSupplier(event) {
    event.preventDefault();

    if (!modalSupplierForm.name.trim()) {
      setModalError("Escribe el nombre del proveedor.");
      return;
    }

    setIsSavingModalSupplier(true);
    setModalError(null);
    setModalSuccess(null);

    const payload = {
      name: modalSupplierForm.name.trim(),
      contact_name: modalSupplierForm.contact_name.trim(),
      phone: modalSupplierForm.phone.trim(),
      address: modalSupplierForm.address.trim(),
      is_active: modalSupplierForm.is_active,
    };

    try {
      if (editingSupplierId) {
        const updated = await updateSupplier(editingSupplierId, payload);

        setAllSuppliers((current) =>
          current
            .map((s) => (s.id === updated.id ? updated : s))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );

        setSuppliers((current) => {
          if (updated.is_active) {
            const exists = current.some((s) => s.id === updated.id);
            if (exists) {
              return current
                .map((s) => (s.id === updated.id ? updated : s))
                .sort((a, b) => a.name.localeCompare(b.name));
            } else {
              return [...current, updated].sort((a, b) =>
                a.name.localeCompare(b.name),
              );
            }
          } else {
            return current.filter((s) => s.id !== updated.id);
          }
        });

        setModalSuccess("Proveedor actualizado correctamente.");
        setEditingSupplierId(null);
        setModalSupplierForm(emptySupplierForm);
      } else {
        const created = await createSupplier(payload);

        setAllSuppliers((current) =>
          [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
        );

        if (created.is_active) {
          setSuppliers((current) =>
            [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
          );
        }

        setModalSuccess("Proveedor creado correctamente.");
        setModalSupplierForm(emptySupplierForm);
      }
    } catch (requestError) {
      setModalError(
        extractApiErrorMessage(
          requestError,
          "No se pudo guardar el proveedor.",
        ),
      );
    } finally {
      setIsSavingModalSupplier(false);
    }
  }

  async function handleDeleteSupplierClick(supplierId) {
    if (
      !window.confirm("¿Estás seguro de que deseas eliminar este proveedor?")
    ) {
      return;
    }

    setModalError(null);
    setModalSuccess(null);

    try {
      await deleteSupplier(supplierId);

      setAllSuppliers((current) => current.filter((s) => s.id !== supplierId));
      setSuppliers((current) => current.filter((s) => s.id !== supplierId));

      if (editingSupplierId === supplierId) {
        setEditingSupplierId(null);
        setModalSupplierForm(emptySupplierForm);
      }

      setModalSuccess("Proveedor eliminado correctamente.");
    } catch (requestError) {
      setModalError(
        extractApiErrorMessage(
          requestError,
          "No se pudo eliminar el proveedor.",
        ),
      );
    }
  }

  function handleAddItem() {
    const product = products.find(
      (candidate) => candidate.id === itemForm.product,
    );

    if (!product) {
      setError("Selecciona un producto.");
      return;
    }

    if (items.some((item) => item.product === product.id)) {
      setError("El producto ya esta en esta compra.");
      return;
    }

    const qty = Number(itemForm.qty || 0);
    const unitCost = Number(itemForm.unit_cost || 0);

    if (qty <= 0 || unitCost < 0) {
      setError("Cantidad debe ser mayor a cero y costo no puede ser negativo.");
      return;
    }

    setItems((current) => [
      ...current,
      {
        product: product.id,
        product_name: product.name,
        product_sku: product.sku,
        qty: qty.toFixed(3),
        unit_cost: unitCost.toFixed(2),
      },
    ]);
    setItemForm(emptyItemForm);
    setError(null);
  }

  function removeItem(productId) {
    setItems((current) => current.filter((item) => item.product !== productId));
  }

  async function handleCreatePurchase(event) {
    event.preventDefault();

    if (!branchId) {
      setError("Tu usuario no tiene una sucursal asignada.");
      return;
    }

    if (!supplierId) {
      setError("Selecciona un proveedor.");
      return;
    }

    if (items.length === 0) {
      setError("Agrega al menos un producto a la compra.");
      return;
    }

    setIsSavingPurchase(true);
    setError(null);
    setSuccess(null);

    try {
      const purchase = await createPurchase({
        branch: branchId,
        supplier: supplierId,
        invoice_number: invoiceNumber.trim(),
        items: items.map((item) => ({
          product: item.product,
          qty: item.qty,
          unit_cost: item.unit_cost,
        })),
      });

      setCreatedPurchase(purchase);
      setSuccess("Compra DRAFT creada. Confirma para cargar stock.");
      await loadPurchasesData(productSearch);
    } catch (requestError) {
      setError(
        extractApiErrorMessage(requestError, "No se pudo crear la compra."),
      );
    } finally {
      setIsSavingPurchase(false);
    }
  }

  async function handleConfirmPurchase() {
    if (!createdPurchase?.id) {
      return;
    }

    setIsConfirming(true);
    setError(null);
    setSuccess(null);

    try {
      await confirmPurchase(createdPurchase.id);
      setCreatedPurchase(null);
      setItems([]);
      setInvoiceNumber("");
      setSupplierId("");
      setSuccess("Compra confirmada. Stock inicial cargado.");
      await loadPurchasesData(productSearch);
    } catch (requestError) {
      setError(
        extractApiErrorMessage(requestError, "No se pudo confirmar la compra."),
      );
    } finally {
      setIsConfirming(false);
    }
  }

  function handleSelectDraft(purchase) {
    setCreatedPurchase(purchase);
    setSupplierId(purchase.supplier || "");
    setInvoiceNumber(purchase.invoice_number || "");

    const mappedItems = (purchase.items || []).map((item) => ({
      product: item.product,
      product_name: item.product_name || "Producto",
      product_sku: item.product_sku || "",
      qty: Number(item.qty).toFixed(3),
      unit_cost: Number(item.unit_cost).toFixed(2),
    }));
    setItems(mappedItems);
    setSuccess(
      `Orden DRAFT ${purchase.invoice_number || String(purchase.id).slice(0, 8)} cargada en el formulario.`,
    );
    setError(null);
    setActiveTab("new_purchase");
  }

  async function handleConfirmDraftDirectly(purchaseId) {
    setIsConfirming(true);
    setError(null);
    setSuccess(null);

    try {
      await confirmPurchase(purchaseId);
      setSuccess("Compra confirmada. Stock inicial cargado.");
      if (createdPurchase?.id === purchaseId) {
        setCreatedPurchase(null);
        setItems([]);
        setInvoiceNumber("");
        setSupplierId("");
      }
      await loadPurchasesData(productSearch);
    } catch (requestError) {
      setError(
        extractApiErrorMessage(requestError, "No se pudo confirmar la compra."),
      );
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="purchases-page">
      <style>{modalStyles}</style>
      <section className="purchases-toolbar">
        <div>
          <h2>Compras y entradas</h2>
          <p>Carga stock inicial para la sucursal asignada a tu usuario.</p>
        </div>
        <div className="purchases-branch">
          <span>Sucursal activa</span>
          {branchId ? (
            <>
              <strong>{branchName || "Sucursal asignada"}</strong>
              <small>{branchId}</small>
            </>
          ) : (
            <strong>Sin sucursal asignada</strong>
          )}
        </div>
      </section>

      {error ? (
        <div className="purchases-alert purchases-alert--error">{error}</div>
      ) : null}
      {success ? (
        <div className="purchases-alert purchases-alert--success">
          {success}
        </div>
      ) : null}

      <div className="purchases-tabs">
        <button
          className={`purchases-tab ${activeTab === "new_purchase" ? "active" : ""}`}
          onClick={() => setActiveTab("new_purchase")}
        >
          <svg
            className="tab-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Nueva Compra
        </button>
        <button
          className={`purchases-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <svg
            className="tab-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          Compras Recientes
        </button>
      </div>

      {activeTab === "new_purchase" && (
        <div className="purchases-grid">
          <div style={{ display: "grid", gap: "1rem" }}>
            <section className="purchases-panel">
              <div className="purchases-panel__header">
                <h3>Proveedor</h3>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.85rem" }}>
                    {suppliers.length} activos
                  </span>
                  <Button
                    onClick={() => {
                      setIsSupplierModalOpen(true);
                      setModalError(null);
                      setModalSuccess(null);
                    }}
                    variant="secondary"
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.85rem",
                      minHeight: "auto",
                    }}
                  >
                    Gestionar Proveedores
                  </Button>
                </div>
              </div>

              <form className="supplier-form" onSubmit={handleCreateSupplier}>
                <label>
                  <span>Proveedor</span>
                  <input
                    onChange={(event) =>
                      updateSupplierField("name", event.target.value)
                    }
                    placeholder="Nombre comercial"
                    type="text"
                    value={supplierForm.name}
                  />
                </label>
                <label>
                  <span>Contacto</span>
                  <input
                    onChange={(event) =>
                      updateSupplierField("contact_name", event.target.value)
                    }
                    type="text"
                    value={supplierForm.contact_name}
                  />
                </label>
                <div className="purchases-form-row">
                  <label>
                    <span>Telefono</span>
                    <input
                      onChange={(event) =>
                        updateSupplierField("phone", event.target.value)
                      }
                      type="text"
                      value={supplierForm.phone}
                    />
                  </label>
                  <label>
                    <span>Direccion</span>
                    <input
                      onChange={(event) =>
                        updateSupplierField("address", event.target.value)
                      }
                      type="text"
                      value={supplierForm.address}
                    />
                  </label>
                </div>
                <Button
                  disabled={isSavingSupplier}
                  type="submit"
                  variant="secondary"
                >
                  Crear proveedor
                </Button>
              </form>
            </section>
          </div>

          <section className="purchases-panel purchases-panel--entry">
            <div className="purchases-panel__header">
              <h3>Entrada de inventario</h3>
              <span>
                {isLoading ? "Cargando..." : `${products.length} productos`}
              </span>
            </div>

            <form className="purchase-form" onSubmit={handleCreatePurchase}>
              <div className="purchases-form-row">
                <label>
                  <span>Proveedor</span>
                  <select
                    onChange={(event) => setSupplierId(event.target.value)}
                    required
                    value={supplierId}
                  >
                    <option value="">Seleccionar</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Factura</span>
                  <input
                    onChange={(event) => setInvoiceNumber(event.target.value)}
                    placeholder="Opcional"
                    type="text"
                    value={invoiceNumber}
                  />
                </label>
              </div>

              <div className="purchase-item-picker">
                <label>
                  <span>Buscar producto</span>
                  <input
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="SKU o nombre"
                    type="search"
                    value={productSearch}
                  />
                </label>

                <div className="purchase-item-form">
                  <label>
                    <span>Producto</span>
                    <select
                      onChange={(event) =>
                        updateItemField("product", event.target.value)
                      }
                      value={itemForm.product}
                    >
                      <option value="">Seleccionar producto</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} - {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Cantidad</span>
                    <input
                      min="0.001"
                      onChange={(event) =>
                        updateItemField("qty", event.target.value)
                      }
                      step="0.001"
                      type="number"
                      value={itemForm.qty}
                    />
                  </label>
                  <label>
                    <span>Costo</span>
                    <input
                      min="0"
                      onChange={(event) =>
                        updateItemField("unit_cost", event.target.value)
                      }
                      step="0.01"
                      type="number"
                      value={itemForm.unit_cost}
                    />
                  </label>
                  <Button
                    onClick={handleAddItem}
                    type="button"
                    variant="secondary"
                  >
                    Agregar
                  </Button>
                </div>
              </div>

              <div className="purchase-items">
                {items.length === 0 ? (
                  <div className="purchase-empty">
                    Agrega productos para crear la entrada.
                  </div>
                ) : (
                  items.map((item) => (
                    <article className="purchase-item-row" key={item.product}>
                      <div>
                        <strong>{item.product_name}</strong>
                        <span>{item.product_sku}</span>
                      </div>
                      <span>{Number(item.qty).toFixed(3)}</span>
                      <span>Q {Number(item.unit_cost).toFixed(2)}</span>
                      <strong>
                        Q{" "}
                        {(Number(item.qty) * Number(item.unit_cost)).toFixed(2)}
                      </strong>
                      <button
                        onClick={() => removeItem(item.product)}
                        type="button"
                      >
                        Quitar
                      </button>
                    </article>
                  ))
                )}
              </div>

              <div className="purchase-summary">
                <span>Total estimado</span>
                <strong>Q {totalCost.toFixed(2)}</strong>
              </div>

              <div className="purchase-actions">
                <Button
                  disabled={
                    !branchId ||
                    isSavingPurchase ||
                    createdPurchase?.status === "DRAFT"
                  }
                  type="submit"
                >
                  Crear DRAFT
                </Button>
                <Button
                  disabled={
                    !createdPurchase?.id ||
                    createdPurchase?.status !== "DRAFT" ||
                    isConfirming
                  }
                  onClick={handleConfirmPurchase}
                  type="button"
                  variant="secondary"
                >
                  Confirmar y cargar stock
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {activeTab === "history" && (
        <div className="purchases-grid">
          <section className="purchases-panel">
            <div className="purchases-panel__header">
              <h3>Órdenes Pendientes (DRAFT)</h3>
              <span>{draftPurchases.length}</span>
            </div>

            <div className="recent-purchases">
              {draftPurchases.length === 0 ? (
                <div className="purchase-empty">Sin órdenes pendientes.</div>
              ) : (
                draftPurchases.map((purchase) => (
                  <article
                    className="recent-purchase-row"
                    key={purchase.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong>
                          {purchase.invoice_number ||
                            String(purchase.id).slice(0, 8)}
                        </strong>
                        <small style={{ display: "block", color: "#64748b" }}>
                          {purchase.supplier_name || "Proveedor desconocido"}
                        </small>
                      </div>
                      <strong style={{ alignSelf: "center" }}>
                        Q {Number(purchase.total_cost || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        marginTop: "0.25rem",
                      }}
                    >
                      <Button
                        onClick={() => handleSelectDraft(purchase)}
                        variant="secondary"
                        style={{
                          flex: 1,
                          padding: "0.4rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        Cargar
                      </Button>
                      <Button
                        onClick={() => handleConfirmDraftDirectly(purchase.id)}
                        style={{
                          flex: 1,
                          padding: "0.4rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        Confirmar
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="purchases-panel">
            <div className="purchases-panel__header">
              <h3>Compras recientes</h3>
              <span>{recentPurchases.length}</span>
            </div>

            <div className="recent-purchases">
              {recentPurchases.length === 0 ? (
                <div className="purchase-empty">Sin compras recientes.</div>
              ) : (
                recentPurchases.map((purchase) => (
                  <article className="recent-purchase-row" key={purchase.id}>
                    <div>
                      <strong>
                        {purchase.invoice_number ||
                          String(purchase.id).slice(0, 8)}
                      </strong>
                      <span>{purchase.status}</span>
                    </div>
                    <strong>
                      Q {Number(purchase.total_cost || 0).toFixed(2)}
                    </strong>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {isSupplierModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsSupplierModalOpen(false);
            handleCancelEditSupplier();
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Card
              title="Gestionar Proveedores"
              subtitle="Crea, edita o elimina los proveedores de compras."
              actions={
                <Button
                  onClick={() => {
                    setIsSupplierModalOpen(false);
                    handleCancelEditSupplier();
                  }}
                  variant="secondary"
                >
                  Cerrar
                </Button>
              }
            >
              {modalError && (
                <div
                  className="purchases-alert purchases-alert--error"
                  style={{ marginBottom: "1rem" }}
                >
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div
                  className="purchases-alert purchases-alert--success"
                  style={{ marginBottom: "1rem" }}
                >
                  {modalSuccess}
                </div>
              )}

              <div className="modal-grid">
                {/* Left side: Supplier List */}
                <div className="supplier-list-container">
                  <h4 style={{ marginBottom: "1rem", marginTop: 0 }}>
                    Listado ({allSuppliers.length})
                  </h4>
                  {allSuppliers.length === 0 ? (
                    <p style={{ color: "#64748b" }}>
                      No hay proveedores registrados.
                    </p>
                  ) : (
                    allSuppliers.map((sup) => (
                      <div
                        className="supplier-item"
                        key={sup.id}
                        style={{
                          backgroundColor:
                            editingSupplierId === sup.id
                              ? "#f1f5f9"
                              : "transparent",
                          borderColor:
                            editingSupplierId === sup.id
                              ? "#3b82f6"
                              : "#edf2f7",
                        }}
                      >
                        <div className="supplier-item-info">
                          <strong style={{ fontSize: "0.95rem" }}>
                            {sup.name}
                          </strong>
                          {sup.contact_name && (
                            <span
                              style={{ fontSize: "0.75rem", color: "#64748b" }}
                            >
                              Contacto: {sup.contact_name}
                            </span>
                          )}
                          {sup.phone && (
                            <span
                              style={{ fontSize: "0.75rem", color: "#64748b" }}
                            >
                              Tel: {sup.phone}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: "bold",
                              color: sup.is_active ? "#166534" : "#991b1b",
                            }}
                          >
                            {sup.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                        <div className="supplier-item-actions">
                          <Button
                            onClick={() => handleEditSupplierClick(sup)}
                            variant="secondary"
                            style={{
                              padding: "0.2rem 0.4rem",
                              fontSize: "0.75rem",
                              minHeight: "auto",
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            onClick={() => handleDeleteSupplierClick(sup.id)}
                            variant="secondary"
                            style={{
                              padding: "0.2rem 0.4rem",
                              fontSize: "0.75rem",
                              minHeight: "auto",
                              color: "#ef4444",
                              borderColor: "#fecaca",
                            }}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Right side: Form (Edit / Create) */}
                <form
                  className="supplier-form"
                  onSubmit={handleSaveModalSupplier}
                  style={{ padding: 0 }}
                >
                  <h4 style={{ marginBottom: "1rem", marginTop: 0 }}>
                    {editingSupplierId ? "Editar Proveedor" : "Nuevo Proveedor"}
                  </h4>
                  <Field
                    label="Proveedor / Nombre comercial"
                    onChange={(event) =>
                      setModalSupplierForm({
                        ...modalSupplierForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="Nombre"
                    type="text"
                    value={modalSupplierForm.name}
                    required
                  />
                  <Field
                    label="Contacto"
                    onChange={(event) =>
                      setModalSupplierForm({
                        ...modalSupplierForm,
                        contact_name: event.target.value,
                      })
                    }
                    placeholder="Nombre del contacto"
                    type="text"
                    value={modalSupplierForm.contact_name}
                  />
                  <div className="purchases-form-row">
                    <Field
                      label="Teléfono"
                      onChange={(event) =>
                        setModalSupplierForm({
                          ...modalSupplierForm,
                          phone: event.target.value,
                        })
                      }
                      placeholder="Número de teléfono"
                      type="text"
                      value={modalSupplierForm.phone}
                    />
                    <Field
                      label="Dirección"
                      onChange={(event) =>
                        setModalSupplierForm({
                          ...modalSupplierForm,
                          address: event.target.value,
                        })
                      }
                      placeholder="Dirección comercial"
                      type="text"
                      value={modalSupplierForm.address}
                    />
                  </div>
                  <label
                    className="field"
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={modalSupplierForm.is_active}
                      onChange={(event) =>
                        setModalSupplierForm({
                          ...modalSupplierForm,
                          is_active: event.target.checked,
                        })
                      }
                      style={{ width: "auto" }}
                    />
                    <span style={{ fontWeight: "700" }}>Proveedor Activo</span>
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginTop: "1rem",
                    }}
                  >
                    <Button
                      disabled={isSavingModalSupplier}
                      type="submit"
                      style={{ flex: 1 }}
                    >
                      {editingSupplierId ? "Actualizar" : "Crear"}
                    </Button>
                    {editingSupplierId && (
                      <Button
                        onClick={handleCancelEditSupplier}
                        variant="secondary"
                        style={{ flex: 1 }}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
