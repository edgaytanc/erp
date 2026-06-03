import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/common/Button";
import { extractApiErrorMessage } from "../../../lib/apiError";
import { listBranches, listUsers } from "../../admin/api/adminConfigApi";
import {
  getCashRegisterReport,
  getCriticalStockReport,
  getDailyUtilityReport,
  getInventoryByBranchReport,
  getInventoryMovementsReport,
  getInventoryValueReport,
  getProductMarginReport,
  getPurchasedProductsReport,
  getPurchasesBySupplierReport,
  getPurchasesVsSalesReport,
  getSalesByCategoryReport,
  getSalesByProductReport,
  getTopSellingProductsReport,
} from "../api/reportsApi";
import "../../../styles/reports.css";

const REPORT_GROUPS = [
  {
    id: "sales",
    label: "Ventas",
    description: "Analisis de ventas por producto y categoria.",
    reports: [
      {
        id: "sales-product",
        label: "Ventas por Producto",
        fetcher: getSalesByProductReport,
        usesDates: true,
        summary: [
          ["Productos", "products_count"],
          ["Unidades", "units_sold", "number"],
          ["Total vendido", "total", "money"],
        ],
        columns: [
          ["SKU", "sku"],
          ["Producto", "name"],
          ["Categoria", "category_name"],
          ["Ventas", "sales_count", "number"],
          ["Unidades", "units_sold", "number"],
          ["Total", "total", "money"],
        ],
      },
      {
        id: "sales-category",
        label: "Ventas por Categoria",
        fetcher: getSalesByCategoryReport,
        usesDates: true,
        summary: [
          ["Categorias", "categories_count"],
          ["Unidades", "units_sold", "number"],
          ["Total vendido", "total", "money"],
        ],
        columns: [
          ["Categoria", "category_name"],
          ["Productos", "products_count", "number"],
          ["Ventas", "sales_count", "number"],
          ["Unidades", "units_sold", "number"],
          ["Total", "total", "money"],
        ],
      },
      {
        id: "daily-utility",
        label: "Utilidad Diaria",
        fetcher: getDailyUtilityReport,
        usesDates: true,
        summary: [
          ["Ventas", "sales_count", "number"],
          ["Ingresos Totales", "total_revenue", "money"],
          ["Costo de Ventas", "total_cost", "money"],
          ["Utilidad", "utility", "money"],
        ],
        columns: [
          ["Fecha", "date"],
          ["Ventas", "sales_count", "number"],
          ["Ingresos Totales", "total_revenue", "money"],
          ["Costo de Ventas", "total_cost", "money"],
          ["Utilidad", "utility", "money"],
        ],
      },
      {
        id: "top-selling",
        label: "Productos Más Vendidos",
        fetcher: getTopSellingProductsReport,
        usesDates: true,
        usesLimit: true,
        summary: [
          ["Productos", "products_count"],
          ["Unidades", "units_sold", "number"],
          ["Total vendido", "total_revenue", "money"],
        ],
        columns: [
          ["SKU", "sku"],
          ["Producto", "name"],
          ["Categoria", "category_name"],
          ["Ventas", "sales_count", "number"],
          ["Unidades", "units_sold", "number"],
          ["Total", "total_revenue", "money"],
        ],
      },
      {
        id: "margin",
        label: "Margen por Producto",
        fetcher: getProductMarginReport,
        usesDates: true,
        summary: [
          ["Productos", "products_count"],
          ["Margen Promedio", "average_margin", "percentage"],
        ],
        columns: [
          ["Producto", "name"],
          ["Precio Venta", "sale_price", "money"],
          ["Costo Compra", "cost_price", "money"],
          ["Margen", "margin", "percentage"],
        ],
      },
      {
        id: "cash-register",
        label: "Movimientos de caja",
        fetcher: getCashRegisterReport,
        usesCashiers: true,
        usesDates: true,
        summary: [
          ["Cajas", "sessions_count", "number"],
          ["Abiertas", "open_count", "number"],
          ["Cerradas", "closed_count", "number"],
          ["Diferencia", "difference", "money"],
        ],
        columns: [
          ["Fecha", "movement_at", "date"],
          ["Movimiento", "movement_type"],
          ["Sucursal", "branch_name"],
          ["Cajero", "cashier_name"],
          ["Monto", "amount", "money"],
          ["Ventas efectivo", "cash_sales_total", "money"],
          ["Efectivo esperado", "expected_cash", "money"],
          ["Diferencia", "difference", "money"],
          ["Estado", "status"],
        ],
      },
    ],
  },
  {
    id: "purchases",
    label: "Compras",
    description: "Analisis de proveedores, productos comprados y relacion compras contra ventas.",
    reports: [
      {
        id: "purchases-supplier",
        label: "Compras por Proveedor",
        fetcher: getPurchasesBySupplierReport,
        usesDates: true,
        summary: [
          ["Proveedores", "suppliers_count"],
          ["Compras", "purchases_count", "number"],
          ["Total comprado", "total_cost", "money"],
        ],
        columns: [
          ["Proveedor", "supplier_name"],
          ["Compras", "purchases_count", "number"],
          ["Total", "total_cost", "money"],
        ],
      },
      {
        id: "purchased-products",
        label: "Productos mas comprados",
        fetcher: getPurchasedProductsReport,
        usesDates: true,
        summary: [
          ["Productos", "products_count"],
          ["Unidades", "units_purchased", "number"],
          ["Total comprado", "total_cost", "money"],
        ],
        columns: [
          ["SKU", "sku"],
          ["Producto", "name"],
          ["Categoria", "category_name"],
          ["Compras", "purchases_count", "number"],
          ["Unidades", "units_purchased", "number"],
          ["Total", "total_cost", "money"],
        ],
      },
      {
        id: "purchases-vs-sales",
        label: "Compras vs Ventas",
        fetcher: getPurchasesVsSalesReport,
        usesDates: true,
        summary: [
          ["Ventas", "sales_total", "money"],
          ["Compras", "purchases_total", "money"],
          ["Diferencia", "difference", "money"],
        ],
        columns: [
          ["Sucursal", "branch_name"],
          ["Ventas", "sales_total", "money"],
          ["Compras", "purchases_total", "money"],
          ["Diferencia", "difference", "money"],
        ],
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventario",
    description: "Stock critico, valor, distribucion por sucursal y movimientos.",
    reports: [
      {
        id: "critical-stock",
        label: "Stock Critico",
        fetcher: getCriticalStockReport,
        usesDates: false,
        summary: [["Productos criticos", "critical_count", "number"]],
        columns: [
          ["Sucursal", "branch_name"],
          ["SKU", "sku"],
          ["Producto", "name"],
          ["Categoria", "category_name"],
          ["Stock", "qty_on_hand", "number"],
          ["Minimo", "min_stock", "number"],
          ["Faltante", "shortage", "number"],
        ],
      },
      {
        id: "inventory-value",
        label: "Valor de Inventario",
        fetcher: getInventoryValueReport,
        usesDates: false,
        summary: [
          ["SKUs", "sku_count", "number"],
          ["Unidades", "total_qty", "number"],
          ["Valor", "inventory_value", "money"],
        ],
        columns: [
          ["Sucursal", "branch_name"],
          ["SKU", "sku"],
          ["Producto", "name"],
          ["Categoria", "category_name"],
          ["Stock", "qty_on_hand", "number"],
          ["Costo", "unit_cost", "money"],
          ["Valor", "inventory_value", "money"],
        ],
      },
      {
        id: "inventory-branch",
        label: "Inventario por sucursal",
        fetcher: getInventoryByBranchReport,
        usesDates: false,
        summary: [
          ["SKUs", "sku_count", "number"],
          ["Unidades", "total_qty", "number"],
          ["Stock critico", "critical_count", "number"],
          ["Valor", "inventory_value", "money"],
        ],
        columns: [
          ["Sucursal", "branch_name"],
          ["SKUs", "sku_count", "number"],
          ["Unidades", "total_qty", "number"],
          ["Stock critico", "critical_count", "number"],
          ["Valor", "inventory_value", "money"],
        ],
      },
      {
        id: "inventory-movements",
        label: "Movimientos de inventario",
        fetcher: getInventoryMovementsReport,
        usesDates: true,
        summary: [
          ["Movimientos", "movements_count", "number"],
          ["Entradas", "in_qty", "number"],
          ["Salidas", "out_qty", "number"],
        ],
        columns: [
          ["Fecha", "created_at", "date"],
          ["Sucursal", "branch_name"],
          ["SKU", "sku"],
          ["Producto", "name"],
          ["Tipo", "type"],
          ["Cantidad", "qty", "number"],
          ["Stock anterior", "stock_before", "number"],
          ["Stock final", "stock_after", "number"],
          ["Referencia", "reference_type"],
        ],
      },
    ],
  },
];

function formatMoney(value) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-GT", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIsoDate() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function unwrapResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

function valueFor(row, key, type) {
  const value = row?.[key];

  if (type === "money") return formatMoney(value);
  if (type === "number") return formatNumber(value);
  if (type === "percentage") return `${formatNumber(value)}%`;
  if (type === "date") return value ? new Date(value).toLocaleString("es-GT") : "Sin fecha";
  if (key === "type") return value === "IN" ? "Entrada" : value === "OUT" ? "Salida" : value || "-";
  if (key === "status") return value === "OPEN" ? "Abierta" : value === "CLOSED" ? "Cerrada" : value || "-";
  return value ?? "-";
}

function selectedBranchLabel(branchId, branches, data) {
  if (data?.scope?.branch_name) return data.scope.branch_name;
  if (!branchId) return "Todas las sucursales";
  return branches.find((branch) => branch.id === branchId)?.name || "Sucursal seleccionada";
}

function buildPdfHtml({ report, data, dateFrom, dateTo, branchLabel }) {
  const rows = data?.items || [];
  const filters = report.usesDates
    ? `Desde: ${dateFrom || "Inicio"} · Hasta: ${dateTo || "Hoy"} · Sucursal: ${branchLabel}`
    : `Sucursal: ${branchLabel}`;
  const rowsHtml = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${report.columns
              .map(([, key, type]) => `<td>${escapeHtml(valueFor(row, key, type))}</td>`)
              .join("")}</tr>`
        )
        .join("")
    : `<tr><td colspan="${report.columns.length}">Sin datos para los filtros seleccionados.</td></tr>`;

  const footerHtml = (report.id === "margin" && rows.length > 0)
    ? `<tr style="font-weight: bold; background: #f1f5f9;">
        <td>Promedio General</td>
        <td>-</td>
        <td>-</td>
        <td>${escapeHtml(valueFor(data?.summary, "average_margin", "percentage"))}</td>
       </tr>`
    : "";

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(report.label)}</title>
        <style>
          body {
            font-family: Inter, Arial, sans-serif;
            color: #142033;
            margin: 0;
            padding: 24px;
            background: #f8fafc;
          }
          .print-shell {
            max-width: 1180px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #dfe8f4;
            border-radius: 8px;
            overflow: hidden;
          }
          header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 20px;
            border-bottom: 1px solid #edf2f7;
          }
          h1 {
            margin: 0;
            font-size: 24px;
          }
          p {
            margin: 6px 0 0;
            color: #526176;
          }
          button {
            border: 0;
            border-radius: 8px;
            padding: 12px 16px;
            background: #2563eb;
            color: #ffffff;
            font-weight: 700;
            cursor: pointer;
          }
          main {
            padding: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th, td {
            border-bottom: 1px solid #e5edf7;
            padding: 9px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f1f5f9;
            font-weight: 800;
          }
          @media print {
            body {
              padding: 0;
              background: #ffffff;
            }
            .print-shell {
              max-width: none;
              border: 0;
              border-radius: 0;
            }
            .print-actions {
              display: none;
            }
            table {
              font-size: 10px;
            }
            th, td {
              padding: 6px;
            }
          }
        </style>
      </head>
      <body>
        <section class="print-shell">
          <header>
            <div>
              <h1>${escapeHtml(report.label)}</h1>
              <p>${escapeHtml(filters)}</p>
              <p>Generado: ${escapeHtml(new Date().toLocaleString("es-GT"))}</p>
            </div>
            <div class="print-actions">
              <button onclick="window.print()">Imprimir / guardar PDF</button>
            </div>
          </header>
          <main>
            <table>
              <thead>
                <tr>${report.columns.map(([label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${rowsHtml}
                ${footerHtml}
              </tbody>
            </table>
          </main>
        </section>
      </body>
    </html>
  `;
}

export function ReportsPage() {
  const [activeGroupId, setActiveGroupId] = useState("sales");
  const [activeReportId, setActiveReportId] = useState(REPORT_GROUPS[0].reports[0].id);
  const [dateFrom, setDateFrom] = useState(monthStartIsoDate);
  const [dateTo, setDateTo] = useState(todayIsoDate);
  const [branchId, setBranchId] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [limit, setLimit] = useState(10);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const activeGroup = useMemo(
    () => REPORT_GROUPS.find((group) => group.id === activeGroupId) || REPORT_GROUPS[0],
    [activeGroupId]
  );
  const activeReport = useMemo(
    () =>
      activeGroup.reports.find((report) => report.id === activeReportId) || activeGroup.reports[0],
    [activeGroup, activeReportId]
  );
  const branchLabel = selectedBranchLabel(branchId, branches, reportData);

  async function loadReport() {
    setIsLoading(true);
    setError(null);

    try {
      const params = { branch: branchId || undefined };
      if (activeReport.usesDates) {
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }
      if (activeReport.usesCashiers) {
        params.cashier = cashierId || undefined;
      }
      if (activeReport.usesLimit) {
        params.limit = limit;
      }

      const [branchesResponse, reportResponse] = await Promise.all([
        branches.length ? Promise.resolve(branches) : listBranches({ is_active: true }),
        activeReport.fetcher(params),
      ]);

      setBranches(unwrapResults(branchesResponse));
      if (activeReport.usesCashiers && !users.length) {
        setUsers(unwrapResults(await listUsers()));
      }
      setReportData(reportResponse);
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo cargar el reporte."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReportId]);

  function handleGroupChange(group) {
    setActiveGroupId(group.id);
    setActiveReportId(group.reports[0].id);
    setReportData(null);
  }

  function handleApplyFilters(event) {
    event.preventDefault();
    loadReport();
  }

  function handleGeneratePdf() {
    if (!reportData) return;

    const printable = window.open("about:blank", "_blank");
    if (!printable) {
      setError(
        "No se pudo abrir la pestaña del reporte. Revisa si el navegador bloqueo ventanas emergentes."
      );
      return;
    }

    printable.document.write(
      buildPdfHtml({
        report: activeReport,
        data: reportData,
        dateFrom,
        dateTo,
        branchLabel,
      })
    );
    printable.document.close();
    printable.focus();
  }

  return (
    <div className="reports-page">
      <section className="reports-toolbar">
        <div>
          <h2>Reportes</h2>
          <p>{activeGroup.description}</p>
        </div>
        <div className="reports-tabs" role="tablist" aria-label="Tipos de reporte">
          {REPORT_GROUPS.map((group) => (
            <button
              className={
                activeGroupId === group.id ? "reports-tab reports-tab--active" : "reports-tab"
              }
              key={group.id}
              onClick={() => handleGroupChange(group)}
              type="button"
            >
              {group.label}
            </button>
          ))}
        </div>
      </section>

      <section className="reports-selector" aria-label="Reportes disponibles">
        {activeGroup.reports.map((report) => (
          <button
            className={
              activeReport.id === report.id
                ? "reports-option reports-option--active"
                : "reports-option"
            }
            key={report.id}
            onClick={() => {
              setActiveReportId(report.id);
              setReportData(null);
            }}
            type="button"
          >
            {report.label}
          </button>
        ))}
      </section>

      <form className="reports-filters" onSubmit={handleApplyFilters}>
        <label>
          <span>Desde</span>
          <input
            disabled={!activeReport.usesDates}
            onChange={(event) => setDateFrom(event.target.value)}
            type="date"
            value={dateFrom}
          />
        </label>
        <label>
          <span>Hasta</span>
          <input
            disabled={!activeReport.usesDates}
            onChange={(event) => setDateTo(event.target.value)}
            type="date"
            value={dateTo}
          />
        </label>
        <label>
          <span>Sucursal</span>
          <select onChange={(event) => setBranchId(event.target.value)} value={branchId}>
            <option value="">Todas las sucursales</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        {activeReport.usesCashiers ? (
          <label>
            <span>Cajero</span>
            <select onChange={(event) => setCashierId(event.target.value)} value={cashierId}>
              <option value="">Todos los cajeros</option>
              {users
                .filter((user) => user.role === "sales" || user.role === "admin")
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name || user.last_name
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : user.username}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        {activeReport.usesLimit ? (
          <label>
            <span>Top N</span>
            <input
              onChange={(event) => setLimit(Number(event.target.value))}
              type="number"
              min="1"
              max="500"
              value={limit}
            />
          </label>
        ) : null}
        <Button disabled={isLoading} type="submit">
          Aplicar
        </Button>
        <Button
          disabled={isLoading || !reportData}
          onClick={handleGeneratePdf}
          type="button"
          variant="secondary"
        >
          Generar version PDF
        </Button>
      </form>

      {error ? <div className="reports-alert">{error}</div> : null}

      <section className="reports-current">
        <div>
          <span>Reporte activo</span>
          <h3>{activeReport.label}</h3>
        </div>
        <p>{branchLabel}</p>
      </section>

      <section className="reports-summary">
        {activeReport.summary.map(([label, key, type]) => (
          <article key={key}>
            <span>{label}</span>
            <strong>{valueFor(reportData?.summary, key, type)}</strong>
          </article>
        ))}
      </section>

      <section className="reports-panel reports-panel--detail">
        <div className="reports-panel__header">
          <h3>Detalle</h3>
          <span>{isLoading ? "Cargando..." : `${reportData?.items?.length || 0} filas`}</span>
        </div>
        <div className="reports-table-wrap">
          <table className="reports-data-table">
            <thead>
              <tr>
                {activeReport.columns.map(([label]) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(reportData?.items || []).map((row, index) => (
                <tr
                  key={row.id || row.product || row.category || row.supplier || row.branch || index}
                >
                  {activeReport.columns.map(([label, key, type]) => (
                    <td key={`${label}-${key}`}>{valueFor(row, key, type)}</td>
                  ))}
                </tr>
              ))}
              {!isLoading && activeReport.id === "margin" && (reportData?.items || []).length > 0 ? (
                <tr style={{ fontWeight: "bold", background: "#f1f5f9" }}>
                  <td>Promedio General</td>
                  <td>-</td>
                  <td>-</td>
                  <td>{valueFor(reportData?.summary, "average_margin", "percentage")}</td>
                </tr>
              ) : null}
              {!isLoading && (reportData?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={activeReport.columns.length}>
                    <div className="reports-empty">Sin datos para estos filtros.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
