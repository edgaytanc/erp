import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/common/Button";
import { extractApiErrorMessage } from "../../../lib/apiError";
import {
  createCategory,
  createProduct,
  deactivateProduct,
  listCategories,
  listProducts,
  unwrapResults,
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

  const activeCategories = useMemo(() => categories.filter((category) => category.is_active), [categories]);
  const isEditingProduct = Boolean(editingProductId);

  async function loadInventory(nextSearchTerm = searchTerm) {
    setIsLoading(true);
    setError(null);

    try {
      const [categoriesResponse, productsResponse] = await Promise.all([
        listCategories({ is_active: true, page_size: 100 }),
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

  return (
    <div className="inventory-page">
      <section className="inventory-toolbar">
        <div>
          <h2>Inventario</h2>
          <p>Productos reales para compras, stock y ventas POS.</p>
        </div>
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
    </div>
  );
}
