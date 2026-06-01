import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/common/Button";
import { extractApiErrorMessage } from "../../../lib/apiError";
import { listBranches } from "../../admin/api/adminConfigApi";
import { getInventoryReport, getPurchasesReport, getSalesReport } from "../api/reportsApi";
import "../../../styles/reports.css";

function formatMoney(value) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
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

function reportLabel(reportType) {
  if (reportType === "sales") {
    return "Reporte de Ventas";
  }
  if (reportType === "purchases") {
    return "Reporte de Compras";
  }
  return "Reporte de Inventario";
}

function buildPrintableRows(reportType, items) {
  if (reportType === "sales") {
    return {
      headers: ["Fecha", "Sucursal", "Metodo de pago", "Subtotal", "IVA", "Total"],
      rows: items.map((sale) => [
        sale.sold_at ? new Date(sale.sold_at).toLocaleString("es-GT") : "Sin fecha",
        sale.branch_name,
        sale.payment_method,
        formatMoney(sale.subtotal),
        formatMoney(sale.tax),
        formatMoney(sale.total),
      ]),
    };
  }

  if (reportType === "purchases") {
    return {
      headers: ["Fecha", "Sucursal", "Proveedor", "Factura", "Total"],
      rows: items.map((purchase) => [
        purchase.purchased_at ? new Date(purchase.purchased_at).toLocaleString("es-GT") : "Sin fecha",
        purchase.branch_name,
        purchase.supplier_name,
        purchase.invoice_number || "-",
        formatMoney(purchase.total_cost),
      ]),
    };
  }

  return {
    headers: ["Sucursal", "SKU", "Producto", "Categoria", "Stock", "Costo", "Precio venta", "Valor"],
    rows: items.map((item) => [
      item.branch_name,
      item.sku,
      item.name,
      item.category_name || "-",
      Number(item.qty_on_hand || 0).toFixed(2),
      formatMoney(item.unit_cost),
      formatMoney(item.sale_price),
      formatMoney(item.inventory_value),
    ]),
  };
}

