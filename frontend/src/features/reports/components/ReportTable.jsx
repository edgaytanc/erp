import { valueFor } from "../utils/reportUtils";

export function ReportTable({ activeReport, columns, reportData, isLoading }) {
  const effectiveColumns = columns || activeReport.columns;
  const items = reportData?.items || [];

  return (
    <section className="global-panel">
      <div className="global-panel-header">
        <h3>Detalle</h3>
        <span>{isLoading ? "Cargando..." : `${items.length} filas`}</span>
      </div>
      <div className="reports-table-wrap">
        <table className="reports-data-table">
          <thead>
            <tr>
              {effectiveColumns.map(([label]) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row, index) => (
              <tr
                key={
                  row.id ||
                  (row.product && row.branch
                    ? `${row.product}-${row.branch}`
                    : null) ||
                  row.product ||
                  row.category ||
                  row.supplier ||
                  row.branch ||
                  index
                }
              >
                {effectiveColumns.map(([label, key, type]) => (
                  <td key={`${label}-${key}`} data-label={label}>
                    {valueFor(row, key, type)}
                  </td>
                ))}
              </tr>
            ))}
            {!isLoading && activeReport.id === "margin" && items.length > 0 ? (
              <tr style={{ fontWeight: "bold", background: "#f1f5f9" }}>
                <td data-label={effectiveColumns[0]?.[0] || "Sucursal"}>
                  Promedio General
                </td>
                {effectiveColumns.slice(1, -1).map(([label, key]) => (
                  <td key={`footer-${key}`} data-label={label}>
                    -
                  </td>
                ))}
                <td
                  data-label={
                    effectiveColumns[effectiveColumns.length - 1]?.[0] ||
                    "Margen"
                  }
                >
                  {valueFor(
                    reportData?.summary,
                    "average_margin",
                    "percentage",
                  )}
                </td>
              </tr>
            ) : null}
            {!isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={effectiveColumns.length}>
                  <div className="reports-empty">
                    Sin datos para estos filtros.
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
