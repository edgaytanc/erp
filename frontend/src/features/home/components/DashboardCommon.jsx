import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/common/Button";

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-GT", {
  maximumFractionDigits: 0,
});

export const PURCHASE_STATUS_LABELS = {
  DRAFT: "Pendiente",
  CONFIRMED: "Entregado",
  CANCELLED: "Cancelado",
};

export function formatMoney(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

export function unwrap(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

export function shortId(id) {
  return String(id || "")
    .slice(0, 8)
    .toUpperCase();
}

export function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function isToday(value) {
  if (!value) return false;
  return toDateKey(new Date(value)) === todayKey();
}

export function timeLabel(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-GT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function relativeTime(value) {
  if (!value) return "Sin fecha";

  const minutes = Math.max(
    1,
    Math.round((Date.now() - new Date(value).getTime()) / 60000),
  );

  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Hace ${days} d`;
}

export function saleDate(sale) {
  return sale.sold_at || sale.updated_at || sale.created_at;
}

export function buildSalesTrend(sales) {
  const today = new Date();
  const points = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: toDateKey(date),
      label: new Intl.DateTimeFormat("es-GT", { weekday: "short" }).format(
        date,
      ),
      total: 0,
    };
  });

  sales
    .filter((sale) => sale.status === "CONFIRMED")
    .forEach((sale) => {
      const point = points.find(
        (item) => item.key === toDateKey(new Date(saleDate(sale))),
      );
      if (point) point.total += Number(sale.total || 0);
    });

  return points;
}

export function buildTopProducts(sales) {
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

export function TinyLineChart({ points }) {
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
        <polyline
          points={coordinates.join(" ")}
          className="dashboard-chart__line"
        />
        {points.map((point, index) => {
          const [x, y] = coordinates[index].split(",");
          return (
            <circle
              key={point.key}
              cx={x}
              cy={y}
              r="5"
              className="dashboard-chart__dot"
            />
          );
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

export function KpiCard({ icon, label, value, meta, tone = "blue" }) {
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

export function Panel({ title, subtitle, actions, children }) {
  return (
    <section className="dashboard-panel">
      <header className="dashboard-panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? (
          <div className="dashboard-panel__actions">{actions}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function EmptyState({ children = "No hay datos disponibles." }) {
  return <p className="dashboard-empty">{children}</p>;
}

export function CashRegisterModal({
  mode,
  onClose,
  onSubmit,
  open,
  suggestedAmount,
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
        <h2>{isClosing ? "Cerrar caja" : "Abrir caja"}</h2>
        <p>
          {isClosing
            ? "Ingresa el efectivo contado al finalizar el día."
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
          <Button type="submit">
            {isClosing ? "Cerrar caja" : "Abrir caja"}
          </Button>
          <Button onClick={onClose} type="button" variant="secondary">
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
