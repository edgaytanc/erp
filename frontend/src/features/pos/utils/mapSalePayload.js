export function mapSalePayload({ branchId, paymentMethod, items }) {
  return {
    branch: branchId,
    payment_method: paymentMethod,
    items: items.map((item) => ({
      product: item.productId,
      qty: Number(item.quantity || 0).toFixed(3),
      unit_price: Number(item.unitPrice || 0).toFixed(2),
    })),
  };
}