export function ReportsPage() {
  const [activeReport, setActiveReport] = useState("sales");
  const [dateFrom, setDateFrom] = useState(monthStartIsoDate);
  const [dateTo, setDateTo] = useState(todayIsoDate);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState([]);
  const [salesReport, setSalesReport] = useState(null);
  const [purchasesReport, setPurchasesReport] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const activeData = useMemo(() => {
    if (activeReport === "sales") {
      return salesReport;
    }
    if (activeReport === "purchases") {
      return purchasesReport;
    }
    return inventoryReport;
  }, [activeReport, inventoryReport, purchasesReport, salesReport]);

  async function loadReports() {
    setIsLoading(true);
    setError(null);

    try {
      const dateParams = { date_from: dateFrom, date_to: dateTo };
      const [branchesResponse, salesResponse, purchasesResponse, inventoryResponse] = await Promise.all([
        listBranches({ is_active: true }),
        getSalesReport(dateParams),
        getPurchasesReport(dateParams),
        getInventoryReport({ branch: branchId }),
      ]);

      setBranches(Array.isArray(branchesResponse) ? branchesResponse : branchesResponse?.results || []);
      setSalesReport(salesResponse);
      setPurchasesReport(purchasesResponse);
      setInventoryReport(inventoryResponse);
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudieron cargar los reportes."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApplyFilters(event) {
    event.preventDefault();
    loadReports();
  }

  function handleGeneratePdf() {
    if (!activeData) {
      return;
    }

    const printable = window.open("about:blank", "_blank");

    if (!printable) {
      setError("No se pudo abrir la pestaña del reporte. Revisa si el navegador bloqueo ventanas emergentes.");
      return;
    }

    const reportTitle = reportLabel(activeReport);
    const selectedBranch = branchId ? branches.find((branch) => branch.id === branchId)?.name : "Todas";
    const detail = buildPrintableRows(activeReport, activeData.items || []);
    const filters =
      activeReport === "inventory"
        ? `Sucursal: ${selectedBranch || "Todas"}`
        : `Desde: ${dateFrom || "Inicio"} · Hasta: ${dateTo || "Hoy"} · Sucursal: ${selectedBranch || "Todas"}`;
    const rowsHtml =
      detail.rows.length > 0
        ? detail.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
            .join("")
        : `<tr><td colspan="${detail.headers.length}">Sin datos para los filtros seleccionados.</td></tr>`;

    printable.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(reportTitle)} ${escapeHtml(dateFrom)} ${escapeHtml(dateTo)}</title>
          <style>
            body {
              font-family: Inter, Arial, sans-serif;
              color: #142033;
              margin: 0;
              padding: 24px;
              background: #f8fafc;
            }
            .print-shell {
              max-width: 1120px;
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
            .print-actions {
              display: flex;
              align-items: start;
              gap: 8px;
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
              font-size: 13px;
            }
            th, td {
              border-bottom: 1px solid #e5edf7;
              padding: 10px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #f1f5f9;
              font-weight: 800;
            }
            td:last-child,
            th:last-child {
              text-align: right;
            }
            .meta {
              display: grid;
              gap: 4px;
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
                font-size: 11px;
              }
              th, td {
                padding: 7px;
              }
            }
          </style>
        </head>
        <body>
          <section class="print-shell">
            <header>
              <div class="meta">
                <h1>${escapeHtml(reportTitle)}</h1>
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
                  <tr>${detail.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </main>
          </section>
        </body>
      </html>
    `);
    printable.document.close();
    printable.focus();
  }

  return (
    <div className="reports-page">
      <section className="reports-toolbar">
        <div>
          <h2>Reportes</h2>
          <p>Ventas, compras e inventario valorizado.</p>
        </div>
        <div className="reports-tabs" role="tablist" aria-label="Tipos de reporte">
          <button
            className={activeReport === "sales" ? "reports-tab reports-tab--active" : "reports-tab"}
            onClick={() => setActiveReport("sales")}
            type="button"
          >
            Ventas
          </button>
          <button
            className={activeReport === "purchases" ? "reports-tab reports-tab--active" : "reports-tab"}
            onClick={() => setActiveReport("purchases")}
            type="button"
          >
            Compras
          </button>
          <button
            className={activeReport === "inventory" ? "reports-tab reports-tab--active" : "reports-tab"}
            onClick={() => setActiveReport("inventory")}
            type="button"
          >
            Inventario
          </button>
        </div>
      </section>

      <form className="reports-filters" onSubmit={handleApplyFilters}>
        <label>
          <span>Desde</span>
          <input
            disabled={activeReport === "inventory"}
            onChange={(event) => setDateFrom(event.target.value)}
            type="date"
            value={dateFrom}
          />
        </label>
        <label>
          <span>Hasta</span>
          <input
            disabled={activeReport === "inventory"}
            onChange={(event) => setDateTo(event.target.value)}
            type="date"
            value={dateTo}
          />
        </label>
        <label>
          <span>Sucursal</span>
          <select onChange={(event) => setBranchId(event.target.value)} value={branchId}>
            <option value="">Todas</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={isLoading} type="submit">
          Aplicar
        </Button>
        <Button disabled={isLoading || !activeData} onClick={handleGeneratePdf} type="button" variant="secondary">
          Generar version PDF
        </Button>
      </form>

      {error ? <div className="reports-alert">{error}</div> : null}

      <section className="reports-summary">
        {activeReport === "sales" ? (
          <>
            <article>
              <span>Ventas</span>
              <strong>{activeData?.summary?.sales_count || 0}</strong>
            </article>
            <article>
              <span>Subtotal</span>
              <strong>{formatMoney(activeData?.summary?.subtotal)}</strong>
            </article>
            <article>
              <span>IVA</span>
              <strong>{formatMoney(activeData?.summary?.tax)}</strong>
            </article>
            <article>
              <span>Total</span>
              <strong>{formatMoney(activeData?.summary?.total)}</strong>
            </article>
          </>
        ) : null}

        {activeReport === "purchases" ? (
          <>
            <article>
              <span>Compras</span>
              <strong>{activeData?.summary?.purchases_count || 0}</strong>
            </article>
            <article>
              <span>Total comprado</span>
              <strong>{formatMoney(activeData?.summary?.total_cost)}</strong>
            </article>
          </>
        ) : null}

        {activeReport === "inventory" ? (
          <>
            <article>
              <span>SKUs</span>
              <strong>{activeData?.summary?.sku_count || 0}</strong>
            </article>
            <article>
              <span>Unidades</span>
              <strong>{Number(activeData?.summary?.total_qty || 0).toFixed(2)}</strong>
            </article>
            <article>
              <span>Valor inventario</span>
              <strong>{formatMoney(activeData?.summary?.inventory_value)}</strong>
            </article>
          </>
        ) : null}
      </section>

      <div className="reports-grid">
        <section className="reports-panel">
          <div className="reports-panel__header">
            <h3>Resumen por sucursal</h3>
            <span>{activeData?.by_branch?.length || 0}</span>
          </div>
          <div className="reports-table">
            {(activeData?.by_branch || []).map((row) => (
              <article className="reports-table-row" key={row.branch}>
                <strong>{row.branch_name}</strong>
                {activeReport === "sales" ? <span>{row.sales_count} ventas</span> : null}
                {activeReport === "purchases" ? <span>{row.purchases_count} compras</span> : null}
                {activeReport === "inventory" ? <span>{row.sku_count} SKUs</span> : null}
                <strong>
                  {formatMoney(row.total || row.total_cost || row.inventory_value)}
                </strong>
              </article>
            ))}
            {!isLoading && (activeData?.by_branch || []).length === 0 ? (
              <div className="reports-empty">Sin datos para estos filtros.</div>
            ) : null}
          </div>
        </section>

        <section className="reports-panel reports-panel--detail">
          <div className="reports-panel__header">
            <h3>Detalle</h3>
            <span>{isLoading ? "Cargando..." : `${activeData?.items?.length || 0} filas`}</span>
          </div>
          <div className="reports-detail">
            {activeReport === "sales"
              ? (activeData?.items || []).map((sale) => (
                  <article className="reports-detail-row reports-detail-row--sales" key={sale.id}>
                    <div>
                      <strong>{sale.branch_name}</strong>
                      <span>{sale.sold_at ? new Date(sale.sold_at).toLocaleString("es-GT") : "Sin fecha"}</span>
                    </div>
                    <span>{sale.payment_method}</span>
                    <strong>{formatMoney(sale.total)}</strong>
                  </article>
                ))
              : null}

            {activeReport === "purchases"
              ? (activeData?.items || []).map((purchase) => (
                  <article className="reports-detail-row reports-detail-row--purchases" key={purchase.id}>
                    <div>
                      <strong>{purchase.supplier_name}</strong>
                      <span>{purchase.invoice_number || purchase.branch_name}</span>
                    </div>
                    <span>{purchase.purchased_at ? new Date(purchase.purchased_at).toLocaleString("es-GT") : "Sin fecha"}</span>
                    <strong>{formatMoney(purchase.total_cost)}</strong>
                  </article>
                ))
              : null}

            {activeReport === "inventory"
              ? (activeData?.items || []).map((item) => (
                  <article className="reports-detail-row reports-detail-row--inventory" key={`${item.branch}-${item.product}`}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.sku} · {item.branch_name}</span>
                    </div>
                    <span>{Number(item.qty_on_hand || 0).toFixed(2)} unidades</span>
                    <span>{formatMoney(item.unit_cost)}</span>
                    <strong>{formatMoney(item.inventory_value)}</strong>
                  </article>
                ))
              : null}

            {!isLoading && (activeData?.items || []).length === 0 ? (
              <div className="reports-empty">Sin detalle para mostrar.</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
