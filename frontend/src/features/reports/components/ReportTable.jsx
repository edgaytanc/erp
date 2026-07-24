import { valueFor } from "../utils/reportUtils";

export function ReportTable({ activeReport, reportData, isLoading }) {
  const items = reportData?.items || [];

  return (
    <section className="reports-panel reports-panel--detail">
      <div className="reports-panel__header">
        <h3>Detalle</h3>
        <span>{isLoading ? "Cargando..." : `${items.length} filas`}</span>
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
            {items.map((row, index) => (
              <tr
                key={
                  row.id ||
                  row.product ||
                  row.category ||
                  row.supplier ||
                  row.branch ||
                  index
                }
              >
                {activeReport.columns.map(([label, key, type]) => (
                  <td key={`${label}-${key}`}>{valueFor(row, key, type)}</td>
                ))}
              </tr>
            ))}
            {!isLoading && activeReport.id === "margin" && items.length > 0 ? (
              <tr style={{ fontWeight: "bold", background: "#f1f5f9" }}>
                <td>Promedio General</td>
                <td>-</td>
                <td>-</td>
                <td>
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
                <td colSpan={activeReport.columns.length}>
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
