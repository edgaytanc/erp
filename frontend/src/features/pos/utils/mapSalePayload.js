export function mapSalePayload({ branchId, paymentMethod, items }) {
  return {
    branch: branchId,
    payment_method: paymentMethod,
    items: items.map((item) => ({
      product: item.productId,
      qty: item.qty,
      unit_price: item.unitPrice,
    })),
  };
}
