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
    <section className="admin-panel">
      <div className="admin-panel__header">
        <h3>Carga masiva de productos</h3>
        <span>CSV</span>
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
          className="admin-alert admin-alert--success"
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
          className="admin-alert admin-alert--error"
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
