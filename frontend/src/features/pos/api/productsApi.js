import api from "../../../lib/axios";

export async function searchProducts(params = {}) {
  const response = await api.get("/inventory/products/", { params });
  return response.data;
}

export async function searchStocks(params = {}) {
  const response = await api.get("/inventory/stocks/", { params });
  return response.data;
}

export function unwrapResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

export async function searchPosProducts({
  branchId,
  q = "",
  pageSize = 10,
} = {}) {
  const productsResponse = await searchProducts({
    branch: branchId,
    branch_id: branchId,
    q,
    is_active: true,
    page_size: 100,
    ordering: "name",
  });
  const products = unwrapResults(productsResponse);

  if (!branchId || products.length === 0) {
    return [];
  }

  const stocksResponse = await searchStocks({
    branch: branchId,
    branch_id: branchId,
    q,
    page_size: 200,
  });
  const stocks = unwrapResults(stocksResponse);
  const stockByProduct = new Map(stocks.map((stock) => [stock.product, stock]));

  const productsWithStock = products
    .map((product) => {
      const stock = stockByProduct.get(product.id);

      // Priorizar el precio de venta específico de la sucursal activa:
      // 1. stock.sale_price (del registro Stock de la sucursal)
      // 2. product.branch_price (si es provisto explícitamente)
      // 3. product.sale_price (calculado por el serializer con branch_id)
      // 4. product.price
      const branchPrice =
        stock?.sale_price !== undefined && stock?.sale_price !== null
          ? stock.sale_price
          : product.branch_price !== undefined && product.branch_price !== null
            ? product.branch_price
            : product.sale_price !== undefined && product.sale_price !== null
              ? product.sale_price
              : product.price ?? 0;

      return {
        id: product.id,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        price: branchPrice,
        sale_price: branchPrice,
        branch_price: branchPrice,
        stock: stock ? Number(stock.qty_on_hand) : 0,
      };
    })
    .filter((product) => product.stock > 0);

  return productsWithStock.slice(0, pageSize);
}

export async function getRecommendations({ q, branchId, limit = 20 } = {}) {
  if (!branchId || !q || !q.trim()) {
    return [];
  }
  const response = await api.get("/pos/recommendations/", {
    params: {
      q: q.trim(),
      branch: branchId,
      branch_id: branchId,
      limit,
    },
  });
  return unwrapResults(response.data);
}
