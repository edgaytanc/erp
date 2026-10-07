import { useRef, useState } from "react";
import { Button } from "../../../components/common/Button";
import { downloadStockSampleCsv, importStockCsv } from "../api/adminConfigApi";

export function ConfigImport({
  // Sección 1: Catálogo de productos
  csvFile,
  isUploading,
  csvErrors = [],
  csvSuccess,
  fileInputRef,
  handleFileChange,
  handleCsvUpload,
  handleDownloadSample,

  // Sección 2: Stock físico (Inventario) - Props opcionales
  stockCsvFile,
  isStockUploading,
  stockCsvErrors,
  stockCsvSuccess,
  stockFileInputRef,
  handleStockFileChange,
  handleStockCsvUpload,
  handleDownloadStockSample,
}) {
  // Estado local para Stock por si ConfigImport se usa de forma autónoma
  const [localStockFile, setLocalStockFile] = useState(null);
  const [localIsStockUploading, setLocalIsStockUploading] = useState(false);
  const [localStockErrors, setLocalStockErrors] = useState([]);
  const [localStockSuccess, setLocalStockSuccess] = useState(null);
  const [localStockGlobalError, setLocalStockGlobalError] = useState(null);
  const localStockFileInputRef = useRef(null);

  // Resolver props vs estado local
  const currentStockFile =
    stockCsvFile !== undefined ? stockCsvFile : localStockFile;
  const currentIsStockUploading =
    isStockUploading !== undefined ? isStockUploading : localIsStockUploading;
  const currentStockErrors =
    stockCsvErrors !== undefined ? stockCsvErrors : localStockErrors;
  const currentStockSuccess =
    stockCsvSuccess !== undefined ? stockCsvSuccess : localStockSuccess;
  const currentStockFileInputRef =
    stockFileInputRef || localStockFileInputRef;

  const onStockFileChange =
    handleStockFileChange ||
    function (event) {
      setLocalStockSuccess(null);
      setLocalStockErrors([]);
      setLocalStockGlobalError(null);
      if (event.target.files && event.target.files.length > 0) {
        setLocalStockFile(event.target.files[0]);
      } else {
        setLocalStockFile(null);
      }
    };

  const onStockCsvUpload =
    handleStockCsvUpload ||
    async function (event) {
      event.preventDefault();
      if (!currentStockFile) return;

      setLocalIsStockUploading(true);
      setLocalStockGlobalError(null);
      setLocalStockSuccess(null);
      setLocalStockErrors([]);

      try {
        const response = await importStockCsv(currentStockFile);
        const successMsg = `Carga masiva finalizada con éxito. Ajustados: ${response.ajustados ?? 0}, Sin cambios: ${response.sin_cambios ?? 0}.`;
        setLocalStockSuccess(successMsg);
        setLocalStockFile(null);
        if (currentStockFileInputRef.current) {
          currentStockFileInputRef.current.value = "";
        }
      } catch (requestError) {
        if (requestError.response?.data?.detalles) {
          setLocalStockErrors(requestError.response.data.detalles);
          setLocalStockGlobalError(
            requestError.response.data.error ||
              "El archivo contiene errores de validación.",
          );
        } else {
          setLocalStockGlobalError(
            requestError.response?.data?.error ||
              "No se pudo realizar la carga masiva de stock.",
          );
        }
      } finally {
        setLocalIsStockUploading(false);
      }
    };

  const onDownloadStockSample =
    handleDownloadStockSample ||
    async function () {
      setLocalStockGlobalError(null);
      setLocalStockSuccess(null);
      setLocalStockErrors([]);
      try {
        const blob = await downloadStockSampleCsv();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "inventario_fisico_muestra.csv");
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (requestError) {
        setLocalStockGlobalError(
          requestError.response?.data?.error ||
            "No se pudo descargar el archivo de muestra de stock.",
        );
      }
    };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Sección 1: Carga masiva de catálogo de productos */}
      <section className="global-panel">
        <div className="global-panel-header">
          <h3>Carga masiva de catálogo de productos</h3>
          <span>CATÁLOGO CSV</span>
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
              <code>description</code>, <code>cost_price</code>, <code>min_stock</code>,{" "}
              <code>category</code>, <code>barcode</code>, <code>skin_type</code>,{" "}
              <code>target_problems</code>, <code>benefits</code>, <code>is_active</code>
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
            <span>Seleccionar archivo CSV de catálogo</span>
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
              Descargar muestra de productos
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

        {csvErrors && csvErrors.length > 0 && (
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
              Errores en el archivo de catálogo:
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

      {/* Sección 2: Carga masiva de stock físico (Inventario) */}
      <section className="global-panel">
        <div className="global-panel-header">
          <h3>Carga masiva de stock físico (Inventario)</h3>
          <span>STOCK / KÁRDEX CSV</span>
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
            Formato esperado para conteos físicos de stock:
          </p>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <div>
              <strong style={{ color: "#1e293b" }}>Columnas obligatorias:</strong>{" "}
              <code>sku</code>, <code>branch_id</code> (UUID de la sucursal), <code>physical_qty</code> (&ge; 0)
            </div>
            <div>
              <strong style={{ color: "#1e293b" }}>Columnas opcionales:</strong>{" "}
              <code>note</code> (Justificación del ajuste, Ej: &quot;Inventario Inicial 2026&quot;)
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
            Regla de Negocio: Se calcula la diferencia entre la cantidad física y el stock actual. De haber variación, se genera un movimiento de ajuste en el Kárdex de forma atómica y auditable.
          </p>
        </div>

        <form className="admin-form" onSubmit={onStockCsvUpload}>
          <label>
            <span>Seleccionar archivo CSV de stock físico</span>
            <input
              accept=".csv"
              onChange={onStockFileChange}
              ref={currentStockFileInputRef}
              required
              type="file"
            />
          </label>
          <div className="admin-actions-row">
            <Button
              disabled={currentIsStockUploading || !currentStockFile}
              type="submit"
            >
              {currentIsStockUploading ? "Ajustando stock..." : "Importar y ajustar stock"}
            </Button>
            <Button
              onClick={onDownloadStockSample}
              type="button"
              variant="secondary"
            >
              Descargar muestra de stock
            </Button>
          </div>
        </form>

        {currentStockSuccess && (
          <div
            className="global-alert global-alert--success"
            style={{
              margin: "0 1rem 1rem",
              fontSize: "0.85rem",
            }}
          >
            {currentStockSuccess}
          </div>
        )}

        {localStockGlobalError && (
          <div
            className="global-alert global-alert--error"
            style={{
              margin: "0 1rem 1rem",
              fontSize: "0.85rem",
            }}
          >
            {localStockGlobalError}
          </div>
        )}

        {currentStockErrors && currentStockErrors.length > 0 && (
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
              Errores en el archivo de stock:
            </p>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {currentStockErrors.map((err, i) => (
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
    </div>
  );
}
