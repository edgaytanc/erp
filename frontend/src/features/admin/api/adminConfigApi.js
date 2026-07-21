import api from "../../../lib/axios";

export async function listCompanies(params = {}) {
  const response = await api.get("/config/companies/", { params });
  return response.data;
}

export async function createCompany(payload) {
  const response = await api.post("/config/companies/", payload);
  return response.data;
}

export async function updateCompany(companyId, payload) {
  const response = await api.patch(`/config/companies/${companyId}/`, payload);
  return response.data;
}

export async function listBranches(params = {}) {
  const response = await api.get("/config/branches/", { params });
  return response.data;
}

export async function createBranch(payload) {
  const response = await api.post("/config/branches/", payload);
  return response.data;
}

export async function updateBranch(branchId, payload) {
  const response = await api.patch(`/config/branches/${branchId}/`, payload);
  return response.data;
}

export async function listCompanySettings(params = {}) {
  const response = await api.get("/config/company-settings/", { params });
  return response.data;
}

export async function createCompanySettings(payload) {
  const response = await api.post("/config/company-settings/", payload);
  return response.data;
}

export async function updateCompanySettings(settingsId, payload) {
  const response = await api.patch(`/config/company-settings/${settingsId}/`, payload);
  return response.data;
}

export async function listUsers() {
  const response = await api.get("/auth/users/");
  return response.data;
}

export async function createUser(payload) {
  const response = await api.post("/auth/users/", payload);
  return response.data;
}

export async function updateUser(userId, payload) {
  const response = await api.patch(`/auth/users/${userId}/`, payload);
  return response.data;
}

export function unwrapResults(data) {
  return Array.isArray(data) ? data : data?.results || [];
}

export async function importProductsCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/inventory/products/import-csv/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

export async function downloadProductsSampleCsv() {
  const response = await api.get("/inventory/products/sample-csv/", {
    responseType: "blob",
  });
  return response.data;
}
