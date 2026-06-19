import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/common/Button";
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

export function PurchasesPage() {
  const { user } = useAuth();
  const branchId = user?.branch || "";
  const branchName = user?.branch_name || "";
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [draftPurchases, setDraftPurchases] = useState([]);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
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
    () => items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unit_cost || 0), 0),
    [items],
  );

  async function loadPurchasesData(nextSearch = productSearch) {
    setIsLoading(true);
    setError(null);

    try {
      const [suppliersResponse, productsResponse, purchasesResponse, draftsResponse] = await Promise.all([
        listSuppliers(),
        listProducts({ q: nextSearch, is_active: true, page_size: 30, ordering: "name" }),
        listPurchases({ page_size: 10, branch: branchId }),
        listDraftPurchases({ branch: branchId }),
      ]);

      setSuppliers(unwrapResults(suppliersResponse).filter((supplier) => supplier.is_active));
      setProducts(unwrapResults(productsResponse));
      setRecentPurchases(unwrapResults(purchasesResponse));
      setDraftPurchases(unwrapResults(draftsResponse));
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo cargar compras."));
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

      setSuppliers((current) => [...current, supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierId(supplier.id);
      setSupplierForm(emptySupplierForm);
      setSuccess("Proveedor creado.");
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo crear el proveedor."));
    } finally {
      setIsSavingSupplier(false);
    }
  }

  function handleAddItem() {
    const product = products.find((candidate) => candidate.id === itemForm.product);

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
      setError(extractApiErrorMessage(requestError, "No se pudo crear la compra."));
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
      const confirmedPurchase = await confirmPurchase(createdPurchase.id);
      setCreatedPurchase(null);
      setItems([]);
      setInvoiceNumber("");
      setSupplierId("");
      setSuccess("Compra confirmada. Stock inicial cargado.");
      await loadPurchasesData(productSearch);
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo confirmar la compra."));
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
    setSuccess(`Orden DRAFT ${purchase.invoice_number || String(purchase.id).slice(0, 8)} cargada en el formulario.`);
    setError(null);
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
      setError(extractApiErrorMessage(requestError, "No se pudo confirmar la compra."));
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="purchases-page">
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

      {error ? <div className="purchases-alert purchases-alert--error">{error}</div> : null}
      {success ? <div className="purchases-alert purchases-alert--success">{success}</div> : null}

      <div className="purchases-grid">
        <div style={{ display: "grid", gap: "1rem" }}>
          <section className="purchases-panel">
            <div className="purchases-panel__header">
              <h3>Proveedor</h3>
              <span>{suppliers.length} activos</span>
            </div>

            <form className="supplier-form" onSubmit={handleCreateSupplier}>
              <label>
                <span>Proveedor</span>
                <input
                  onChange={(event) => updateSupplierField("name", event.target.value)}
                  placeholder="Nombre comercial"
                  type="text"
                  value={supplierForm.name}
                />
              </label>
              <label>
                <span>Contacto</span>
                <input
                  onChange={(event) => updateSupplierField("contact_name", event.target.value)}
                  type="text"
                  value={supplierForm.contact_name}
                />
              </label>
              <div className="purchases-form-row">
                <label>
                  <span>Telefono</span>
                  <input
                    onChange={(event) => updateSupplierField("phone", event.target.value)}
                    type="text"
                    value={supplierForm.phone}
                  />
                </label>
                <label>
                  <span>Direccion</span>
                  <input
                    onChange={(event) => updateSupplierField("address", event.target.value)}
                    type="text"
                    value={supplierForm.address}
                  />
                </label>
              </div>
              <Button disabled={isSavingSupplier} type="submit" variant="secondary">
                Crear proveedor
              </Button>
            </form>
          </section>

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
                  <article className="recent-purchase-row" key={purchase.id} style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{purchase.invoice_number || String(purchase.id).slice(0, 8)}</strong>
                        <small style={{ display: "block", color: "#64748b" }}>
                          {purchase.supplier_name || "Proveedor desconocido"}
                        </small>
                      </div>
                      <strong style={{ alignSelf: "center" }}>
                        Q {Number(purchase.total_cost || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <Button
                        onClick={() => handleSelectDraft(purchase)}
                        variant="secondary"
                        style={{ flex: 1, padding: "0.4rem", fontSize: "0.85rem" }}
                      >
                        Cargar
                      </Button>
                      <Button
                        onClick={() => handleConfirmDraftDirectly(purchase.id)}
                        style={{ flex: 1, padding: "0.4rem", fontSize: "0.85rem" }}
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
                      <strong>{purchase.invoice_number || String(purchase.id).slice(0, 8)}</strong>
                      <span>{purchase.status}</span>
                    </div>
                    <strong>Q {Number(purchase.total_cost || 0).toFixed(2)}</strong>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="purchases-panel purchases-panel--entry">
          <div className="purchases-panel__header">
            <h3>Entrada de inventario</h3>
            <span>{isLoading ? "Cargando..." : `${products.length} productos`}</span>
          </div>

          <form className="purchase-form" onSubmit={handleCreatePurchase}>
            <div className="purchases-form-row">
              <label>
                <span>Proveedor</span>
                <select onChange={(event) => setSupplierId(event.target.value)} required value={supplierId}>
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
                  <select onChange={(event) => updateItemField("product", event.target.value)} value={itemForm.product}>
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
                    onChange={(event) => updateItemField("qty", event.target.value)}
                    step="0.001"
                    type="number"
                    value={itemForm.qty}
                  />
                </label>
                <label>
                  <span>Costo</span>
                  <input
                    min="0"
                    onChange={(event) => updateItemField("unit_cost", event.target.value)}
                    step="0.01"
                    type="number"
                    value={itemForm.unit_cost}
                  />
                </label>
                <Button onClick={handleAddItem} type="button" variant="secondary">
                  Agregar
                </Button>
              </div>
            </div>

            <div className="purchase-items">
              {items.length === 0 ? (
                <div className="purchase-empty">Agrega productos para crear la entrada.</div>
              ) : (
                items.map((item) => (
                  <article className="purchase-item-row" key={item.product}>
                    <div>
                      <strong>{item.product_name}</strong>
                      <span>{item.product_sku}</span>
                    </div>
                    <span>{Number(item.qty).toFixed(3)}</span>
                    <span>Q {Number(item.unit_cost).toFixed(2)}</span>
                    <strong>Q {(Number(item.qty) * Number(item.unit_cost)).toFixed(2)}</strong>
                    <button onClick={() => removeItem(item.product)} type="button">
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
              <Button disabled={!branchId || isSavingPurchase || createdPurchase?.status === "DRAFT"} type="submit">
                Crear DRAFT
              </Button>
              <Button
                disabled={!createdPurchase?.id || createdPurchase?.status !== "DRAFT" || isConfirming}
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
    </div>
  );
}
