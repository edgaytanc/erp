import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../components/common/Button";
import { extractApiErrorMessage } from "../../../lib/apiError";
import {
  createBranch,
  createCompany,
  createCompanySettings,
  createUser,
  listBranches,
  listCompanies,
  listCompanySettings,
  listUsers,
  unwrapResults,
  updateBranch,
  updateCompany,
  updateCompanySettings,
  updateUser,
  importProductsCsv,
  downloadProductsSampleCsv,
} from "../api/adminConfigApi";
import "../../../styles/admin-config.css";

const emptyCompanyForm = {
  name: "",
  tax_id: "",
  address: "",
  phone: "",
  logo: "",
  receipt_header: "",
  receipt_footer: "",
};

const emptySettingsForm = {
  currency_code: "GTQ",
  currency_symbol: "Q",
  tax_rate: "0.1200",
  money_rounding: "0.0100",
  sale_void_window_minutes: 10,
  max_cash_sessions_per_day: 1,
  is_active: true,
};

const emptyBranchForm = {
  name: "",
  address: "",
  is_active: true,
};

const emptyUserForm = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  role: "sales",
  branch: "",
  password: "",
  is_active: true,
};

const ROLE_LABELS = {
  admin: "Administrador",
  purchases: "Encargado de compras",
  sales: "Vendedor",
};

function toCompanyForm(company) {
  return company
    ? {
        name: company.name || "",
        tax_id: company.tax_id || "",
        address: company.address || "",
        phone: company.phone || "",
        logo: company.logo || "",
        receipt_header: company.receipt_header || "",
        receipt_footer: company.receipt_footer || "",
      }
    : emptyCompanyForm;
}

function toSettingsForm(settings) {
  return settings
    ? {
        currency_code: settings.currency_code || "GTQ",
        currency_symbol: settings.currency_symbol || "Q",
        tax_rate: settings.tax_rate || "0.1200",
        money_rounding: settings.money_rounding || "0.0100",
        sale_void_window_minutes: settings.sale_void_window_minutes ?? 10,
        max_cash_sessions_per_day: settings.max_cash_sessions_per_day ?? 1,
        is_active: Boolean(settings.is_active),
      }
    : emptySettingsForm;
}

