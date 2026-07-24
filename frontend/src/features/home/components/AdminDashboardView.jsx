import { useState } from "react";
import { Link } from "react-router-dom";
import {
  KpiCard,
  Panel,
  EmptyState,
  TinyLineChart,
  CashRegisterModal,
  formatMoney,
  formatNumber,
  shortId,
  relativeTime,
  saleDate,
  buildSalesTrend,
  buildTopProducts,
} from "./DashboardCommon";

export default function AdminDashboardView({
  data,
  isCashRegisterBusy,
  onCloseCashRegister,
  onOpenCashRegister,
  user,
}) {
  const [activeTab, setActiveTab] = useState("summary");
  const [cashModal, setCashModal] = useState(null);

  const confirmedSales = data.sales.filter(
    (sale) => sale.status === "CONFIRMED",
  );
  const purchases = data.purchases;
  const lowStock = data.lowStock;
  const lowStockCount =
    data.inventoryReport?.items?.filter((item) => item.is_below_min_stock)
      .length || lowStock.length;

  const salesTrend = buildSalesTrend(data.sales);
  const topProducts = buildTopProducts(data.sales);

  const recentSales = confirmedSales.slice(0, 3).map((sale) => ({
    id: sale.id,
    label: `Venta #${shortId(sale.id)}`,
    amount: sale.total,
    at: saleDate(sale),
  }));

  const recentPurchases = purchases.slice(0, 3).map((purchase) => ({
    id: purchase.id,
    label: `Compra #${shortId(purchase.id)}`,
    amount: purchase.total_cost,
    at: purchase.purchased_at || purchase.updated_at || purchase.created_at,
  }));

  const recentMovements = [...recentSales, ...recentPurchases]
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, 5);

  const cashRegister = data.cashRegisterSession;
  const isCashOpen = cashRegister?.status === "OPEN";
  const expectedCash = Number(cashRegister?.expected_cash || 0);

  async function handleCashSubmit(amount) {
    const success =
      cashModal === "close"
        ? await onCloseCashRegister(amount)
        : await onOpenCashRegister(amount);
    if (success) setCashModal(null);
  }

  return (
    <div className="dashboard">
      <div className="dashboard-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "summary"}
          className={`dashboard-tab-btn ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          Resumen General
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "metrics"}
          className={`dashboard-tab-btn ${activeTab === "metrics" ? "active" : ""}`}
          onClick={() => setActiveTab("metrics")}
        >
          Métricas/Gráficos
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "activity"}
          className={`dashboard-tab-btn ${activeTab === "activity" ? "active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          Actividad Reciente
        </button>
      </div>

      <div className="dashboard-tab-content">
        {activeTab === "summary" && (
          <div className="dashboard-tab-pane animate-fade-in">
            {user?.branch ? (
              <section
                className="dashboard-pos-hero"
                style={{ marginBottom: "24px" }}
              >
                <div>
                  <p>Sucursal: {user?.branch_name || "Sin sucursal"}</p>
                  <h1>Turno de ventas (Control de Caja)</h1>
                  <span>
                    {isCashOpen
                      ? `Caja abierta por ${cashRegister.cashier_name || "cajero"}`
                      : "Caja cerrada"}
                  </span>
                  {isCashOpen ? (
                    <small>
                      Apertura {formatMoney(cashRegister.opening_amount)} |
                      Efectivo esperado {formatMoney(expectedCash)}
                    </small>
                  ) : null}
                </div>
                <div className="dashboard-pos-actions">
                  {!isCashOpen ? (
                    <button
                      className="dashboard-big-action"
                      disabled={isCashRegisterBusy}
                      onClick={() => setCashModal("open")}
                      type="button"
                    >
                      <strong>Abrir caja</strong>
                      <span>Monto inicial</span>
                    </button>
                  ) : null}
                  <button
                    className="dashboard-big-action dashboard-big-action--muted"
                    disabled={!isCashOpen || isCashRegisterBusy}
                    onClick={() => setCashModal("close")}
                    type="button"
                  >
                    <strong>Cerrar caja</strong>
                    <span>Conteo final</span>
                  </button>
                  {isCashOpen ? (
                    <Link to="/pos" className="dashboard-big-action">
                      <strong>Nueva venta</strong>
                      <span>Abrir POS</span>
                    </Link>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="dashboard-kpis" aria-label="KPIs rápidos">
              <KpiCard
                icon="$"
                label="Ventas"
                value={formatMoney(data.salesReport?.summary?.total)}
                meta={`${formatNumber(data.salesReport?.summary?.sales_count)} ventas`}
              />
              <KpiCard
                icon="!"
                label="Stock bajo"
                value={`${lowStockCount} alertas`}
                meta="Revisión de inventario"
                tone="amber"
              />
              <KpiCard
                icon="#"
                label="Compras"
                value={`${formatNumber(data.purchasesReport?.summary?.purchases_count)} órdenes`}
                meta={formatMoney(data.purchasesReport?.summary?.total_cost)}
                tone="green"
              />
              <KpiCard
                icon="+"
                label="Clientes"
                value="No disponible"
                meta="Requiere módulo CRM"
                tone="slate"
              />
            </section>
          </div>
        )}

        {activeTab === "metrics" && (
          <div className="dashboard-tab-pane animate-fade-in">
            <Panel
              title="Ventas últimos 7 días"
              subtitle="Total diario de ventas confirmadas"
            >
              <TinyLineChart points={salesTrend} />
            </Panel>

            <div style={{ marginTop: "24px" }}>
              <Panel title="Top productos" subtitle="Por venta acumulada">
                {topProducts.length ? (
                  <ol className="dashboard-ranked-list">
                    {topProducts.map((product) => (
                      <li key={product.name}>
                        <span>{product.name}</span>
                        <strong>{formatMoney(product.total)}</strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState />
                )}
              </Panel>
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="dashboard-tab-pane animate-fade-in">
            <div className="dashboard-columns">
              <Panel
                title="Alertas de inventario"
                subtitle="Productos en o debajo del mínimo"
                actions={
                  <Link
                    className="btn btn--secondary dashboard-link-button"
                    to="/inventory"
                  >
                    Ver inventario
                  </Link>
                }
              >
                {lowStock.length ? (
                  <div className="dashboard-alert-list">
                    {lowStock.slice(0, 5).map((stock) => (
                      <div
                        key={stock.id || stock.product}
                        className="dashboard-alert"
                      >
                        <span>{stock.product_name || stock.name}</span>
                        <strong>{formatNumber(stock.qty_on_hand)} unid</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState>Sin alertas críticas.</EmptyState>
                )}
              </Panel>

              <Panel title="Movimientos recientes">
                {recentMovements.length ? (
                  <div className="dashboard-activity">
                    {recentMovements.map((movement) => (
                      <div key={`${movement.label}-${movement.id}`}>
                        <span>{movement.label}</span>
                        <strong>{formatMoney(movement.amount)}</strong>
                        <small>{relativeTime(movement.at)}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )}
              </Panel>
            </div>
          </div>
        )}
      </div>

      <CashRegisterModal
        mode={cashModal}
        onClose={() => setCashModal(null)}
        onSubmit={handleCashSubmit}
        open={Boolean(cashModal)}
        suggestedAmount={expectedCash}
      />
    </div>
  );
}
