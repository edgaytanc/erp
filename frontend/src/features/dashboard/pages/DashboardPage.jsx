// frontend/src/features/dashboard/pages/DashboardPage.jsx
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  DollarSign,
  Monitor,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Unlock,
  Lock,
} from "lucide-react";

import { useAuth } from "../../../contexts/AuthContext";
import { extractApiErrorMessage } from "../../../lib/apiError";
import {
  closeCashRegister,
  getCurrentCashRegister,
  openCashRegister,
} from "../../pos/api/salesApi";
import { getDashboardSummary } from "../api/dashboardApi";

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("es-GT", {
  maximumFractionDigits: 0,
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatRelativeTime(dateString) {
  if (!dateString) return "Fecha no disponible";
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.max(
    1,
    Math.round((now.getTime() - date.getTime()) / 60000),
  );

  if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
  const diffInHours = Math.round(diffInMinutes / 60);
  if (diffInHours < 24) return `Hace ${diffInHours} h`;
  const diffInDays = Math.round(diffInHours / 24);
  return `Hace ${diffInDays} d`;
}

function CashRegisterModal({
  mode,
  onClose,
  onSubmit,
  open,
  suggestedAmount,
  isBusy,
  error,
}) {
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
        <h2>{isClosing ? "Cerrar Caja" : "Abrir Caja"}</h2>
        <p>
          {isClosing
            ? "Ingresa el efectivo contado en caja al finalizar el turno."
            : "Ingresa el efectivo inicial con el que abre la caja."}
        </p>

        {error ? (
          <div className="alert alert--error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        ) : null}

        <label>
          <span>Monto en efectivo (GTQ)</span>
          <input
            autoFocus
            disabled={isBusy}
            min="0"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            step="0.01"
            type="number"
            value={amount}
            required
          />
        </label>

        {isClosing ? (
          <small style={{ display: "block", marginTop: "0.5rem", color: "#64748b" }}>
            Efectivo esperado según ventas: {formatCurrency(suggestedAmount)}
          </small>
        ) : null}

        <div className="dashboard-modal__actions">
          <button
            className="btn btn--primary"
            disabled={isBusy}
            type="submit"
          >
            {isBusy ? "Procesando..." : isClosing ? "Confirmar Cierre" : "Confirmar Apertura"}
          </button>
          <button
            className="btn btn--secondary"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function DualLineChart({ data = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="dashboard-empty">
        No hay datos suficientes para graficar los últimos 7 días.
      </div>
    );
  }

  const width = 760;
  const height = 230;
  const paddingX = 42;
  const paddingTop = 28;
  const paddingBottom = 42;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(Number(d.sales || 0), Number(d.purchases || 0))),
    100,
  );

  const stepX = chartWidth / Math.max(data.length - 1, 1);

  const getCoordinates = (field) => {
    return data.map((point, index) => {
      const x = paddingX + index * stepX;
      const y =
        paddingTop +
        chartHeight -
        (Number(point[field] || 0) / maxVal) * chartHeight;
      return { x, y, value: point[field] };
    });
  };

  const salesCoords = getCoordinates("sales");
  const purchasesCoords = getCoordinates("purchases");

  const salesLinePoints = salesCoords.map((c) => `${c.x},${c.y}`).join(" ");
  const purchasesLinePoints = purchasesCoords
    .map((c) => `${c.x},${c.y}`)
    .join(" ");

  const baseY = paddingTop + chartHeight;
  const salesAreaPoints = `${paddingX},${baseY} ${salesLinePoints} ${paddingX + (data.length - 1) * stepX},${baseY}`;

  // Cálculo de totales de los 7 días para el resumen en cabecera
  const totalSales7d = data.reduce((acc, curr) => acc + Number(curr.sales || 0), 0);
  const totalPurchases7d = data.reduce(
    (acc, curr) => acc + Number(curr.purchases || 0),
    0,
  );

  const activePoint = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="dashboard-chart-container">
      <div className="dashboard-chart-header">
        <div className="dashboard-chart-legend">
          <div className="dashboard-chart-legend-item">
            <span className="dashboard-chart-legend-dot dashboard-chart-legend-dot--sales" />
            <span>Ventas ({formatCurrency(totalSales7d)})</span>
          </div>
          <div className="dashboard-chart-legend-item">
            <span className="dashboard-chart-legend-dot dashboard-chart-legend-dot--purchases" />
            <span>Compras ({formatCurrency(totalPurchases7d)})</span>
          </div>
        </div>
        {activePoint ? (
          <div className="dashboard-chart-tooltip-badge">
            <strong>{activePoint.label} ({activePoint.day_formatted}):</strong>{" "}
            <span style={{ color: "#2563eb", fontWeight: 700 }}>
              Ventas {formatCurrency(activePoint.sales)}
            </span>{" "}
            |{" "}
            <span style={{ color: "#10b981", fontWeight: 700 }}>
              Compras {formatCurrency(activePoint.purchases)}
            </span>
          </div>
        ) : (
          <span className="dashboard-chart-hint">Pasa el cursor por los puntos para ver detalles</span>
        )}
      </div>

      <div className="dashboard-chart">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Gráfica de Ventas vs Compras de los últimos 7 días"
        >
          {/* Líneas de cuadrícula horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            );
          })}

          {/* Área coloreada bajo la curva de ventas */}
          <polygon
            points={salesAreaPoints}
            className="dashboard-chart__area dashboard-chart__area--sales"
          />

          {/* Línea de compras (Verde/Esmeralda) */}
          <polyline
            points={purchasesLinePoints}
            className="dashboard-chart__line dashboard-chart__line--purchases"
          />

          {/* Línea de ventas (Azul corporativo) */}
          <polyline
            points={salesLinePoints}
            className="dashboard-chart__line dashboard-chart__line--sales"
          />

          {/* Puntos de compras */}
          {purchasesCoords.map((coord, idx) => (
            <circle
              key={`purch-${idx}`}
              cx={coord.x}
              cy={coord.y}
              r={hoveredIndex === idx ? "6.5" : "4.5"}
              className="dashboard-chart__dot dashboard-chart__dot--purchases"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}

          {/* Puntos de ventas */}
          {salesCoords.map((coord, idx) => (
            <circle
              key={`sale-${idx}`}
              cx={coord.x}
              cy={coord.y}
              r={hoveredIndex === idx ? "7" : "5"}
              className="dashboard-chart__dot dashboard-chart__dot--sales"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>

        {/* Etiquetas del eje X */}
        <div className="dashboard-chart__labels">
          {data.map((point, idx) => (
            <div
              key={point.date || idx}
              className={`dashboard-chart-label-col ${hoveredIndex === idx ? "dashboard-chart-label-col--active" : ""}`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span>{point.label}</span>
              <small>{point.day_formatted}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [cashSession, setCashSession] = useState(null);
  const [cashModalMode, setCashModalMode] = useState(null);
  const [isCashBusy, setIsCashBusy] = useState(false);
  const [cashError, setCashError] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSummary = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);

    setError("");
    try {
      const result = await getDashboardSummary();
      setDashboardData(result);

      if (result.cash_register_session !== undefined) {
        setCashSession(result.cash_register_session);
      } else if (user?.branch) {
        try {
          const cashRes = await getCurrentCashRegister();
          setCashSession(cashRes.session);
        } catch {
          // Si falla la consulta de caja secundaria, se mantiene silencioso
        }
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "No fue posible cargar el resumen del dashboard administrativo.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.branch]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Manejadores para abrir y cerrar caja
  async function handleCashSubmit(amount) {
    setIsCashBusy(true);
    setCashError("");

    try {
      if (cashModalMode === "open") {
        const response = await openCashRegister({ opening_amount: amount });
        setCashSession(response.session || response);
        setCashModalMode(null);
        await fetchSummary(true);
      } else if (cashModalMode === "close") {
        await closeCashRegister({ closing_amount: amount });
        setCashSession(null);
        setCashModalMode(null);
        await fetchSummary(true);
      }
    } catch (requestError) {
      setCashError(
        extractApiErrorMessage(
          requestError,
          cashModalMode === "open"
            ? "No se pudo abrir la caja registradora."
            : "No se pudo cerrar la caja registradora.",
        ),
      );
    } finally {
      setIsCashBusy(false);
    }
  }

  const kpis = dashboardData?.kpis || {
    total_sales: 0,
    sales_count: 0,
    total_purchases: 0,
    purchases_count: 0,
    estimated_gross_profit: 0,
    profit_margin: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
  };

  const chartData = dashboardData?.chart_data || [];
  const alerts = dashboardData?.alerts || [];
  const recentActivity = dashboardData?.recent_activity || [];
  const scope = dashboardData?.scope;

  const branchLabel =
    scope?.branch_name ||
    user?.branch_name ||
    "Todas las sucursales (Consolidado Global)";

  const isCashOpen = cashSession?.status === "OPEN";
  const expectedCash = Number(cashSession?.expected_cash || 0);

  return (
    <div className="dashboard-page">
      {/* Encabezado del Dashboard Gerencial */}
      <header className="dashboard-page__header">
        <div>
          <p>Panel de Control Gerencial</p>
          <h1>Dashboard Administrativo</h1>
        </div>
        <div className="dashboard-header-right">
          <div className="dashboard-scope-badge" title="Alcance de los datos mostrados">
            <Building2 size={16} />
            <span>{branchLabel}</span>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm dashboard-refresh-btn"
            onClick={() => fetchSummary(true)}
            disabled={isLoading || isRefreshing}
            title="Actualizar información"
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? "spin-animation" : ""}
            />
            <span>{isRefreshing ? "Actualizando..." : "Refrescar"}</span>
          </button>
        </div>
      </header>

      {/* Manejo de estados de carga y error */}
      {isLoading ? (
        <div className="dashboard-loading">
          <div className="loading-screen__spinner" style={{ margin: "0 auto 1rem" }} />
          <p>Cargando información gerencial del dashboard...</p>
        </div>
      ) : null}

      {error ? (
        <div className="alert alert--error" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Error al cargar dashboard:</strong> {error}
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => fetchSummary()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {!isLoading && !error && (
        <div className="dashboard animate-fade-in">
          {/* ==============================================================
              SECCIÓN HERO: CONTROL DE CAJA POS (DISPONIBLE PARA ADMINISTRADORES DE SUCURSAL)
              ============================================================== */}
          {user?.branch ? (
            <section className="dashboard-pos-hero" style={{ marginBottom: "0.5rem" }}>
              <div>
                <p>Sucursal: {user?.branch_name || "Sin sucursal"}</p>
                <h1>Turno de Ventas (Control de Caja POS)</h1>
                <span>
                  {isCashOpen
                    ? `Caja abierta por ${cashSession.cashier_name || user?.username || "administrador"}`
                    : "Caja cerrada"}
                </span>
                {isCashOpen ? (
                  <small>
                    Apertura: {formatCurrency(cashSession.opening_amount)} |
                    Efectivo esperado: {formatCurrency(expectedCash)}
                  </small>
                ) : (
                  <small>
                    Abre la caja inicial para habilitar el registro de ventas en el Punto de Venta (POS).
                  </small>
                )}
              </div>

              <div className="dashboard-pos-actions">
                {!isCashOpen ? (
                  <button
                    className="dashboard-big-action"
                    disabled={isCashBusy}
                    onClick={() => {
                      setCashError("");
                      setCashModalMode("open");
                    }}
                    type="button"
                  >
                    <Unlock size={22} style={{ marginBottom: "0.2rem" }} />
                    <strong>Abrir caja</strong>
                    <span>Ingresar monto inicial</span>
                  </button>
                ) : null}

                <button
                  className="dashboard-big-action dashboard-big-action--muted"
                  disabled={!isCashOpen || isCashBusy}
                  onClick={() => {
                    setCashError("");
                    setCashModalMode("close");
                  }}
                  type="button"
                >
                  <Lock size={22} style={{ marginBottom: "0.2rem" }} />
                  <strong>Cerrar caja</strong>
                  <span>Conteo final de efectivo</span>
                </button>

                {isCashOpen ? (
                  <Link to="/pos" className="dashboard-big-action" title="Ir al Terminal Punto de Venta">
                    <Monitor size={22} style={{ marginBottom: "0.2rem" }} />
                    <strong>Nueva venta</strong>
                    <span>Abrir Ventas POS</span>
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* ==============================================================
              1. SECCIÓN DE KPIS (TARJETAS SUPERIORES CLICKEABLES)
              ============================================================== */}
          <section className="dashboard-kpis" aria-label="KPIs Gerenciales">
            {/* KPI 1: Ventas del Mes */}
            <Link
              to="/reports"
              className="dashboard-kpi dashboard-kpi--link dashboard-kpi--blue"
              title="Clic para ir al módulo de Reportes de Ventas"
            >
              <div className="dashboard-kpi__icon" aria-hidden="true">
                <DollarSign size={24} />
              </div>
              <div className="dashboard-kpi__content">
                <p>Ventas (Mes Actual)</p>
                <strong>{formatCurrency(kpis.total_sales)}</strong>
                <span>{formatNumber(kpis.sales_count)} ventas registradas</span>
              </div>
              <div className="dashboard-kpi__arrow">
                <ArrowRight size={18} />
              </div>
            </Link>

            {/* KPI 2: Compras del Mes */}
            <Link
              to="/purchases"
              className="dashboard-kpi dashboard-kpi--link dashboard-kpi--slate"
              title="Clic para ir al módulo de Compras"
            >
              <div className="dashboard-kpi__icon" aria-hidden="true">
                <ShoppingCart size={24} />
              </div>
              <div className="dashboard-kpi__content">
                <p>Compras (Mes Actual)</p>
                <strong>{formatCurrency(kpis.total_purchases)}</strong>
                <span>{formatNumber(kpis.purchases_count)} órdenes procesadas</span>
              </div>
              <div className="dashboard-kpi__arrow">
                <ArrowRight size={18} />
              </div>
            </Link>

            {/* KPI 3: Utilidad Bruta Estimada */}
            <Link
              to="/reports"
              className="dashboard-kpi dashboard-kpi--link dashboard-kpi--green"
              title="Clic para ver análisis detallado de Utilidad y Márgenes"
            >
              <div className="dashboard-kpi__icon" aria-hidden="true">
                <TrendingUp size={24} />
              </div>
              <div className="dashboard-kpi__content">
                <p>Utilidad Bruta Estimada</p>
                <strong>{formatCurrency(kpis.estimated_gross_profit)}</strong>
                <span>Margen est.: {kpis.profit_margin}%</span>
              </div>
              <div className="dashboard-kpi__arrow">
                <ArrowRight size={18} />
              </div>
            </Link>

            {/* KPI 4: Alertas de Stock */}
            <Link
              to="/inventory"
              className={`dashboard-kpi dashboard-kpi--link ${
                kpis.out_of_stock_count > 0
                  ? "dashboard-kpi--red"
                  : "dashboard-kpi--amber"
              }`}
              title="Clic para ir al módulo de Inventario y reabastecer stock"
            >
              <div className="dashboard-kpi__icon" aria-hidden="true">
                <Package size={24} />
              </div>
              <div className="dashboard-kpi__content">
                <p>Stock Bajo / Crítico</p>
                <strong>{formatNumber(kpis.low_stock_count)} alertas</strong>
                <span>
                  {kpis.out_of_stock_count > 0
                    ? `${kpis.out_of_stock_count} productos sin existencias`
                    : "En o debajo del mínimo"}
                </span>
              </div>
              <div className="dashboard-kpi__arrow">
                <ArrowRight size={18} />
              </div>
            </Link>
          </section>

          {/* ==============================================================
              2. SECCIÓN DE GRÁFICO (VENTAS VS COMPRAS ÚLTIMOS 7 DÍAS)
              ============================================================== */}
          <section className="dashboard-panel">
            <header className="dashboard-panel__header">
              <div>
                <h2>Ventas vs Compras (Últimos 7 Días)</h2>
                <p>
                  Comparativa de ingresos por ventas confirmadas frente a gastos en compras diarias
                </p>
              </div>
              <div className="dashboard-panel__actions">
                <Link
                  to="/reports"
                  className="dashboard-inline-action"
                  title="Ver reportes históricos completos"
                >
                  <span>Ver reportes completos</span>
                  <ArrowRight size={14} style={{ marginLeft: "4px" }} />
                </Link>
              </div>
            </header>

            <DualLineChart data={chartData} />
          </section>

          {/* ==============================================================
              3. SECCIÓN INFERIOR (DIVIDIDA EN 2 COLUMNAS)
              ============================================================== */}
          <div className="dashboard-columns">
            {/* Columna 1: Alertas Críticas de Inventario */}
            <section className="dashboard-panel">
              <header className="dashboard-panel__header">
                <div>
                  <h2>Alertas Críticas de Inventario</h2>
                  <p>Productos con stock en 0 o por debajo del mínimo</p>
                </div>
                <div className="dashboard-panel__actions">
                  <Link
                    to="/inventory"
                    className="btn btn--secondary btn--sm dashboard-link-button"
                  >
                    <span>Ir al inventario</span>
                    <ArrowRight size={14} style={{ marginLeft: "4px" }} />
                  </Link>
                </div>
              </header>

              {alerts.length === 0 ? (
                <div className="dashboard-empty">
                  No hay productos con stock crítico en este momento. Los niveles de inventario son óptimos.
                </div>
              ) : (
                <div className="dashboard-alert-list">
                  {alerts.map((item) => (
                    <div
                      key={item.id || item.product_id}
                      className={`dashboard-alert ${
                        item.is_out_of_stock ? "dashboard-alert--critical" : ""
                      }`}
                    >
                      <div className="dashboard-alert-info">
                        <strong>{item.product_name}</strong>
                        <div className="dashboard-alert-meta">
                          <span>SKU: {item.sku}</span>
                          {scope?.is_global && item.branch_name ? (
                            <span className="dashboard-alert-branch">
                              Sucursal: {item.branch_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="dashboard-alert-values">
                        <div className="dashboard-alert-badge-wrap">
                          {item.is_out_of_stock ? (
                            <span className="badge badge--danger">Agotado (0)</span>
                          ) : (
                            <span className="badge badge--warning">
                              Stock: {formatNumber(item.qty_on_hand)} unid
                            </span>
                          )}
                        </div>
                        <small>Mín: {formatNumber(item.min_stock)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Columna 2: Actividad Reciente con Call to Actions */}
            <section className="dashboard-panel">
              <header className="dashboard-panel__header">
                <div>
                  <h2>Actividad Reciente</h2>
                  <p>Últimas 5 transacciones registradas</p>
                </div>
                <div className="dashboard-panel__actions dashboard-quick-actions">
                  {user?.branch && !isCashOpen ? (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm dashboard-btn-cta"
                      onClick={() => {
                        setCashError("");
                        setCashModalMode("open");
                      }}
                      title="Abrir caja para habilitar ventas"
                    >
                      <Unlock size={14} />
                      <span>Abrir Caja POS</span>
                    </button>
                  ) : (
                    <Link
                      to="/pos"
                      className="btn btn--primary btn--sm dashboard-btn-cta"
                      title="Abrir Terminal Punto de Venta"
                    >
                      <Plus size={14} />
                      <span>Nueva Venta</span>
                    </Link>
                  )}
                  <Link
                    to="/purchases"
                    className="btn btn--secondary btn--sm dashboard-btn-cta"
                    title="Registrar una nueva compra a proveedor"
                  >
                    <Plus size={14} />
                    <span>Registrar Compra</span>
                  </Link>
                </div>
              </header>

              {recentActivity.length === 0 ? (
                <div className="dashboard-empty">
                  No hay actividad de ventas o compras registrada recientemente.
                </div>
              ) : (
                <div className="dashboard-activity">
                  {recentActivity.map((tx) => {
                    const isSale = tx.type === "SALE";
                    return (
                      <div
                        key={`${tx.type}-${tx.id}`}
                        className="dashboard-activity-item"
                      >
                        <div className="dashboard-activity-main">
                          <div
                            className={`dashboard-activity-icon ${
                              isSale
                                ? "dashboard-activity-icon--sale"
                                : "dashboard-activity-icon--purchase"
                            }`}
                            aria-hidden="true"
                          >
                            {isSale ? (
                              <DollarSign size={16} />
                            ) : (
                              <ShoppingCart size={16} />
                            )}
                          </div>
                          <div>
                            <strong>{tx.reference}</strong>
                            <div className="dashboard-activity-details">
                              <span>{tx.extra_info}</span>
                              {scope?.is_global && tx.branch_name ? (
                                <span className="dashboard-activity-branch">
                                  • {tx.branch_name}
                                </span>
                              ) : null}
                            </div>
                            <small>{formatRelativeTime(tx.timestamp)}</small>
                          </div>
                        </div>

                        <div className="dashboard-activity-side">
                          <span
                            className={`dashboard-activity-amount ${
                              isSale
                                ? "dashboard-activity-amount--positive"
                                : "dashboard-activity-amount--negative"
                            }`}
                          >
                            {isSale ? "+" : "-"} {formatCurrency(tx.amount)}
                          </span>
                          <span
                            className={`dashboard-status-pill dashboard-status-pill--${String(
                              tx.status,
                            ).toLowerCase()}`}
                          >
                            {tx.status_display}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Modal para Abrir o Cerrar Caja */}
      <CashRegisterModal
        error={cashError}
        isBusy={isCashBusy}
        mode={cashModalMode}
        onClose={() => {
          setCashModalMode(null);
          setCashError("");
        }}
        onSubmit={handleCashSubmit}
        open={Boolean(cashModalMode)}
        suggestedAmount={expectedCash}
      />
    </div>
  );
}

export default DashboardPage;