export function AdminConfigPage() {
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [settingsList, setSettingsList] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [editingBranchId, setEditingBranchId] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [settingsForm, setSettingsForm] = useState(emptySettingsForm);
  const [branchForm, setBranchForm] = useState(emptyBranchForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvSuccess, setCsvSuccess] = useState(null);
  const fileInputRef = useRef(null);

  function handleFileChange(event) {
    setCsvSuccess(null);
    setCsvErrors([]);
    setError(null);
    setSuccess(null);
    if (event.target.files && event.target.files.length > 0) {
      setCsvFile(event.target.files[0]);
    } else {
      setCsvFile(null);
    }
  }

  async function handleCsvUpload(event) {
    event.preventDefault();
    if (!csvFile) return;

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setCsvSuccess(null);
    setCsvErrors([]);

    try {
      const response = await importProductsCsv(csvFile);
      const successMsg = `Carga masiva finalizada con éxito. Creados: ${response.creados}, Actualizados: ${response.actualizados}.`;
      setSuccess(successMsg);
      setCsvSuccess(successMsg);
      setCsvFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (requestError) {
      if (requestError.response?.data?.detalles) {
        setCsvErrors(requestError.response.data.detalles);
        setError(requestError.response.data.error || "El archivo contiene errores de validación.");
      } else {
        setError(extractApiErrorMessage(requestError, "No se pudo realizar la carga masiva."));
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownloadSample() {
    setError(null);
    setSuccess(null);
    setCsvErrors([]);
    try {
      const blob = await downloadProductsSampleCsv();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "productos_muestra.csv");
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo descargar el archivo de muestra."));
    }
  }

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );
  const selectedSettings = useMemo(
    () => settingsList.find((settings) => settings.company === selectedCompanyId) || null,
    [settingsList, selectedCompanyId],
  );
  const filteredBranches = useMemo(
    () => branches.filter((branch) => !selectedCompanyId || branch.company === selectedCompanyId),
    [branches, selectedCompanyId],
  );

  async function loadConfig() {
    setIsLoading(true);
    setError(null);

    try {
      const [companiesResponse, branchesResponse, settingsResponse, usersResponse] = await Promise.all([
        listCompanies(),
        listBranches(),
        listCompanySettings(),
        listUsers(),
      ]);
      const nextCompanies = unwrapResults(companiesResponse);
      const nextSettings = unwrapResults(settingsResponse);

      setCompanies(nextCompanies);
      setBranches(unwrapResults(branchesResponse));
      setSettingsList(nextSettings);
      setUsers(unwrapResults(usersResponse));

      const nextSelectedCompanyId = selectedCompanyId || nextCompanies[0]?.id || "";
      setSelectedCompanyId(nextSelectedCompanyId);
      setCompanyForm(toCompanyForm(nextCompanies.find((company) => company.id === nextSelectedCompanyId)));
      setSettingsForm(toSettingsForm(nextSettings.find((settings) => settings.company === nextSelectedCompanyId)));
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo cargar configuracion."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectCompany(companyId) {
    const company = companies.find((candidate) => candidate.id === companyId);
    const settings = settingsList.find((candidate) => candidate.company === companyId);

    setSelectedCompanyId(companyId);
    setCompanyForm(toCompanyForm(company));
    setSettingsForm(toSettingsForm(settings));
    setEditingBranchId("");
    setBranchForm(emptyBranchForm);
  }

  function updateCompanyField(field, value) {
    setCompanyForm((current) => ({ ...current, [field]: value }));
  }

  function updateSettingsField(field, value) {
    setSettingsForm((current) => ({ ...current, [field]: value }));
  }

  function updateBranchField(field, value) {
    setBranchForm((current) => ({ ...current, [field]: value }));
  }

  function updateUserField(field, value) {
    setUserForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveCompany(event) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const company = selectedCompany
        ? await updateCompany(selectedCompany.id, companyForm)
        : await createCompany(companyForm);
      const settingsPayload = {
        ...settingsForm,
        company: company.id,
        sale_void_window_minutes: Number(settingsForm.sale_void_window_minutes || 0),
        max_cash_sessions_per_day: Number(settingsForm.max_cash_sessions_per_day || 1),
      };

      if (selectedSettings) {
        await updateCompanySettings(selectedSettings.id, settingsPayload);
      } else {
        await createCompanySettings(settingsPayload);
      }

      setSelectedCompanyId(company.id);
      setSuccess("Datos de empresa guardados.");
      await loadConfig();
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo guardar empresa."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveBranch(event) {
    event.preventDefault();

    if (!selectedCompanyId) {
      setError("Primero crea o selecciona una empresa.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = { ...branchForm, company: selectedCompanyId };

      if (editingBranchId) {
        await updateBranch(editingBranchId, payload);
      } else {
        await createBranch(payload);
      }

      setBranchForm(emptyBranchForm);
      setEditingBranchId("");
      setSuccess("Sucursal guardada.");
      await loadConfig();
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo guardar sucursal."));
    } finally {
      setIsSaving(false);
    }
  }

  function editBranch(branch) {
    setEditingBranchId(branch.id);
    setBranchForm({
      name: branch.name || "",
      address: branch.address || "",
      is_active: Boolean(branch.is_active),
    });
  }

  async function toggleBranch(branch) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateBranch(branch.id, { is_active: !branch.is_active });
      setSuccess(branch.is_active ? "Sucursal dada de baja." : "Sucursal activada.");
      await loadConfig();
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo actualizar sucursal."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveUser(event) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...userForm,
        branch: userForm.branch || null,
      };

      if (!payload.password) {
        delete payload.password;
      }

      if (editingUserId) {
        await updateUser(editingUserId, payload);
      } else {
        await createUser(payload);
      }

      setUserForm(emptyUserForm);
      setEditingUserId("");
      setSuccess("Usuario guardado.");
      await loadConfig();
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo guardar usuario."));
    } finally {
      setIsSaving(false);
    }
  }

  function editUser(user) {
    setEditingUserId(user.id);
    setUserForm({
      username: user.username || "",
      email: user.email || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: user.role || "sales",
      branch: user.branch || "",
      password: "",
      is_active: Boolean(user.is_active),
    });
  }

  async function toggleUser(user) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateUser(user.id, { is_active: !user.is_active });
      setSuccess(user.is_active ? "Usuario desactivado." : "Usuario activado.");
      await loadConfig();
    } catch (requestError) {
      setError(extractApiErrorMessage(requestError, "No se pudo actualizar usuario."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-config-page">
      <section className="admin-config-toolbar">
        <div>
          <h2>Configuracion</h2>
          <p>Empresa, sucursales, usuarios y roles del ERP.</p>
        </div>
        <label className="admin-company-select" htmlFor="admin-company">
          <span>Empresa activa</span>
          <select
            disabled={companies.length === 0}
            id="admin-company"
            onChange={(event) => selectCompany(event.target.value)}
            value={selectedCompanyId}
          >
            {companies.length === 0 ? <option value="">Sin empresas</option> : null}
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? <div className="admin-alert admin-alert--error">{error}</div> : null}
      {success ? <div className="admin-alert admin-alert--success">{success}</div> : null}

      <div className="admin-config-grid">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <h3>Empresa y recibos</h3>
            <span>{isLoading ? "Cargando..." : selectedCompany ? "Editando" : "Nueva"}</span>
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
                  onChange={(event) => updateCompanyField("tax_id", event.target.value)}
                  type="text"
                  value={companyForm.tax_id}
                />
              </label>
              <label>
                <span>Telefono</span>
                <input
                  onChange={(event) => updateCompanyField("phone", event.target.value)}
                  type="text"
                  value={companyForm.phone}
                />
              </label>
            </div>
            <label>
              <span>Direccion</span>
              <textarea
                onChange={(event) => updateCompanyField("address", event.target.value)}
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
                  onChange={(event) => updateCompanyField("receipt_header", event.target.value)}
                  rows="2"
                  value={companyForm.receipt_header}
                />
              </label>
              <label>
                <span>Pie ticket</span>
                <textarea
                  onChange={(event) => updateCompanyField("receipt_footer", event.target.value)}
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
                  onChange={(event) => updateSettingsField("currency_code", event.target.value.toUpperCase())}
                  value={settingsForm.currency_code}
                />
              </label>
              <label>
                <span>Simbolo</span>
                <input
                  onChange={(event) => updateSettingsField("currency_symbol", event.target.value)}
                  value={settingsForm.currency_symbol}
                />
              </label>
              <label>
                <span>IVA</span>
                <input
                  min="0"
                  onChange={(event) => updateSettingsField("tax_rate", event.target.value)}
                  step="0.0001"
                  type="number"
                  value={settingsForm.tax_rate}
                />
              </label>
              <label>
                <span>Anulacion min.</span>
                <input
                  min="0"
                  onChange={(event) => updateSettingsField("sale_void_window_minutes", event.target.value)}
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
                  onChange={(event) => updateSettingsField("max_cash_sessions_per_day", event.target.value)}
                  type="number"
                  value={settingsForm.max_cash_sessions_per_day}
                />
              </label>
            </div>
            <Button disabled={isSaving} type="submit">
              Guardar empresa
            </Button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <h3>Sucursales</h3>
            <span>{filteredBranches.length}</span>
          </div>
          <form className="admin-form" onSubmit={handleSaveBranch}>
            <label>
              <span>Nombre</span>
              <input
                onChange={(event) => updateBranchField("name", event.target.value)}
                required
                type="text"
                value={branchForm.name}
              />
            </label>
            <label>
              <span>Direccion</span>
              <textarea
                onChange={(event) => updateBranchField("address", event.target.value)}
                rows="2"
                value={branchForm.address}
              />
            </label>
            <label className="admin-check">
              <input
                checked={branchForm.is_active}
                onChange={(event) => updateBranchField("is_active", event.target.checked)}
                type="checkbox"
              />
              <span>Sucursal activa</span>
            </label>
            <div className="admin-actions-row">
              <Button disabled={isSaving} type="submit">
                {editingBranchId ? "Actualizar" : "Crear"} sucursal
              </Button>
              <Button
                onClick={() => {
                  setEditingBranchId("");
                  setBranchForm(emptyBranchForm);
                }}
                type="button"
                variant="secondary"
              >
                Limpiar
              </Button>
            </div>
          </form>
          <div className="admin-list">
            {filteredBranches.map((branch) => (
              <article className="admin-list-row" key={branch.id}>
                <div>
                  <strong>{branch.name}</strong>
                  <span>{branch.address || "Sin direccion"}</span>
                </div>
                <span className={`admin-badge ${branch.is_active ? "admin-badge--on" : ""}`}>
                  {branch.is_active ? "Activa" : "Inactiva"}
                </span>
                <button onClick={() => editBranch(branch)} type="button">
                  Editar
                </button>
                <button onClick={() => toggleBranch(branch)} type="button">
                  {branch.is_active ? "Baja" : "Alta"}
                </button>
              </article>
            ))}
          </div>
        </section>

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
                    <strong>Línea {err.linea} (SKU: {err.sku}):</strong>{" "}
                    {err.errores.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="admin-panel admin-panel--users">
          <div className="admin-panel__header">
            <h3>Usuarios y roles</h3>
            <span>{users.length}</span>
          </div>
          <form className="admin-form" onSubmit={handleSaveUser}>
            <div className="admin-form-row admin-form-row--three">
              <label>
                <span>Usuario</span>
                <input
                  disabled={Boolean(editingUserId)}
                  onChange={(event) => updateUserField("username", event.target.value)}
                  required
                  type="text"
                  value={userForm.username}
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  onChange={(event) => updateUserField("email", event.target.value)}
                  type="email"
                  value={userForm.email}
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  onChange={(event) => updateUserField("password", event.target.value)}
                  placeholder={editingUserId ? "Opcional" : ""}
                  required={!editingUserId}
                  type="password"
                  value={userForm.password}
                />
              </label>
            </div>
            <div className="admin-form-row admin-form-row--four">
              <label>
                <span>Nombres</span>
                <input
                  onChange={(event) => updateUserField("first_name", event.target.value)}
                  type="text"
                  value={userForm.first_name}
                />
              </label>
              <label>
                <span>Apellidos</span>
                <input
                  onChange={(event) => updateUserField("last_name", event.target.value)}
                  type="text"
                  value={userForm.last_name}
                />
              </label>
              <label>
                <span>Rol</span>
                <select onChange={(event) => updateUserField("role", event.target.value)} value={userForm.role}>
                  <option value="admin">Administrador</option>
                  <option value="sales">Vendedor</option>
                  <option value="purchases">Encargado de compras</option>
                </select>
              </label>
              <label>
                <span>Sucursal</span>
                <select onChange={(event) => updateUserField("branch", event.target.value)} value={userForm.branch}>
                  <option value="">Sin sucursal</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="admin-check">
              <input
                checked={userForm.is_active}
                onChange={(event) => updateUserField("is_active", event.target.checked)}
                type="checkbox"
              />
              <span>Usuario activo</span>
            </label>
            <div className="admin-actions-row">
              <Button disabled={isSaving} type="submit">
                {editingUserId ? "Actualizar" : "Crear"} usuario
              </Button>
              <Button
                onClick={() => {
                  setEditingUserId("");
                  setUserForm(emptyUserForm);
                }}
                type="button"
                variant="secondary"
              >
                Limpiar
              </Button>
            </div>
          </form>
          <div className="admin-user-list">
            {users.map((user) => (
              <article className="admin-user-row" key={user.id}>
                <div>
                  <strong>{user.username}</strong>
                  <span>{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Sin nombre"}</span>
                </div>
                <span>{ROLE_LABELS[user.role] || user.role}</span>
                <span>{user.branch_name || "Sin sucursal"}</span>
                <span className={`admin-badge ${user.is_active ? "admin-badge--on" : ""}`}>
                  {user.is_active ? "Activo" : "Inactivo"}
                </span>
                <button onClick={() => editUser(user)} type="button">
                  Editar
                </button>
                <button onClick={() => toggleUser(user)} type="button">
                  {user.is_active ? "Desactivar" : "Activar"}
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
