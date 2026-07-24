import { useEffect, useMemo, useState } from "react";

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
import { ReportFilters } from "../components/ReportFilters";
import { ReportSummary } from "../components/ReportSummary";
import { ReportTable } from "../components/ReportTable";
import {
  escapeHtml,
  monthStartIsoDate,
  selectedBranchLabel,
  todayIsoDate,
  unwrapResults,
  valueFor,
} from "../utils/reportUtils";
import "../../../styles/reports.css";

const REPORT_GROUPS = [
  {
    id: "sales",
    label: "Ventas",
    description: "Análisis de ventas por producto y categoría.",
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
          ["Categoría", "category_name"],
          ["Ventas", "sales_count", "number"],
          ["Unidades", "units_sold", "number"],
          ["Total", "total", "money"],
        ],
      },
      {
        id: "sales-category",
        label: "Ventas por Categoría",
        fetcher: getSalesByCategoryReport,
        usesDates: true,
        summary: [
          ["Categorías", "categories_count"],
          ["Unidades", "units_sold", "number"],
          ["Total vendido", "total", "money"],
        ],
        columns: [
          ["Categoría", "category_name"],
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
          ["Categoría", "category_name"],
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
    description:
      "Análisis de proveedores, productos comprados y relación compras contra ventas.",
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
        label: "Productos más comprados",
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
          ["Categoría", "category_name"],
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
    description:
      "Stock crítico, valor, distribución por sucursal y movimientos.",
    reports: [
      {
        id: "critical-stock",
        label: "Stock Crítico",
        fetcher: getCriticalStockReport,
        usesDates: false,
        summary: [["Productos críticos", "critical_count", "number"]],
        columns: [
          ["Sucursal", "branch_name"],
          ["SKU", "sku"],
          ["Producto", "name"],
          ["Categoría", "category_name"],
          ["Stock", "qty_on_hand", "number"],
          ["Mínimo", "min_stock", "number"],
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
          ["Categoría", "category_name"],
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
          ["Stock crítico", "critical_count", "number"],
          ["Valor", "inventory_value", "money"],
        ],
        columns: [
          ["Sucursal", "branch_name"],
          ["SKUs", "sku_count", "number"],
          ["Unidades", "total_qty", "number"],
          ["Stock crítico", "critical_count", "number"],
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
              .map(
                ([, key, type]) =>
                  `<td>${escapeHtml(valueFor(row, key, type))}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${report.columns.length}">Sin datos para los filtros seleccionados.</td></tr>`;

  const footerHtml =
    report.id === "margin" && rows.length > 0
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
  const [activeReportId, setActiveReportId] = useState(
    REPORT_GROUPS[0].reports[0].id,
  );
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
    () =>
      REPORT_GROUPS.find((group) => group.id === activeGroupId) ||
      REPORT_GROUPS[0],
    [activeGroupId],
  );
  const activeReport = useMemo(
    () =>
      activeGroup.reports.find((report) => report.id === activeReportId) ||
      activeGroup.reports[0],
    [activeGroup, activeReportId],
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
        branches.length
          ? Promise.resolve(branches)
          : listBranches({ is_active: true }),
        activeReport.fetcher(params),
      ]);

      setBranches(unwrapResults(branchesResponse));
      if (activeReport.usesCashiers && !users.length) {
        setUsers(unwrapResults(await listUsers()));
      }
      setReportData(reportResponse);
    } catch (requestError) {
      setError(
        extractApiErrorMessage(requestError, "No se pudo cargar el reporte."),
      );
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
        "No se pudo abrir la pestaña del reporte. Revisa si el navegador bloqueó ventanas emergentes.",
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
      }),
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
        <div
          className="reports-tabs"
          role="tablist"
          aria-label="Tipos de reporte"
        >
          {REPORT_GROUPS.map((group) => (
            <button
              className={
                activeGroupId === group.id
                  ? "reports-tab reports-tab--active"
                  : "reports-tab"
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

      <div className="reports-grid">
        {/* Left Column: Sidebar with Selector and Filters */}
        <div className="reports-grid__sidebar">
          <section
            className="reports-selector"
            aria-label="Reportes disponibles"
          >
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

          <ReportFilters
            activeReport={activeReport}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            branchId={branchId}
            setBranchId={setBranchId}
            branches={branches}
            cashierId={cashierId}
            setCashierId={setCashierId}
            users={users}
            limit={limit}
            setLimit={setLimit}
            isLoading={isLoading}
            reportData={reportData}
            onSubmit={handleApplyFilters}
            onGeneratePdf={handleGeneratePdf}
          />
        </div>

        {/* Right Column: Content with Current Report, Summary, and Details Table */}
        <div className="reports-grid__content">
          {error ? <div className="reports-alert">{error}</div> : null}

          <section className="reports-current">
            <div>
              <span>Reporte activo</span>
              <h3>{activeReport.label}</h3>
            </div>
            <p>{branchLabel}</p>
          </section>

          <ReportSummary activeReport={activeReport} reportData={reportData} />

          <ReportTable
            activeReport={activeReport}
            reportData={reportData}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
