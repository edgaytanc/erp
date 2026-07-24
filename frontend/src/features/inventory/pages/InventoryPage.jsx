import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { Field } from "../../../components/common/Field";
import { useAuth } from "../../../contexts/AuthContext";
import { extractApiErrorMessage } from "../../../lib/apiError";
import {
  createCategory,
  createProduct,
  deactivateProduct,
  deleteCategory,
  listCategories,
  listProducts,
  listStocks,
  listStockMovements,
  unwrapResults,
  updateCategory,
  updateProduct,
} from "../api/inventoryApi";
import "../../../styles/inventory.css";

const emptyProductForm = {
  category: "",
  sku: "",
  barcode: "",
  name: "",
  description: "",
  sale_price: "",
  cost_price: "",
  min_stock: "0.00",
  is_active: true,
};

export function InventoryPage() {
  const { user } = useAuth();

  // Tabs state
  const [activeTab, setActiveTab] = useState("catalog"); // "catalog", "categories", "stock"
  const [showProductForm, setShowProductForm] = useState(false);

  // Products state
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productCount, setProductCount] = useState(0);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Categories state
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    parent: "",
    is_active: true,
  });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryError, setCategoryError] = useState(null);
  const [categorySuccess, setCategorySuccess] = useState(null);

  // Stock and Movements state
  const [stocks, setStocks] = useState([]);
  const [movements, setMovements] = useState([]);
  const [isStockLoading, setIsStockLoading] = useState(false);
  const [stockError, setStockError] = useState(null);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  );
  const isEditingProduct = Boolean(editingProductId);

  async function loadInventory(nextSearchTerm = searchTerm) {
    setIsLoading(true);
    setError(null);

    try {
      const [categoriesResponse, productsResponse] = await Promise.all([
        listCategories({ page_size: 100 }),
        listProducts({ q: nextSearchTerm, page_size: 25, ordering: "name" }),
      ]);

      setCategories(unwrapResults(categoriesResponse));
      setProducts(unwrapResults(productsResponse));
      setProductCount(
        productsResponse?.count ?? unwrapResults(productsResponse).length,
      );
    } catch (requestError) {
      setError(
        extractApiErrorMessage(
          requestError,
          "No se pudo cargar el inventario.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStockData() {
    setIsStockLoading(true);
    setStockError(null);
    try {
      const branchParam = user?.branch ? { branch: user.branch } : {};
      const [stocksResponse, movementsResponse] = await Promise.all([
        listStocks({ ...branchParam, page_size: 100 }),
        listStockMovements({ ...branchParam, page_size: 50 }),
      ]);
      setStocks(unwrapResults(stocksResponse));
      setMovements(unwrapResults(movementsResponse));
    } catch (err) {
      setStockError(
        extractApiErrorMessage(
          err,
          "No se pudo cargar el stock o los movimientos.",
        ),
      );
    } finally {
      setIsStockLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeTab === "catalog") {
        loadInventory(searchTerm);
      }
    }, 300);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  useEffect(() => {
    if (activeTab === "stock") {
      loadStockData();
    } else if (activeTab === "categories") {
      // Reload categories list just in case
      listCategories({ page_size: 100 }).then((res) =>
        setCategories(unwrapResults(res)),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function updateProductField(field, value) {
    setProductForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetProductForm() {
    setProductForm(emptyProductForm);
    setEditingProductId(null);
  }

  function productToForm(product) {
    return {
      category: product.category || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      name: product.name || "",
      description: product.description || "",
      sale_price: Number(product.sale_price || 0).toFixed(2),
      cost_price: Number(product.cost_price || 0).toFixed(2),
      min_stock: Number(product.min_stock || 0).toFixed(2),
      is_active: Boolean(product.is_active),
    };
  }

  function handleEditProduct(product) {
    setProductForm(productToForm(product));
    setEditingProductId(product.id);
    setError(null);
    setSuccess(null);
  }

  async function handleCreateCategory(event) {
    event.preventDefault();

    if (!categoryName.trim()) {
      setError("Escribe un nombre de categoria.");
      return;
    }

    setIsSavingCategory(true);
    setError(null);
    setSuccess(null);

    try {
      const category = await createCategory({
        name: categoryName.trim(),
        is_active: true,
      });
      setCategories((current) =>
        [...current, category].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setProductForm((current) => ({ ...current, category: category.id }));
      setCategoryName("");
      setSuccess("Categoria creada.");
    } catch (requestError) {
      setError(
        extractApiErrorMessage(requestError, "No se pudo crear la categoria."),
      );
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function handleSaveProduct(event) {
    event.preventDefault();
    setIsSavingProduct(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...productForm,
        category: productForm.category || null,
        barcode: productForm.barcode.trim() || null,
        sku: productForm.sku.trim(),
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        sale_price: Number(productForm.sale_price || 0).toFixed(2),
        cost_price: Number(productForm.cost_price || 0).toFixed(2),
        min_stock: Number(productForm.min_stock || 0).toFixed(2),
      };

      if (isEditingProduct) {
        await updateProduct(editingProductId, payload);
        setSuccess("Producto actualizado correctamente.");
      } else {
        await createProduct(payload);
        setSuccess("Producto creado correctamente.");
      }

      resetProductForm();
      setShowProductForm(false);
      await loadInventory(searchTerm);
    } catch (requestError) {
      setError(
        extractApiErrorMessage(
          requestError,
          isEditingProduct
            ? "No se pudo actualizar el producto."
            : "No se pudo crear el producto.",
        ),
      );
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleDeactivateProduct(product) {
    if (!window.confirm(`Desactivar producto "${product.name}"?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await deactivateProduct(product.id);
      if (editingProductId === product.id) {
        resetProductForm();
      }
      setSuccess("Producto desactivado correctamente.");
      await loadInventory(searchTerm);
    } catch (requestError) {
      setError(
        extractApiErrorMessage(
          requestError,
          "No se pudo desactivar el producto.",
        ),
      );
    }
  }

  // Category Handlers
  function handleEditCategory(category) {
    setCategoryForm({
      name: category.name,
      parent: category.parent || "",
      is_active: category.is_active,
    });
    setEditingCategoryId(category.id);
    setCategoryError(null);
    setCategorySuccess(null);
  }

  function handleResetCategoryForm() {
    setCategoryForm({ name: "", parent: "", is_active: true });
    setEditingCategoryId(null);
    setCategoryError(null);
    setCategorySuccess(null);
  }

  async function handleSaveCategory(event) {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      setCategoryError("El nombre de la categoría es requerido.");
      return;
    }

    setCategoryError(null);
    setCategorySuccess(null);

    const payload = {
      name: categoryForm.name.trim(),
      parent: categoryForm.parent || null,
      is_active: categoryForm.is_active,
    };

    try {
      if (editingCategoryId) {
        await updateCategory(editingCategoryId, payload);
        setCategorySuccess("Categoría actualizada correctamente.");
      } else {
        await createCategory(payload);
        setCategorySuccess("Categoría creada correctamente.");
      }

      handleResetCategoryForm();
      const categoriesResponse = await listCategories({ page_size: 100 });
      setCategories(unwrapResults(categoriesResponse));
    } catch (requestError) {
      setCategoryError(
        extractApiErrorMessage(
          requestError,
          "No se pudo guardar la categoría.",
        ),
      );
    }
  }

  async function handleDeleteCategory(category) {
    if (
      !window.confirm(
        `¿Estás seguro de que deseas eliminar la categoría "${category.name}"?`,
      )
    ) {
      return;
    }

    setCategoryError(null);
    setCategorySuccess(null);

    try {
      await deleteCategory(category.id);
      setCategorySuccess("Categoría eliminada correctamente.");
      handleResetCategoryForm();

      const categoriesResponse = await listCategories({ page_size: 100 });
      setCategories(unwrapResults(categoriesResponse));
    } catch (requestError) {
      setCategoryError(
        extractApiErrorMessage(
          requestError,
          "No se pudo eliminar la categoría. Probablemente está en uso por productos o subcategorías.",
        ),
      );
    }
  }

  return (
    <div className="inventory-page">
      <section className="inventory-toolbar">
        <div>
          <h2>Inventario</h2>
          <p>Productos reales para compras, stock y ventas POS.</p>
        </div>
      </section>

      {/* Tabs Navigation */}
      <div className="inventory-tabs">
        <button
          className={`inventory-tab ${activeTab === "catalog" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("catalog");
            setShowProductForm(false);
            resetProductForm();
            setError(null);
            setSuccess(null);
          }}
        >
          Catálogo de Productos
        </button>
        <button
          className={`inventory-tab ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("categories");
            handleResetCategoryForm();
          }}
        >
          Categorías
        </button>
        <button
          className={`inventory-tab ${activeTab === "stock" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("stock");
            setError(null);
            setSuccess(null);
          }}
        >
          Ajustes/Movimientos
        </button>
      </div>

      {/* General error/success alerts */}
      {error ? (
        <div
          className="inventory-alert inventory-alert--error"
          style={{ marginBottom: "1rem" }}
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          className="inventory-alert inventory-alert--success"
          style={{ marginBottom: "1rem" }}
        >
          {success}
        </div>
      ) : null}

      {/* Tab 1: Product Catalog */}
      {activeTab === "catalog" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          {showProductForm ? (
            /* Product form subview */
            <div
              className="inventory-grid"
              style={{ gridTemplateColumns: "1fr" }}
            >
              <section className="inventory-panel">
                <div className="inventory-panel__header">
                  <h3>
                    {isEditingProduct ? "Editar producto" : "Nuevo producto"}
                  </h3>
                  <Button
                    onClick={() => {
                      setShowProductForm(false);
                      resetProductForm();
                    }}
                    variant="secondary"
                  >
                    Volver al Listado
                  </Button>
                </div>

                <form
                  className="inventory-category-form"
                  onSubmit={handleCreateCategory}
                >
                  <input
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="Crear categoria rapida"
                    type="text"
                    value={categoryName}
                  />
                  <Button
                    disabled={isSavingCategory}
                    type="submit"
                    variant="secondary"
                  >
                    Crear
                  </Button>
                </form>

                <form
                  className="inventory-product-form"
                  onSubmit={handleSaveProduct}
                >
                  <label>
                    <span>Categoria</span>
                    <select
                      onChange={(event) =>
                        updateProductField("category", event.target.value)
                      }
                      value={productForm.category}
                    >
                      <option value="">Sin categoria</option>
                      {activeCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="inventory-form-row">
                    <label>
                      <span>SKU</span>
                      <input
                        onChange={(event) =>
                          updateProductField("sku", event.target.value)
                        }
                        required
                        type="text"
                        value={productForm.sku}
                      />
                    </label>
                    <label>
                      <span>Codigo</span>
                      <input
                        onChange={(event) =>
                          updateProductField("barcode", event.target.value)
                        }
                        type="text"
                        value={productForm.barcode}
                      />
                    </label>
                  </div>

                  <label>
                    <span>Nombre</span>
                    <input
                      onChange={(event) =>
                        updateProductField("name", event.target.value)
                      }
                      required
                      type="text"
                      value={productForm.name}
                    />
                  </label>

                  <label>
                    <span>Descripcion</span>
                    <textarea
                      onChange={(event) =>
                        updateProductField("description", event.target.value)
                      }
                      rows="3"
                      value={productForm.description}
                    />
                  </label>

                  <div className="inventory-form-row inventory-form-row--three">
                    <label>
                      <span>Venta</span>
                      <input
                        min="0"
                        onChange={(event) =>
                          updateProductField("sale_price", event.target.value)
                        }
                        required
                        step="0.01"
                        type="number"
                        value={productForm.sale_price}
                      />
                    </label>
                    <label>
                      <span>Costo</span>
                      <input
                        min="0"
                        onChange={(event) =>
                          updateProductField("cost_price", event.target.value)
                        }
                        required
                        step="0.01"
                        type="number"
                        value={productForm.cost_price}
                      />
                    </label>
                    <label>
                      <span>Minimo</span>
                      <input
                        min="0"
                        onChange={(event) =>
                          updateProductField("min_stock", event.target.value)
                        }
                        step="0.01"
                        type="number"
                        value={productForm.min_stock}
                      />
                    </label>
                  </div>

                  <label className="inventory-check">
                    <input
                      checked={productForm.is_active}
                      onChange={(event) =>
                        updateProductField("is_active", event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>Producto activo</span>
                  </label>

                  <div className="inventory-form-actions">
                    <Button disabled={isSavingProduct} type="submit">
                      {isEditingProduct
                        ? "Guardar cambios"
                        : "Guardar producto"}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowProductForm(false);
                        resetProductForm();
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </section>
            </div>
          ) : (
            /* Product list view */
            <div style={{ display: "grid", gap: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    flex: 1,
                    minWidth: "260px",
                    maxWidth: "480px",
                  }}
                >
                  <label
                    className="inventory-search"
                    htmlFor="inventory-search"
                    style={{ flex: 1, margin: 0 }}
                  >
                    <input
                      id="inventory-search"
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Buscar por SKU, nombre o código..."
                      type="search"
                      value={searchTerm}
                    />
                  </label>
                </div>
                <Button
                  onClick={() => {
                    resetProductForm();
                    setShowProductForm(true);
                  }}
                >
                  Nuevo Producto
                </Button>
              </div>

              <section className="inventory-panel">
                <div className="inventory-panel__header">
                  <h3>Productos</h3>
                  <span>
                    {isLoading ? "Cargando..." : `${productCount} registros`}
                  </span>
                </div>

                <div className="inventory-product-list">
                  {products.length === 0 ? (
                    <div className="inventory-empty">
                      No hay productos para mostrar.
                    </div>
                  ) : (
                    products.map((product) => (
                      <article
                        className="inventory-product-row"
                        key={product.id}
                      >
                        <div>
                          <strong>{product.name}</strong>
                          <span>{product.sku}</span>
                        </div>
                        <div>
                          <span>
                            {product.category_name || "Sin categoria"}
                          </span>
                          <span>{product.barcode || "Sin codigo"}</span>
                        </div>
                        <div>
                          <strong>
                            Q {Number(product.sale_price || 0).toFixed(2)}
                          </strong>
                          <span>
                            Costo Q {Number(product.cost_price || 0).toFixed(2)}
                          </span>
                        </div>
                        <span
                          className={`inventory-badge ${product.is_active ? "inventory-badge--on" : ""}`}
                        >
                          {product.is_active ? "Activo" : "Inactivo"}
                        </span>
                        <div className="inventory-row-actions">
                          <Button
                            onClick={() => {
                              handleEditProduct(product);
                              setShowProductForm(true);
                            }}
                            type="button"
                            variant="secondary"
                          >
                            Editar
                          </Button>
                          <Button
                            disabled={!product.is_active}
                            onClick={() => handleDeactivateProduct(product)}
                            type="button"
                            variant="secondary"
                          >
                            Desactivar
                          </Button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Category Management */}
      {activeTab === "categories" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          {categoryError && (
            <div className="inventory-alert inventory-alert--error">
              {categoryError}
            </div>
          )}
          {categorySuccess && (
            <div className="inventory-alert inventory-alert--success">
              {categorySuccess}
            </div>
          )}

          <div className="categories-grid">
            {/* Left side: Category List */}
            <section className="inventory-panel">
              <div className="inventory-panel__header">
                <h3>Listado de Categorías</h3>
                <span>{categories.length} registros</span>
              </div>
              <div
                style={{
                  padding: "1rem",
                  maxHeight: "65vh",
                  overflowY: "auto",
                }}
              >
                {categories.length === 0 ? (
                  <p
                    style={{
                      color: "#64748b",
                      textAlign: "center",
                      padding: "2rem",
                    }}
                  >
                    No hay categorías registradas.
                  </p>
                ) : (
                  categories.map((cat) => (
                    <div
                      className="category-item"
                      key={cat.id}
                      style={{
                        backgroundColor:
                          editingCategoryId === cat.id
                            ? "#f1f5f9"
                            : "transparent",
                        borderColor:
                          editingCategoryId === cat.id ? "#3b82f6" : "#edf2f7",
                      }}
                    >
                      <div className="category-item-info">
                        <strong style={{ fontSize: "0.95rem" }}>
                          {cat.name}
                        </strong>
                        {cat.parent_name && (
                          <span
                            style={{ fontSize: "0.75rem", color: "#64748b" }}
                          >
                            Padre: {cat.parent_name}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            color: cat.is_active ? "#166534" : "#991b1b",
                          }}
                        >
                          {cat.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <div className="category-item-actions">
                        <Button
                          onClick={() => handleEditCategory(cat)}
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
                          onClick={() => handleDeleteCategory(cat)}
                          variant="secondary"
                          style={{
                            padding: "0.2rem 0.4rem",
                            fontSize: "0.75rem",
                            minHeight: "auto",
                            color: "#991b1b",
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Right side: Create/Edit Form */}
            <section className="inventory-panel">
              <div className="inventory-panel__header">
                <h3>
                  {editingCategoryId
                    ? "Modificar Categoría"
                    : "Nueva Categoría"}
                </h3>
              </div>
              <div style={{ padding: "1rem" }}>
                <form
                  onSubmit={handleSaveCategory}
                  style={{ display: "grid", gap: "1rem" }}
                >
                  <Field
                    id="category-name"
                    label="Nombre de la categoría"
                    value={categoryForm.name}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, name: e.target.value })
                    }
                    placeholder="Ej. Bebidas, Limpieza"
                    required
                  />

                  <label className="field">
                    <span
                      className="field__label"
                      style={{
                        fontWeight: 700,
                        display: "block",
                        marginBottom: "0.4rem",
                      }}
                    >
                      Categoría Padre
                    </span>
                    <select
                      className="field__input"
                      value={categoryForm.parent}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          parent: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        border: "1px solid #cbd5e1",
                        borderRadius: "0.5rem",
                        padding: "0.75rem",
                        outline: "none",
                      }}
                    >
                      <option value="">Ninguna (Categoría raíz)</option>
                      {categories
                        .filter((c) => c.id !== editingCategoryId) // Prevent self-parenting
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label
                    className="inventory-check"
                    style={{ marginTop: "0.5rem" }}
                  >
                    <input
                      checked={categoryForm.is_active}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          is_active: e.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    <span>Categoría activa</span>
                  </label>

                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginTop: "1rem",
                    }}
                  >
                    <Button type="submit">
                      {editingCategoryId ? "Actualizar" : "Crear"}
                    </Button>
                    {editingCategoryId && (
                      <Button
                        onClick={handleResetCategoryForm}
                        type="button"
                        variant="secondary"
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Tab 3: Stock Adjustments/Movements */}
      {activeTab === "stock" && (
        <div style={{ display: "grid", gap: "2rem" }}>
          {stockError && (
            <div className="inventory-alert inventory-alert--error">
              {stockError}
            </div>
          )}

          {/* Stocks Panel */}
          <section className="inventory-panel">
            <div className="inventory-panel__header">
              <div>
                <h3 style={{ margin: 0 }}>Stock en Almacén</h3>
                <p
                  style={{
                    margin: "0.25rem 0 0",
                    color: "#64748b",
                    fontSize: "0.85rem",
                  }}
                >
                  {user?.branch_name
                    ? `Sucursal: ${user.branch_name}`
                    : "Visualizando todas las sucursales"}
                </p>
              </div>
              <span>
                {isStockLoading ? "Cargando..." : `${stocks.length} registros`}
              </span>
            </div>
            <div style={{ padding: "1rem" }}>
              {stocks.length === 0 ? (
                <div className="inventory-empty">
                  No hay registros de stock disponibles.
                </div>
              ) : (
                <div className="inventory-table-container">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Producto</th>
                        <th>Sucursal</th>
                        <th>Stock Actual</th>
                        <th>Mínimo Requerido</th>
                        <th>Estado</th>
                        <th>Última Actualización</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map((st) => (
                        <tr key={st.id}>
                          <td>
                            <strong>{st.product_sku}</strong>
                          </td>
                          <td>{st.product_name}</td>
                          <td>{st.branch_name || "N/A"}</td>
                          <td>
                            <strong
                              style={{
                                color: st.is_below_min_stock
                                  ? "#b91c1c"
                                  : "inherit",
                              }}
                            >
                              {Number(st.qty_on_hand).toFixed(2)}
                            </strong>
                          </td>
                          <td>{Number(st.product_min_stock).toFixed(2)}</td>
                          <td>
                            <span
                              className={`inventory-badge ${!st.is_below_min_stock ? "inventory-badge--on" : ""}`}
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.25rem 0.5rem",
                              }}
                            >
                              {st.is_below_min_stock
                                ? "Bajo Stock"
                                : "Suficiente"}
                            </span>
                          </td>
                          <td>
                            {st.updated_at
                              ? new Date(st.updated_at).toLocaleString("es-GT")
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Movements Panel */}
          <section className="inventory-panel">
            <div className="inventory-panel__header">
              <div>
                <h3 style={{ margin: 0 }}>Historial de Movimientos</h3>
                <p
                  style={{
                    margin: "0.25rem 0 0",
                    color: "#64748b",
                    fontSize: "0.85rem",
                  }}
                >
                  Registro de entradas y salidas de inventario
                </p>
              </div>
              <span>
                {isStockLoading
                  ? "Cargando..."
                  : `${movements.length} registros`}
              </span>
            </div>
            <div style={{ padding: "1rem" }}>
              {movements.length === 0 ? (
                <div className="inventory-empty">
                  No hay movimientos registrados.
                </div>
              ) : (
                <div className="inventory-table-container">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Producto</th>
                        <th>SKU</th>
                        <th>Tipo</th>
                        <th>Cantidad</th>
                        <th>Antes</th>
                        <th>Después</th>
                        <th>Sucursal</th>
                        <th>Usuario</th>
                        <th>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((mv) => (
                        <tr key={mv.id}>
                          <td
                            style={{
                              fontSize: "0.85rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {mv.created_at
                              ? new Date(mv.created_at).toLocaleString("es-GT")
                              : "N/A"}
                          </td>
                          <td>{mv.product_name}</td>
                          <td>
                            <strong>{mv.product_sku}</strong>
                          </td>
                          <td>
                            <span
                              className={`inventory-badge ${mv.type === "IN" ? "inventory-badge--on" : ""}`}
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.25rem 0.5rem",
                              }}
                            >
                              {mv.type === "IN" ? "Entrada" : "Salida"}
                            </span>
                          </td>
                          <td>
                            <strong>{Number(mv.qty).toFixed(2)}</strong>
                          </td>
                          <td>{Number(mv.stock_before || 0).toFixed(2)}</td>
                          <td>{Number(mv.stock_after || 0).toFixed(2)}</td>
                          <td>{mv.branch_name || "N/A"}</td>
                          <td>{mv.created_by_username || "Sistema"}</td>
                          <td
                            style={{
                              fontSize: "0.85rem",
                              color: "#64748b",
                              maxWidth: "200px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={mv.note}
                          >
                            {mv.note || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
