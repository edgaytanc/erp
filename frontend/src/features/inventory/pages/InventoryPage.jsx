import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { Field } from "../../../components/common/Field";
import { extractApiErrorMessage } from "../../../lib/apiError";
import {
  createCategory,
  createProduct,
  deactivateProduct,
  deleteCategory,
  listCategories,
  listProducts,
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
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 0.75rem;
  background: #ffffff;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.3s ease-out;
}

.modal-grid {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 1.5rem;
  padding: 1.5rem;
}

@media (max-width: 768px) {
  .modal-grid {
    grid-template-columns: 1fr;
  }
}

.category-list-container {
  border-right: 1px solid #edf2f7;
  padding-right: 1.5rem;
  max-height: 50vh;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .category-list-container {
    border-right: none;
    padding-right: 0;
    max-height: 30vh;
  }
}

.category-item {
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #edf2f7;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
}

.category-item:hover {
  background-color: #f8fafc;
  border-color: #cbd5e1;
}

.category-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.category-item-actions {
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

export function InventoryPage() {
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

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", parent: "", is_active: true });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [modalSuccess, setModalSuccess] = useState(null);

  const activeCategories = useMemo(() => categories.filter((category) => category.is_active), [categories]);
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
      setProductCount(productsResponse?.count ?? unwrapResults(productsResponse).length);
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo cargar el inventario."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadInventory(searchTerm);
    }, 300);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

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
      const category = await createCategory({ name: categoryName.trim(), is_active: true });
      setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
      setProductForm((current) => ({ ...current, category: category.id }));
      setCategoryName("");
      setSuccess("Categoria creada.");
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo crear la categoria."));
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
      await loadInventory(searchTerm);
    } catch (requestError) {
      setError(
        extractApiErrorMessage(
          requestError,
          isEditingProduct ? "No se pudo actualizar el producto." : "No se pudo crear el producto.",
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
      setError(extractApiErrorMessage(requestError, "No se pudo desactivar el producto."));
    }
  }

  // Category Modal Handlers
  function handleEditCategoryModal(category) {
    setCategoryForm({
      name: category.name,
      parent: category.parent || "",
      is_active: category.is_active,
    });
    setEditingCategoryId(category.id);
    setModalError(null);
    setModalSuccess(null);
  }

  function handleResetCategoryForm() {
    setCategoryForm({ name: "", parent: "", is_active: true });
    setEditingCategoryId(null);
  }

  async function handleSaveCategoryModal(event) {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      setModalError("El nombre de la categoría es requerido.");
      return;
    }

    setModalError(null);
    setModalSuccess(null);

    const payload = {
      name: categoryForm.name.trim(),
      parent: categoryForm.parent || null,
      is_active: categoryForm.is_active,
    };

    try {
      if (editingCategoryId) {
        await updateCategory(editingCategoryId, payload);
        setModalSuccess("Categoría actualizada correctamente.");
      } else {
        await createCategory(payload);
        setModalSuccess("Categoría creada correctamente.");
      }

      handleResetCategoryForm();
      const categoriesResponse = await listCategories({ page_size: 100 });
      setCategories(unwrapResults(categoriesResponse));
    } catch (requestError) {
      setModalError(extractApiErrorMessage(requestError, "No se pudo guardar la categoría."));
    }
  }

  async function handleDeleteCategoryModal(category) {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la categoría "${category.name}"?`)) {
      return;
    }

    setModalError(null);
    setModalSuccess(null);

    try {
      await deleteCategory(category.id);
      setModalSuccess("Categoría eliminada correctamente.");
      handleResetCategoryForm();
      
      const categoriesResponse = await listCategories({ page_size: 100 });
      setCategories(unwrapResults(categoriesResponse));
    } catch (requestError) {
      setModalError(
        extractApiErrorMessage(
          requestError,
          "No se pudo eliminar la categoría. Probablemente está en uso por productos o subcategorías."
        )
      );
    }
  }

  return (
    <div className="inventory-page">
      <style>{modalStyles}</style>

      <section className="inventory-toolbar">
        <div>
          <h2>Inventario</h2>
          <p>Productos reales para compras, stock y ventas POS.</p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "end" }}>
          <Button onClick={() => {
            setIsCategoryModalOpen(true);
            setModalError(null);
            setModalSuccess(null);
          }} variant="secondary">
            Gestionar Categorías
          </Button>
          <label className="inventory-search" htmlFor="inventory-search">
            <span>Buscar</span>
            <input
              id="inventory-search"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="SKU, nombre o codigo"
              type="search"
              value={searchTerm}
            />
          </label>
        </div>
      </section>

      {error ? <div className="inventory-alert inventory-alert--error">{error}</div> : null}
      {success ? <div className="inventory-alert inventory-alert--success">{success}</div> : null}

      <div className="inventory-grid">
        <section className="inventory-panel inventory-panel--form">
          <div className="inventory-panel__header">
            <h3>{isEditingProduct ? "Editar producto" : "Nuevo producto"}</h3>
            <span>{activeCategories.length} categorias</span>
          </div>

          <form className="inventory-category-form" onSubmit={handleCreateCategory}>
            <input
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Crear categoria rapida"
              type="text"
              value={categoryName}
            />
            <Button disabled={isSavingCategory} type="submit" variant="secondary">
              Crear
            </Button>
          </form>

          <form className="inventory-product-form" onSubmit={handleSaveProduct}>
            <label>
              <span>Categoria</span>
              <select
                onChange={(event) => updateProductField("category", event.target.value)}
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
                  onChange={(event) => updateProductField("sku", event.target.value)}
                  required
                  type="text"
                  value={productForm.sku}
                />
              </label>
              <label>
                <span>Codigo</span>
                <input
                  onChange={(event) => updateProductField("barcode", event.target.value)}
                  type="text"
                  value={productForm.barcode}
                />
              </label>
            </div>

            <label>
              <span>Nombre</span>
              <input
                onChange={(event) => updateProductField("name", event.target.value)}
                required
                type="text"
                value={productForm.name}
              />
            </label>

            <label>
              <span>Descripcion</span>
              <textarea
                onChange={(event) => updateProductField("description", event.target.value)}
                rows="3"
                value={productForm.description}
              />
            </label>

            <div className="inventory-form-row inventory-form-row--three">
              <label>
                <span>Venta</span>
                <input
                  min="0"
                  onChange={(event) => updateProductField("sale_price", event.target.value)}
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
                  onChange={(event) => updateProductField("cost_price", event.target.value)}
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
                  onChange={(event) => updateProductField("min_stock", event.target.value)}
                  step="0.01"
                  type="number"
                  value={productForm.min_stock}
                />
              </label>
            </div>

            <label className="inventory-check">
              <input
                checked={productForm.is_active}
                onChange={(event) => updateProductField("is_active", event.target.checked)}
                type="checkbox"
              />
              <span>Producto activo</span>
            </label>

            <div className="inventory-form-actions">
              <Button disabled={isSavingProduct} type="submit">
                {isEditingProduct ? "Guardar cambios" : "Guardar producto"}
              </Button>
              {isEditingProduct ? (
                <Button onClick={resetProductForm} type="button" variant="secondary">
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="inventory-panel">
          <div className="inventory-panel__header">
            <h3>Productos</h3>
            <span>{isLoading ? "Cargando..." : `${productCount} registros`}</span>
          </div>

          <div className="inventory-product-list">
            {products.length === 0 ? (
              <div className="inventory-empty">No hay productos para mostrar.</div>
            ) : (
              products.map((product) => (
                <article className="inventory-product-row" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.sku}</span>
                  </div>
                  <div>
                    <span>{product.category_name || "Sin categoria"}</span>
                    <span>{product.barcode || "Sin codigo"}</span>
                  </div>
                  <div>
                    <strong>Q {Number(product.sale_price || 0).toFixed(2)}</strong>
                    <span>Costo Q {Number(product.cost_price || 0).toFixed(2)}</span>
                  </div>
                  <span className={`inventory-badge ${product.is_active ? "inventory-badge--on" : ""}`}>
                    {product.is_active ? "Activo" : "Inactivo"}
                  </span>
                  <div className="inventory-row-actions">
                    <Button onClick={() => handleEditProduct(product)} type="button" variant="secondary">
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

      {isCategoryModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsCategoryModalOpen(false);
          handleResetCategoryForm();
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Card
              title={editingCategoryId ? "Editar Categoría" : "Gestionar Categorías"}
              subtitle="Crea, edita o elimina las categorías del sistema de inventario."
              actions={
                <Button onClick={() => {
                  setIsCategoryModalOpen(false);
                  handleResetCategoryForm();
                }} variant="secondary">
                  Cerrar
                </Button>
              }
            >
              {modalError && <div className="inventory-alert inventory-alert--error" style={{ marginBottom: "1rem" }}>{modalError}</div>}
              {modalSuccess && <div className="inventory-alert inventory-alert--success" style={{ marginBottom: "1rem" }}>{modalSuccess}</div>}

              <div className="modal-grid">
                {/* Left side: Category List */}
                <div className="category-list-container">
                  <h4 style={{ marginBottom: "1rem", marginTop: 0 }}>Listado ({categories.length})</h4>
                  {categories.length === 0 ? (
                    <p style={{ color: "#64748b" }}>No hay categorías registradas.</p>
                  ) : (
                    categories.map((cat) => (
                      <div className="category-item" key={cat.id} style={{
                        backgroundColor: editingCategoryId === cat.id ? "#f1f5f9" : "transparent",
                        borderColor: editingCategoryId === cat.id ? "#3b82f6" : "#edf2f7"
                      }}>
                        <div className="category-item-info">
                          <strong style={{ fontSize: "0.95rem" }}>{cat.name}</strong>
                          {cat.parent_name && (
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                              Padre: {cat.parent_name}
                            </span>
                          )}
                          <span style={{
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            color: cat.is_active ? "#166534" : "#991b1b"
                          }}>
                            {cat.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                        <div className="category-item-actions">
                          <Button
                            onClick={() => handleEditCategoryModal(cat)}
                            variant="secondary"
                            style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem", minHeight: "auto" }}
                          >
                            Editar
                          </Button>
                          <Button
                            onClick={() => handleDeleteCategoryModal(cat)}
                            variant="secondary"
                            style={{
                              padding: "0.2rem 0.4rem",
                              fontSize: "0.75rem",
                              minHeight: "auto",
                              color: "#991b1b"
                            }}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Right side: Create/Edit Form */}
                <div>
                  <h4 style={{ marginBottom: "1rem", marginTop: 0 }}>
                    {editingCategoryId ? "Modificar Categoría" : "Nueva Categoría"}
                  </h4>
                  <form onSubmit={handleSaveCategoryModal} style={{ display: "grid", gap: "1rem" }}>
                    <Field
                      id="category-name"
                      label="Nombre de la categoría"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="Ej. Bebidas, Limpieza"
                      required
                    />

                    <label className="field">
                      <span className="field__label">Categoría Padre</span>
                      <select
                        className="field__input"
                        value={categoryForm.parent}
                        onChange={(e) => setCategoryForm({ ...categoryForm, parent: e.target.value })}
                        style={{
                          width: "100%",
                          border: "1px solid #cbd5e1",
                          borderRadius: "0.5rem",
                          padding: "0.75rem",
                          outline: "none"
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

                    <label className="inventory-check" style={{ marginTop: "0.5rem" }}>
                      <input
                        checked={categoryForm.is_active}
                        onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                        type="checkbox"
                      />
                      <span>Categoría activa</span>
                    </label>

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                      <Button type="submit">
                        {editingCategoryId ? "Actualizar" : "Crear"}
                      </Button>
                      {editingCategoryId && (
                        <Button onClick={handleResetCategoryForm} type="button" variant="secondary">
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
