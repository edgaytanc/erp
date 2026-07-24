import { Button } from "../../../components/common/Button";

export function ConfigGeneral({
  companyForm,
  settingsForm,
  updateCompanyField,
  updateSettingsField,
  handleSaveCompany,
  isSaving,
  isLoading,
  selectedCompany,
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel__header">
        <h3>Empresa y recibos</h3>
        <span>
          {isLoading ? "Cargando..." : selectedCompany ? "Editando" : "Nueva"}
        </span>
      </div>
      <form className="admin-form" onSubmit={handleSaveCompany}>
        <label>
          <span>Nombre</span>
          <input
            onChange={(event) => updateCompanyField("name", event.target.value)}
            required
            type="text"
            value={companyForm.name}
          />
        </label>
        <div className="admin-form-row">
          <label>
            <span>NIT</span>
            <input
              onChange={(event) =>
                updateCompanyField("tax_id", event.target.value)
              }
              type="text"
              value={companyForm.tax_id}
            />
          </label>
          <label>
            <span>Teléfono</span>
            <input
              onChange={(event) =>
                updateCompanyField("phone", event.target.value)
              }
              type="text"
              value={companyForm.phone}
            />
          </label>
        </div>
        <label>
          <span>Dirección</span>
          <textarea
            onChange={(event) =>
              updateCompanyField("address", event.target.value)
            }
            rows="2"
            value={companyForm.address}
          />
        </label>
        <label>
          <span>Logo URL</span>
          <input
            onChange={(event) => updateCompanyField("logo", event.target.value)}
            placeholder="https://..."
            type="text"
            value={companyForm.logo}
          />
        </label>
        <div className="admin-form-row">
          <label>
            <span>Encabezado ticket</span>
            <textarea
              onChange={(event) =>
                updateCompanyField("receipt_header", event.target.value)
              }
              rows="2"
              value={companyForm.receipt_header}
            />
          </label>
          <label>
            <span>Pie ticket</span>
            <textarea
              onChange={(event) =>
                updateCompanyField("receipt_footer", event.target.value)
              }
              rows="2"
              value={companyForm.receipt_footer}
            />
          </label>
        </div>
        <div className="admin-form-row admin-form-row--four">
          <label>
            <span>Moneda</span>
            <input
              maxLength="3"
              onChange={(event) =>
                updateSettingsField(
                  "currency_code",
                  event.target.value.toUpperCase(),
                )
              }
              value={settingsForm.currency_code}
            />
          </label>
          <label>
            <span>Símbolo</span>
            <input
              onChange={(event) =>
                updateSettingsField("currency_symbol", event.target.value)
              }
              value={settingsForm.currency_symbol}
            />
          </label>
          <label>
            <span>IVA</span>
            <input
              min="0"
              onChange={(event) =>
                updateSettingsField("tax_rate", event.target.value)
              }
              step="0.0001"
              type="number"
              value={settingsForm.tax_rate}
            />
          </label>
          <label>
            <span>Anulación min.</span>
            <input
              min="0"
              onChange={(event) =>
                updateSettingsField(
                  "sale_void_window_minutes",
                  event.target.value,
                )
              }
              type="number"
              value={settingsForm.sale_void_window_minutes}
            />
          </label>
        </div>
        <div className="admin-form-row">
          <label>
            <span>Límite de aperturas/cierres de caja por día</span>
            <input
              min="1"
              onChange={(event) =>
                updateSettingsField(
                  "max_cash_sessions_per_day",
                  event.target.value,
                )
              }
              type="number"
              value={settingsForm.max_cash_sessions_per_day}
            />
          </label>
        </div>
        <div className="admin-form-row">
          <label>
            <span>URL del logo (Configuración)</span>
            <input
              className="field__input"
              onChange={(event) =>
                updateSettingsField("logo_url", event.target.value)
              }
              placeholder="https://..."
              type="text"
              value={settingsForm.logo_url}
            />
          </label>
        </div>
        <Button disabled={isSaving} type="submit">
          Guardar empresa
        </Button>
      </form>
    </section>
  );
}
