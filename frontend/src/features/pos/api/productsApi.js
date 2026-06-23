import api from "../../../lib/axios";

export async function searchProducts(params = {}) {
  const response = await api.get("/inventory/products/", { params });
  return response.data;
}

export async function searchStocks(params = {}) {
  const response = await api.get("/inventory/stocks/", { params });
  return response.data;
}

function unwrapResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

export async function searchPosProducts({ branchId, q = "", pageSize = 10 } = {}) {
  const productsResponse = await searchProducts({
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
    q,
    page_size: 200,
  });
  const stocks = unwrapResults(stocksResponse);
  const stockByProduct = new Map(stocks.map((stock) => [stock.product, stock]));

  const productsWithStock = products
    .map((product) => {
      const stock = stockByProduct.get(product.id);

      return {
        id: product.id,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        price: product.sale_price,
        stock: stock ? Number(stock.qty_on_hand) : 0,
      };
    })
    .filter((product) => product.stock > 0);

  return productsWithStock.slice(0, pageSize);
}
