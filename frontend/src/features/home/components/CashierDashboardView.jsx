import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Panel,
  EmptyState,
  CashRegisterModal,
  formatMoney,
  formatNumber,
  shortId,
  timeLabel,
  relativeTime,
  isToday,
  saleDate,
  buildTopProducts,
} from "./DashboardCommon";

export default function CashierDashboardView({
  data,
  isCashRegisterBusy,
  onCloseCashRegister,
  onOpenCashRegister,
  user,
}) {
  const [cashModal, setCashModal] = useState(null);

  const todaysSales = data.sales.filter(
    (sale) => sale.status === "CONFIRMED" && isToday(saleDate(sale)),
  );

  const totalSold = todaysSales.reduce(
    (total, sale) => total + Number(sale.total || 0),
    0,
  );
  const averageTicket = todaysSales.length ? totalSold / todaysSales.length : 0;
  const topProduct = buildTopProducts(todaysSales)[0];

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

  const isOwnCashSession =
    cashRegister && String(cashRegister.cashier) === String(user?.id);
  const canNewSale = isCashOpen && isOwnCashSession;
  const canClose = isCashOpen && (isOwnCashSession || user?.role === "admin");

  return (
    <div className="dashboard">
      <section className="dashboard-pos-hero animate-fade-in">
        <div>
          <p>Sucursal: {user?.branch_name || "Sin sucursal"}</p>
          <h1>Turno de ventas</h1>
          <span>
            {isCashOpen
              ? isOwnCashSession
                ? "Caja abierta"
                : `Caja abierta por ${cashRegister.cashier_name || "otro usuario"}`
              : "Caja cerrada"}
          </span>
          {isCashOpen ? (
            <small>
              Apertura {formatMoney(cashRegister.opening_amount)} | Efectivo
              esperado {formatMoney(expectedCash)}
            </small>
          ) : null}
        </div>
        <div className="dashboard-pos-actions">
          {isCashOpen ? (
            canNewSale ? (
              <Link to="/pos" className="dashboard-big-action">
                <strong>Nueva venta</strong>
                <span>Abrir POS</span>
              </Link>
            ) : (
              <button className="dashboard-big-action" disabled type="button">
                <strong>Nueva venta</strong>
                <span>Caja ajena</span>
              </button>
            )
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
            disabled={!canClose || isCashRegisterBusy}
            onClick={() => setCashModal("close")}
            type="button"
          >
            <strong>Cerrar caja</strong>
            <span>Conteo final</span>
          </button>
          {canNewSale ? (
            <Link
              to="/pos"
              className="dashboard-big-action dashboard-big-action--muted"
            >
              <strong>Mis ventas hoy</strong>
              <span>Historial</span>
            </Link>
          ) : (
            <button
              className="dashboard-big-action dashboard-big-action--muted"
              disabled
              type="button"
            >
              <strong>Mis ventas hoy</strong>
              <span>Historial</span>
            </button>
          )}
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
          <div className="dashboard-shift-summary__full-width">
            <span>Producto más vendido</span>
            <strong>
              {topProduct
                ? `${topProduct.name} (${formatNumber(topProduct.qty)})`
                : "Sin ventas"}
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
                  {sale.items?.length || 0} productos |{" "}
                  {timeLabel(saleDate(sale))}
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
