/**
 * FuelTaxPulse API Client (Updated for Modules 1-11 Functional Specifications)
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api');

export const getAuthToken = () => localStorage.getItem('fueltaxpulse_token');
export const setAuthToken = (token) => localStorage.setItem('fueltaxpulse_token', token);
export const removeAuthToken = () => localStorage.removeItem('fueltaxpulse_token');

export const getStoredUser = () => {
  const u = localStorage.getItem('fueltaxpulse_user');
  try {
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user) => {
  localStorage.setItem('fueltaxpulse_user', JSON.stringify(user));
};

async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...(options.isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let msg = 'Request failed';
    if (typeof errorData.detail === 'string') {
      msg = errorData.detail;
    } else if (Array.isArray(errorData.detail)) {
      msg = errorData.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
    } else if (errorData.message) {
      msg = errorData.message;
    }
    throw new Error(msg);
  }

  return response.json();
}

export async function downloadFile(url, fallbackFilename = 'download') {
  const token = getAuthToken();
  const resp = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || 'Download failed');
  }
  const blob = await resp.blob();
  const disposition = resp.headers.get('Content-Disposition');
  let filename = fallbackFilename;
  if (disposition && disposition.indexOf('filename=') !== -1) {
    const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
    if (matches != null && matches[1]) {
      filename = matches[1].replace(/['"]/g, '');
    }
  }
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export const api = {
  // Auth
  login: async (email, password) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (data) => {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getProfile: async () => {
    return apiRequest('/auth/me');
  },

  // Customer Master Data
  getCustomers: async () => {
    return apiRequest('/customers');
  },

  getCustomerDetail: async (id) => {
    return apiRequest(`/customers/${id}`);
  },

  saveCustomer: async (data) => {
    return apiRequest('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteCustomer: async (id) => {
    return apiRequest(`/customers/${id}`, {
      method: 'DELETE',
    });
  },

  // Fleets (Multi-Fleet Scoping)
  getFleets: async () => {
    return apiRequest('/fleets');
  },

  createFleet: async (fleetData) => {
    return apiRequest('/fleets', {
      method: 'POST',
      body: JSON.stringify(fleetData),
    });
  },

  // Vehicles / Power Units (Module 9)
  getVehicles: async (fleetId = null) => {
    return apiRequest(`/vehicles${fleetId ? `?fleet_id=${fleetId}` : ''}`);
  },

  createVehicle: async (vehicleData, fleetId = null) => {
    return apiRequest(`/vehicles${fleetId ? `?fleet_id=${fleetId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    });
  },

  updateVehicle: async (id, vehicleData) => {
    return apiRequest(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vehicleData),
    });
  },

  deleteVehicle: async (id) => {
    return apiRequest(`/vehicles/${id}`, {
      method: 'DELETE',
    });
  },

  // CSV Ingestion & Mapping Templates (Modules 2, 3, 7)
  getTemplates: async () => {
    return apiRequest('/ingestion/templates');
  },

  saveTemplate: async (data) => {
    return apiRequest('/ingestion/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  stageCsv: async (formData) => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/ingestion/stage-csv`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'CSV staging failed.');
    }
    return res.json();
  },

  commitCsv: async (data) => {
    return apiRequest('/ingestion/commit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Mileage Records & ZIP Distance Utility (Modules 4 & 5)
  getMileageRecords: async (quarter = '2026-Q1', fleetId = null) => {
    return apiRequest(`/mileage/records?quarter=${quarter}${fleetId ? `&fleet_id=${fleetId}` : ''}`);
  },

  quickAddMileage: async (data) => {
    return apiRequest('/mileage/quick-add', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  calculateZipDistance: async (originZip, destinationZip) => {
    return apiRequest('/mileage/calculate-zip-distance', {
      method: 'POST',
      body: JSON.stringify({ origin_zip: originZip, destination_zip: destinationZip }),
    });
  },

  // Fuel Transactions (Modules 3 & 5)
  getFuelPurchases: async (quarter = '2026-Q1', fleetId = null) => {
    return apiRequest(`/fuel-purchases?quarter=${quarter}${fleetId ? `&fleet_id=${fleetId}` : ''}`);
  },

  createFuelPurchase: async (fuelData, fleetId = null) => {
    return apiRequest(`/fuel-purchases${fleetId ? `?fleet_id=${fleetId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(fuelData),
    });
  },

  // Trips & Route Adjacency
  getTrips: async (quarter = '2026-Q1', fleetId = null) => {
    return apiRequest(`/trips?quarter=${quarter}${fleetId ? `&fleet_id=${fleetId}` : ''}`);
  },

  createTrip: async (tripData) => {
    return apiRequest('/trips', {
      method: 'POST',
      body: JSON.stringify(tripData),
    });
  },

  validateRoute: async (jurisdictions) => {
    return apiRequest('/trips/validate-route', {
      method: 'POST',
      body: JSON.stringify({ jurisdictions }),
    });
  },

  // Automated Compliance Audit
  getComplianceAudit: async (quarter = '2026-Q1', fuelType = 'DIESEL', fleetId = null) => {
    return apiRequest(`/compliance/audit?quarter=${quarter}&fuel_type=DIESEL${fleetId ? `&fleet_id=${fleetId}` : ''}`);
  },

  lockQuarter: async (data) => {
    return apiRequest('/quarter/lock', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  unlockQuarter: async (data) => {
    return apiRequest('/quarter/unlock', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Reports & Summary
  getFleetSummary: async (quarter = '2026-Q1', fuelType = 'Diesel', fleetId = null) => {
    return apiRequest(`/reports/fleet-summary?quarter=${quarter}&fuel_type=Diesel${fleetId ? `&fleet_id=${fleetId}` : ''}`);
  },

  // Module 10: Detailed State-Wise Unit Summary
  getUnitStateSummary: async ({ quarter = '2026-Q1', unitNumber = 'ALL', state = 'ALL', startDate = '', endDate = '', fleetId = null }) => {
    const params = new URLSearchParams({
      quarter,
      unit_number: unitNumber || 'ALL',
      state: state || 'ALL',
    });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (fleetId) params.append('fleet_id', fleetId);
    return apiRequest(`/reports/unit-state-summary?${params.toString()}`);
  },

  // Download URLs
  exportPdfUrl: (quarter = '2026-Q1', fuelType = 'Diesel', fleetId = null) => {
    const token = getAuthToken();
    return `${API_BASE_URL}/reports/export-pdf?quarter=${quarter}&fuel_type=Diesel${fleetId ? `&fleet_id=${fleetId}` : ''}${token ? `&token=${token}` : ''}`;
  },

  exportSchedule1CsvUrl: (quarter = '2026-Q1', fuelType = 'Diesel', fleetId = null) => {
    const token = getAuthToken();
    return `${API_BASE_URL}/reports/export-schedule1-csv?quarter=${quarter}&fuel_type=Diesel${fleetId ? `&fleet_id=${fleetId}` : ''}${token ? `&token=${token}` : ''}`;
  },

  exportStateEFileCsvUrl: (quarter = '2026-Q1', fuelType = 'Diesel', fleetId = null) => {
    const token = getAuthToken();
    return `${API_BASE_URL}/reports/export-efile-csv?quarter=${quarter}&fuel_type=Diesel${fleetId ? `&fleet_id=${fleetId}` : ''}${token ? `&token=${token}` : ''}`;
  },

  exportUnitSummaryCsvUrl: (quarter = '2026-Q1', fuelType = 'Diesel', fleetId = null) => {
    const token = getAuthToken();
    return `${API_BASE_URL}/reports/export-unit-summary-csv?quarter=${quarter}&fuel_type=Diesel${fleetId ? `&fleet_id=${fleetId}` : ''}${token ? `&token=${token}` : ''}`;
  },

  exportUnitSummaryPdfUrl: ({ quarter = '2026-Q1', unitNumber = 'ALL', state = 'ALL', startDate = '', endDate = '', fleetId = null }) => {
    const token = getAuthToken();
    const params = new URLSearchParams({
      quarter,
      unit_number: unitNumber || 'ALL',
      state: state || 'ALL',
    });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (fleetId) params.append('fleet_id', fleetId);
    if (token) params.append('token', token);
    return `${API_BASE_URL}/reports/export-unit-summary-pdf?${params.toString()}`;
  },

  exportFuelCsvUrl: (quarter = '2026-Q1', fleetId = null) => {
    const token = getAuthToken();
    return `${API_BASE_URL}/reports/export-fuel-csv?quarter=${quarter}${fleetId ? `&fleet_id=${fleetId}` : ''}${token ? `&token=${token}` : ''}`;
  },

  exportMileageCsvUrl: (quarter = '2026-Q1', fleetId = null) => {
    const token = getAuthToken();
    return `${API_BASE_URL}/reports/export-mileage-csv?quarter=${quarter}${fleetId ? `&fleet_id=${fleetId}` : ''}${token ? `&token=${token}` : ''}`;
  },

  exportAuditZipUrl: (quarter = '2026-Q1', fuelType = 'Diesel', fleetId = null) => {
    const token = getAuthToken();
    return `${API_BASE_URL}/reports/export-audit-zip?quarter=${quarter}&fuel_type=Diesel${fleetId ? `&fleet_id=${fleetId}` : ''}${token ? `&token=${token}` : ''}`;
  },

  downloadFile,

  // Quick Calculator Sandbox
  evaluateQuickCalculator: async (data) => {
    return apiRequest('/calculator/evaluate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Tax Rates Matrix (58 Jurisdictions - Module 11)
  getTaxRates: async (quarter = '2026-Q1') => {
    return apiRequest(`/rates?quarter=${quarter}&fuel_type=Diesel`);
  },

  refreshTaxRates: async (quarter = '2026-Q1', resetDefaults = false) => {
    return apiRequest('/rates/refresh', {
      method: 'POST',
      body: JSON.stringify({ quarter, reset_defaults: resetDefaults }),
    });
  },

  updateTaxRate: async (jurisdiction, data) => {
    return apiRequest(`/rates/${jurisdiction}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  exportRatesCsvUrl: (quarter = '2026-Q1') => {
    const token = getAuthToken();
    return `${API_BASE_URL}/rates/export-csv?quarter=${quarter}${token ? `&token=${token}` : ''}`;
  },

  uploadRatesMatrixFile: async (formData) => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/rates/upload-file`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Rate matrix upload failed.');
    }
    return res.json();
  },

  syncExternalRatesApi: async (data) => {
    return apiRequest('/rates/sync-external', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
