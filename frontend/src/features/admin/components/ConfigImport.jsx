import { Button } from "../../../components/common/Button";

export function ConfigImport({
  csvFile,
  isUploading,
  csvErrors,
  csvSuccess,
  fileInputRef,
  handleFileChange,
  handleCsvUpload,
  handleDownloadSample,
}) {
  return (
    <section className="global-panel">
      <div className="global-panel-header">
        <h3>Carga masiva de productos</h3>
        <span>CSV</span>
      </div>

      <div
        className="admin-import-help"
        style={{
          margin: "1rem 1rem 0.25rem",
          padding: "1rem",
          backgroundColor: "#f8fafc",
          borderRadius: "0.5rem",
          border: "1px solid #e2e8f0",
          fontSize: "0.85rem",
          lineHeight: "1.5",
          color: "#334155",
        }}
      >
        <p
          style={{
            margin: "0 0 0.5rem 0",
            fontWeight: "700",
            color: "#0f172a",
          }}
        >
          Formato esperado y columnas soportadas:
        </p>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <div>
            <strong style={{ color: "#1e293b" }}>Columnas obligatorias:</strong>{" "}
            <code>sku</code>, <code>name</code>, <code>sale_price</code>
          </div>
          <div>
            <strong style={{ color: "#1e293b" }}>Columnas opcionales:</strong>{" "}
            <code>description</code>, <code>cost_price</code>, <code>min_stock</code>, <code>category</code>, <code>barcode</code>, <code>skin_type</code>, <code>target_problems</code>, <code>benefits</code>, <code>is_active</code>
          </div>
        </div>
        <p
          style={{
            margin: "0.75rem 0 0 0",
            paddingTop: "0.5rem",
            borderTop: "1px dashed #cbd5e1",
            color: "#64748b",
            fontSize: "0.825rem",
            fontStyle: "italic",
          }}
        >
          Campos opcionales. Para problemas y beneficios, separa múltiples valores por comas (Ej: LIMPIEZA, AROMA).
        </p>
      </div>

      <form className="admin-form" onSubmit={handleCsvUpload}>
        <label>
          <span>Seleccionar archivo CSV</span>
          <input
            accept=".csv"
            onChange={handleFileChange}
            ref={fileInputRef}
            required
            type="file"
          />
        </label>
        <div className="admin-actions-row">
          <Button disabled={isUploading || !csvFile} type="submit">
            {isUploading ? "Cargando..." : "Importar productos"}
          </Button>
          <Button
            onClick={handleDownloadSample}
            type="button"
            variant="secondary"
          >
            Descargar muestra
          </Button>
        </div>
      </form>

      {csvSuccess && (
        <div
          className="global-alert global-alert--success"
          style={{
            margin: "0 1rem 1rem",
            fontSize: "0.85rem",
          }}
        >
          {csvSuccess}
        </div>
      )}

      {csvErrors.length > 0 && (
        <div
          className="global-alert global-alert--error"
          style={{
            margin: "0 1rem 1rem",
            maxHeight: "250px",
            overflowY: "auto",
            fontSize: "0.85rem",
          }}
        >
          <p style={{ margin: "0 0 0.5rem 0", fontWeight: "bold" }}>
            Errores en el archivo:
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {csvErrors.map((err, i) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>
                <strong>
                  Línea {err.linea} (SKU: {err.sku}):
                </strong>{" "}
                {err.errores.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
