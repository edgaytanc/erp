import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/common/Button";
import { useAuth } from "../../../contexts/AuthContext";
import { extractApiErrorMessage } from "../../../lib/apiError";
import { APP_ROLES } from "../../auth/constants/roles";
import {
  listStocks,
  unwrapResults as unwrapInventoryResults,
} from "../../inventory/api/inventoryApi";
import {
  listPurchases,
  listSuppliers,
  unwrapResults as unwrapPurchaseResults,
} from "../../purchases/api/purchasesApi";
import { closeCashRegister, getCurrentCashRegister, listSales, openCashRegister } from "../../pos/api/salesApi";
import {
  getInventoryReport,
  getPurchasesReport,
  getSalesReport,
} from "../../reports/api/reportsApi";

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-GT", {
  maximumFractionDigits: 0,
});

const PURCHASE_STATUS_LABELS = {
  DRAFT: "Pendiente",
  CONFIRMED: "Entregado",
  CANCELLED: "Cancelado",
};

function formatMoney(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function unwrap(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

function shortId(id) {
  return String(id || "")
    .slice(0, 8)
    .toUpperCase();
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function todayKey() {
  return toDateKey(new Date());
}

function isToday(value) {
  if (!value) return false;
  return toDateKey(new Date(value)) === todayKey();
}

function timeLabel(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-GT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function relativeTime(value) {
  if (!value) return "Sin fecha";

  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));

  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Hace ${days} d`;
}

function saleDate(sale) {
  return sale.sold_at || sale.updated_at || sale.created_at;
}

function buildSalesTrend(sales) {
  const today = new Date();
  const points = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: toDateKey(date),
      label: new Intl.DateTimeFormat("es-GT", { weekday: "short" }).format(date),
      total: 0,
    };
  });

  sales
    .filter((sale) => sale.status === "CONFIRMED")
    .forEach((sale) => {
      const point = points.find((item) => item.key === toDateKey(new Date(saleDate(sale))));
      if (point) point.total += Number(sale.total || 0);
    });

  return points;
}

function buildTopProducts(sales) {
  const products = new Map();

  sales
    .filter((sale) => sale.status === "CONFIRMED")
    .forEach((sale) => {
      sale.items?.forEach((item) => {
        const key = item.product || item.product_sku || item.product_name;
        const current = products.get(key) || {
          name: item.product_name || item.product_sku || "Producto",
          qty: 0,
          total: 0,
        };
        current.qty += Number(item.qty || 0);
        current.total += Number(item.subtotal || 0);
        products.set(key, current);
      });
    });

  return [...products.values()].sort((a, b) => b.total - a.total).slice(0, 5);
}

function TinyLineChart({ points }) {
  const width = 640;
  const height = 180;
  const max = Math.max(...points.map((point) => point.total), 1);
  const step = width / Math.max(points.length - 1, 1);
  const coordinates = points.map((point, index) => {
    const x = index * step;
    const y = height - 22 - (point.total / max) * (height - 44);
    return `${x},${y}`;
  });
  const areaCoordinates = `0,${height - 16} ${coordinates.join(" ")} ${width},${height - 16}`;

  return (
    <div className="dashboard-chart" aria-label="Ventas de los últimos 7 días">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <polygon points={areaCoordinates} className="dashboard-chart__area" />
        <polyline points={coordinates.join(" ")} className="dashboard-chart__line" />
        {points.map((point, index) => {
          const [x, y] = coordinates[index].split(",");
          return <circle key={point.key} cx={x} cy={y} r="5" className="dashboard-chart__dot" />;
        })}
      </svg>
      <div className="dashboard-chart__labels">
        {points.map((point) => (
          <span key={point.key}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, meta, tone = "blue" }) {
  return (
    <article className={`dashboard-kpi dashboard-kpi--${tone}`}>
      <div className="dashboard-kpi__icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {meta ? <span>{meta}</span> : null}
      </div>
    </article>
  );
}

function Panel({ title, subtitle, actions, children }) {
  return (
    <section className="dashboard-panel">
      <header className="dashboard-panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="dashboard-panel__actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ children = "No hay datos disponibles." }) {
  return <p className="dashboard-empty">{children}</p>;
}

function CashRegisterModal({ mode, onClose, onSubmit, open, suggestedAmount }) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open && mode === "close") {
      setAmount(Number(suggestedAmount || 0).toFixed(2));
    }
    if (open && mode === "open") {
      setAmount("");
    }
  }, [mode, open, suggestedAmount]);

  if (!open) return null;

  const isClosing = mode === "close";

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(amount);
  }

  return (
    <div className="dashboard-modal-backdrop">
      <form className="dashboard-modal" onSubmit={handleSubmit}>
        <h2>{isClosing ? "Cerrar caja" : "Abrir caja"}</h2>
        <p>
          {isClosing
            ? "Ingresa el efectivo contado al finalizar el dia."
            : "Ingresa el efectivo inicial con el que abre la caja."}
        </p>
        <label>
          <span>Monto en efectivo</span>
          <input
            autoFocus
            min="0"
            onChange={(event) => setAmount(event.target.value)}
            step="0.01"
            type="number"
            value={amount}
          />
        </label>
        {isClosing ? (
          <small>Efectivo esperado: {formatMoney(suggestedAmount)}</small>
        ) : null}
        <div className="dashboard-modal__actions">
          <Button type="submit">{isClosing ? "Cerrar caja" : "Abrir caja"}</Button>
          <Button onClick={onClose} type="button" variant="secondary">
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

function AdminDashboard({ data }) {
  const confirmedSales = data.sales.filter((sale) => sale.status === "CONFIRMED");
  const purchases = data.purchases;
  const lowStock = data.lowStock;
  const lowStockCount =
    data.inventoryReport?.items?.filter((item) => item.is_below_min_stock).length ||
    lowStock.length;
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

  return (
    <div className="dashboard">
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

      <Panel title="Ventas últimos 7 días" subtitle="Total diario de ventas confirmadas">
        <TinyLineChart points={salesTrend} />
      </Panel>

      <div className="dashboard-columns">
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

        <Panel
          title="Alertas de inventario"
          subtitle="Productos en o debajo del mínimo"
          actions={
            <Link className="btn btn--secondary dashboard-link-button" to="/inventory">
              Ver inventario
            </Link>
          }
        >
          {lowStock.length ? (
            <div className="dashboard-alert-list">
              {lowStock.slice(0, 5).map((stock) => (
                <div key={stock.id || stock.product} className="dashboard-alert">
                  <span>{stock.product_name || stock.name}</span>
                  <strong>{formatNumber(stock.qty_on_hand)} unid</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>Sin alertas críticas.</EmptyState>
          )}
        </Panel>
      </div>

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
  );
}

function PurchasesDashboard({ data }) {
  const activeOrders = data.purchases.filter((purchase) => purchase.status !== "CANCELLED");
  const pendingOrders = data.purchases.filter((purchase) => purchase.status === "DRAFT");
  const payableTotal = pendingOrders.reduce(
    (total, purchase) => total + Number(purchase.total_cost || 0),
    0
  );
  const suppliersById = new Map(data.suppliers.map((supplier) => [supplier.id, supplier.name]));

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
          value={formatNumber(data.suppliers.filter((supplier) => supplier.is_active).length)}
          meta="Activos"
          tone="green"
        />
      </section>

      <Panel
        title="Órdenes de compra"
        actions={
          <Link className="btn btn--primary dashboard-link-button" to="/purchases">
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
                      {PURCHASE_STATUS_LABELS[purchase.status] || purchase.status}
                    </span>
                  </td>
                  <td>
                    <Link to="/purchases">{purchase.status === "DRAFT" ? "Editar" : "Ver"}</Link>
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
                    <td>{formatNumber(stock.product_min_stock || stock.min_stock)}</td>
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

function PosDashboard({ data, isCashRegisterBusy, onCloseCashRegister, onOpenCashRegister, user }) {
  const [cashModal, setCashModal] = useState(null);
  const todaysSales = data.sales.filter(
    (sale) => sale.status === "CONFIRMED" && isToday(saleDate(sale))
  );
  const totalSold = todaysSales.reduce((total, sale) => total + Number(sale.total || 0), 0);
  const averageTicket = todaysSales.length ? totalSold / todaysSales.length : 0;
  const topProduct = buildTopProducts(todaysSales)[0];
  const cashRegister = data.cashRegisterSession;
  const isCashOpen = cashRegister?.status === "OPEN";
  const expectedCash = Number(cashRegister?.expected_cash || 0);

  async function handleCashSubmit(amount) {
    const success =
      cashModal === "close" ? await onCloseCashRegister(amount) : await onOpenCashRegister(amount);
    if (success) setCashModal(null);
  }

  return (
    <div className="dashboard">
      <section className="dashboard-pos-hero">
        <div>
          <p>Sucursal: {user?.branch_name || "Sin sucursal"}</p>
          <h1>Turno de ventas</h1>
          <span>{isCashOpen ? "Caja abierta" : "Caja cerrada"}</span>
          {isCashOpen ? (
            <small>
              Apertura {formatMoney(cashRegister.opening_amount)} | Efectivo esperado{" "}
              {formatMoney(expectedCash)}
            </small>
          ) : null}
        </div>
        <div className="dashboard-pos-actions">
          {isCashOpen ? (
            <Link to="/pos" className="dashboard-big-action">
              <strong>Nueva venta</strong>
              <span>Abrir POS</span>
            </Link>
          ) : (
            <button
              className="dashboard-big-action"
              disabled={isCashRegisterBusy}
              onClick={() => setCashModal("open")}
              type="button"
            >
              <strong>Abrir caja</strong>
              <span>Monto inicial</span>
            </button>
          )}
          <button
            className="dashboard-big-action dashboard-big-action--muted"
            disabled={!isCashOpen || isCashRegisterBusy}
            onClick={() => setCashModal("close")}
            type="button"
          >
            <strong>Cerrar caja</strong>
            <span>Conteo final</span>
          </button>
          <Link to="/pos" className="dashboard-big-action dashboard-big-action--muted">
            <strong>Mis ventas hoy</strong>
            <span>Historial</span>
          </Link>
        </div>
      </section>

      <Panel title="Resumen del turno">
        <div className="dashboard-shift-summary">
          <div>
            <span>Ventas realizadas</span>
            <strong>{formatNumber(todaysSales.length)}</strong>
          </div>
          <div>
            <span>Total vendido</span>
            <strong>{formatMoney(totalSold)}</strong>
          </div>
          <div>
            <span>Ticket promedio</span>
            <strong>{formatMoney(averageTicket)}</strong>
          </div>
          <div>
            <span>Efectivo esperado</span>
            <strong>{formatMoney(expectedCash)}</strong>
          </div>
          <div>
            <span>Producto más vendido</span>
            <strong>
              {topProduct ? `${topProduct.name} (${formatNumber(topProduct.qty)})` : "Sin ventas"}
            </strong>
          </div>
        </div>
      </Panel>

      <Panel title="Últimas ventas" subtitle="Consultas y reimpresión">
        {todaysSales.length ? (
          <div className="dashboard-activity">
            {todaysSales.slice(0, 5).map((sale) => (
              <div key={sale.id}>
                <span>#{shortId(sale.id)}</span>
                <strong>{formatMoney(sale.total)}</strong>
                <small>
                  {sale.items?.length || 0} productos | {timeLabel(saleDate(sale))}
                </small>
                <Link to="/pos">Reimprimir</Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>Sin ventas confirmadas hoy.</EmptyState>
        )}
      </Panel>
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

export function HomePage() {
  const { user } = useAuth();
  const [data, setData] = useState({
    sales: [],
    purchases: [],
    suppliers: [],
    lowStock: [],
    salesReport: null,
    purchasesReport: null,
    inventoryReport: null,
    cashRegisterSession: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCashRegisterBusy, setIsCashRegisterBusy] = useState(false);
  const [error, setError] = useState("");

  const role = user?.role;

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const requests = [];

        if (role === APP_ROLES.ADMIN) {
          requests.push(
            getSalesReport().then((value) => ["salesReport", value]),
            getPurchasesReport().then((value) => ["purchasesReport", value]),
            getInventoryReport().then((value) => ["inventoryReport", value]),
            listSales().then((value) => ["sales", unwrap(value)]),
            listPurchases().then((value) => ["purchases", unwrapPurchaseResults(value)]),
            listSuppliers().then((value) => ["suppliers", unwrapPurchaseResults(value)]),
            listStocks({ low: "true", page_size: 8 }).then((value) => [
              "lowStock",
              unwrapInventoryResults(value),
            ])
          );
        }

        if (role === APP_ROLES.PURCHASES) {
          const stockParams = user?.branch
            ? { branch: user.branch, low: "true", page_size: 8 }
            : { low: "true", page_size: 8 };
          requests.push(
            listPurchases().then((value) => ["purchases", unwrapPurchaseResults(value)]),
            listSuppliers().then((value) => ["suppliers", unwrapPurchaseResults(value)]),
            listStocks(stockParams).then((value) => ["lowStock", unwrapInventoryResults(value)])
          );
        }

        if (role === APP_ROLES.SALES) {
          requests.push(
            listSales().then((value) => ["sales", unwrap(value)]),
            getCurrentCashRegister().then((value) => ["cashRegisterSession", value.session])
          );
        }

        const results = await Promise.all(requests);

        if (!isActive) return;

        setData((current) => ({
          ...current,
          sales: [],
          purchases: [],
          suppliers: [],
          lowStock: [],
          salesReport: null,
          purchasesReport: null,
          inventoryReport: null,
          cashRegisterSession: null,
          ...Object.fromEntries(results),
        }));
      } catch (loadError) {
        if (!isActive) return;
        setError(
          loadError?.response?.data?.detail || "No se pudo cargar la información del dashboard."
        );
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, [role, user?.branch]);

  async function handleOpenCashRegister(amount) {
    setIsCashRegisterBusy(true);
    setError("");

    try {
      const session = await openCashRegister({ opening_amount: amount });
      setData((current) => ({ ...current, cashRegisterSession: session }));
      return true;
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo abrir caja."));
      return false;
    } finally {
      setIsCashRegisterBusy(false);
    }
  }

  async function handleCloseCashRegister(amount) {
    setIsCashRegisterBusy(true);
    setError("");

    try {
      const session = await closeCashRegister({ closing_amount: amount });
      setData((current) => ({ ...current, cashRegisterSession: session }));
      return true;
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo cerrar caja."));
      return false;
    } finally {
      setIsCashRegisterBusy(false);
    }
  }

  const title = useMemo(() => {
    if (role === APP_ROLES.PURCHASES) return "Dashboard de compras";
    if (role === APP_ROLES.SALES) return "Dashboard POS";
    return "Dashboard administrativo";
  }, [role]);

  return (
    <div className="dashboard-page">
      <header className="dashboard-page__header">
        <div>
          <p>Inicio</p>
          <h1>{title}</h1>
        </div>
        <span>{user?.branch_name || "Todas las sucursales"}</span>
      </header>

      {isLoading ? <div className="dashboard-loading">Cargando información...</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      {!isLoading && !error && role === APP_ROLES.ADMIN ? <AdminDashboard data={data} /> : null}
      {!isLoading && !error && role === APP_ROLES.PURCHASES ? (
        <PurchasesDashboard data={data} />
      ) : null}
      {!isLoading && !error && role === APP_ROLES.SALES ? (
        <PosDashboard
          data={data}
          isCashRegisterBusy={isCashRegisterBusy}
          onCloseCashRegister={handleCloseCashRegister}
          onOpenCashRegister={handleOpenCashRegister}
          user={user}
        />
      ) : null}
    </div>
  );
}
