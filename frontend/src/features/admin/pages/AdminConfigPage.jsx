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
import { ConfigGeneral } from "../components/ConfigGeneral";
import { ConfigBranches } from "../components/ConfigBranches";
import { ConfigUsers } from "../components/ConfigUsers";
import { ConfigImport } from "../components/ConfigImport";
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

  const [activeTab, setActiveTab] = useState("general");

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
        setError(
          requestError.response.data.error ||
            "El archivo contiene errores de validación.",
        );
      } else {
        setError(
          extractApiErrorMessage(
            requestError,
            "No se pudo realizar la carga masiva.",
          ),
        );
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
      setError(
        extractApiErrorMessage(
          requestError,
          "No se pudo descargar el archivo de muestra.",
        ),
      );
    }
  }

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );
  const selectedSettings = useMemo(
    () =>
      settingsList.find((settings) => settings.company === selectedCompanyId) ||
      null,
    [settingsList, selectedCompanyId],
  );
  const filteredBranches = useMemo(
    () =>
      branches.filter(
        (branch) => !selectedCompanyId || branch.company === selectedCompanyId,
      ),
    [branches, selectedCompanyId],
  );

  async function loadConfig() {
    setIsLoading(true);
    setError(null);

    try {
      const [
        companiesResponse,
        branchesResponse,
        settingsResponse,
        usersResponse,
      ] = await Promise.all([
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

      const nextSelectedCompanyId =
        selectedCompanyId || nextCompanies[0]?.id || "";
      setSelectedCompanyId(nextSelectedCompanyId);
      setCompanyForm(
        toCompanyForm(
          nextCompanies.find((company) => company.id === nextSelectedCompanyId),
        ),
      );
      setSettingsForm(
        toSettingsForm(
          nextSettings.find(
            (settings) => settings.company === nextSelectedCompanyId,
          ),
        ),
      );
    } catch (requestError) {
      setError(
        extractApiErrorMessage(
          requestError,
          "No se pudo cargar configuracion.",
        ),
      );
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
    const settings = settingsList.find(
      (candidate) => candidate.company === companyId,
    );

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
        sale_void_window_minutes: Number(
          settingsForm.sale_void_window_minutes || 0,
        ),
        max_cash_sessions_per_day: Number(
          settingsForm.max_cash_sessions_per_day || 1,
        ),
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
      setError(
        extractApiErrorMessage(requestError, "No se pudo guardar empresa."),
      );
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
      setError(
        extractApiErrorMessage(requestError, "No se pudo guardar sucursal."),
      );
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
      setSuccess(
        branch.is_active ? "Sucursal dada de baja." : "Sucursal activada.",
      );
      await loadConfig();
    } catch (requestError) {
      setError(
        extractApiErrorMessage(requestError, "No se pudo actualizar sucursal."),
      );
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
      setError(
        extractApiErrorMessage(requestError, "No se pudo guardar usuario."),
      );
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
      setError(
        extractApiErrorMessage(requestError, "No se pudo actualizar usuario."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-config-page">
      <section className="admin-config-toolbar">
        <div>
          <h2>Configuración</h2>
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
            {companies.length === 0 ? (
              <option value="">Sin empresas</option>
            ) : null}
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? (
        <div className="admin-alert admin-alert--error">{error}</div>
      ) : null}
      {success ? (
        <div className="admin-alert admin-alert--success">{success}</div>
      ) : null}

      <nav className="admin-tabs-nav" aria-label="Secciones de configuración">
        <button
          className={`admin-tab-btn ${activeTab === "general" ? "admin-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("general")}
          type="button"
        >
          <svg
            className="admin-tab-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          General
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "branches" ? "admin-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("branches")}
          type="button"
        >
          <svg
            className="admin-tab-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Sucursales
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "users" ? "admin-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("users")}
          type="button"
        >
          <svg
            className="admin-tab-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Usuarios
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "import" ? "admin-tab-btn--active" : ""}`}
          onClick={() => setActiveTab("import")}
          type="button"
        >
          <svg
            className="admin-tab-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Importar
        </button>
      </nav>

      <div className="admin-tabs-content">
        {activeTab === "general" && (
          <ConfigGeneral
            companyForm={companyForm}
            settingsForm={settingsForm}
            updateCompanyField={updateCompanyField}
            updateSettingsField={updateSettingsField}
            handleSaveCompany={handleSaveCompany}
            isSaving={isSaving}
            isLoading={isLoading}
            selectedCompany={selectedCompany}
          />
        )}

        {activeTab === "branches" && (
          <ConfigBranches
            branchForm={branchForm}
            updateBranchField={updateBranchField}
            handleSaveBranch={handleSaveBranch}
            isSaving={isSaving}
            editingBranchId={editingBranchId}
            setEditingBranchId={setEditingBranchId}
            setBranchForm={setBranchForm}
            emptyBranchForm={emptyBranchForm}
            filteredBranches={filteredBranches}
            editBranch={editBranch}
            toggleBranch={toggleBranch}
          />
        )}

        {activeTab === "users" && (
          <ConfigUsers
            userForm={userForm}
            updateUserField={updateUserField}
            handleSaveUser={handleSaveUser}
            isSaving={isSaving}
            editingUserId={editingUserId}
            setEditingUserId={setEditingUserId}
            setUserForm={setUserForm}
            emptyUserForm={emptyUserForm}
            users={users}
            branches={branches}
            editUser={editUser}
            toggleUser={toggleUser}
            ROLE_LABELS={ROLE_LABELS}
          />
        )}

        {activeTab === "import" && (
          <ConfigImport
            csvFile={csvFile}
            isUploading={isUploading}
            csvErrors={csvErrors}
            csvSuccess={csvSuccess}
            fileInputRef={fileInputRef}
            handleFileChange={handleFileChange}
            handleCsvUpload={handleCsvUpload}
            handleDownloadSample={handleDownloadSample}
          />
        )}
      </div>
    </div>
  );
}
