import { Link } from "react-router-dom";
import {
  KpiCard,
  Panel,
  EmptyState,
  formatMoney,
  formatNumber,
  shortId,
  PURCHASE_STATUS_LABELS,
} from "./DashboardCommon";

export default function PurchasesDashboardView({ data }) {
  const activeOrders = data.purchases.filter(
    (purchase) => purchase.status !== "CANCELLED",
  );
  const pendingOrders = data.purchases.filter(
    (purchase) => purchase.status === "DRAFT",
  );
  const payableTotal = pendingOrders.reduce(
    (total, purchase) => total + Number(purchase.total_cost || 0),
    0,
  );
  const suppliersById = new Map(
    data.suppliers.map((supplier) => [supplier.id, supplier.name]),
  );

  return (
    <div className="dashboard">
      <section className="dashboard-kpis" aria-label="KPIs de compras">
        <KpiCard
          icon="#"
          label="Órdenes activas"
          value={formatNumber(activeOrders.length)}
          meta={`${pendingOrders.length} pendientes`}
        />
        <KpiCard
          icon=">"
          label="En tránsito"
          value="No disponible"
          meta="Estado no existe aún"
          tone="slate"
        />
        <KpiCard
          icon="$"
          label="Por pagar"
          value={formatMoney(payableTotal)}
          meta="Órdenes pendientes"
          tone="amber"
        />
        <KpiCard
          icon="+"
          label="Proveedores"
          value={formatNumber(
            data.suppliers.filter((supplier) => supplier.is_active).length,
          )}
          meta="Activos"
          tone="green"
        />
      </section>

      <Panel
        title="Órdenes de compra"
        actions={
          <Link
            className="btn btn--primary dashboard-link-button"
            to="/purchases"
          >
            Nueva orden
          </Link>
        }
      >
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Proveedor</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {data.purchases.slice(0, 6).map((purchase) => (
                <tr key={purchase.id}>
                  <td>{shortId(purchase.id)}</td>
                  <td>
                    {purchase.supplier_name ||
                      suppliersById.get(purchase.supplier) ||
                      purchase.supplier ||
                      "Proveedor"}
                  </td>
                  <td>{formatMoney(purchase.total_cost)}</td>
                  <td>
                    <span
                      className={`dashboard-status dashboard-status--${purchase.status?.toLowerCase()}`}
                    >
                      {PURCHASE_STATUS_LABELS[purchase.status] ||
                        purchase.status}
                    </span>
                  </td>
                  <td>
                    <Link to="/purchases">
                      {purchase.status === "DRAFT" ? "Editar" : "Ver"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.purchases.length ? <EmptyState /> : null}
        </div>
      </Panel>

      <Panel title="Stock crítico" subtitle="Base para compras rápidas">
        {data.lowStock.length ? (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Proveedor habitual</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStock.slice(0, 5).map((stock) => (
                  <tr key={stock.id || stock.product}>
                    <td>{stock.product_name || stock.name}</td>
                    <td>{formatNumber(stock.qty_on_hand)}</td>
                    <td>
                      {formatNumber(stock.product_min_stock || stock.min_stock)}
                    </td>
                    <td>No disponible</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link className="dashboard-inline-action" to="/purchases">
              Crear orden
            </Link>
          </div>
        ) : (
          <EmptyState>Sin productos críticos.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
