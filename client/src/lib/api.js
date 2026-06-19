import axios from 'axios';

// Centralized API configuration.
// - In production the frontend and PHP API live on the same Bluehost domain, so
//   VITE_API_BASE_URL is normally left blank and requests use a relative '/api'.
// - In dev the Vite proxy forwards '/api' to the local PHP server.
// - Auth uses a server session cookie (withCredentials) plus a CSRF token sent
//   in the X-CSRF-Token header on state-changing requests.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true, // send/receive the session cookie
});

// --- CSRF token handling -----------------------------------------------------
let csrfToken = null;
export function setCsrfToken(token) {
  csrfToken = token || null;
}
export function getCsrfToken() {
  return csrfToken;
}

const MUTATING = ['post', 'put', 'patch', 'delete'];
api.interceptors.request.use((config) => {
  if (csrfToken && MUTATING.includes((config.method || '').toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Redirect to login on 401 (session expired / not authenticated).
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      setCsrfToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// Small helper: reshape an axios response's `data` while keeping the rest.
const reshape = (promise, fn) => promise.then((r) => ({ ...r, data: fn(r.data) }));

// --- Auth --------------------------------------------------------------------
export const authApi = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }).then((r) => {
      setCsrfToken(r.data.csrfToken);
      return r;
    }),
  logout: () => api.post('/auth/logout').then((r) => {
    setCsrfToken(null);
    return r;
  }),
  me: () =>
    api.get('/auth/me').then((r) => {
      setCsrfToken(r.data.csrfToken);
      return r;
    }),
  forgot: (email) => api.post('/auth/forgot', { email }),
  reset: (token, password) => api.post('/auth/reset', { token, password }),
};

// --- Work Orders -------------------------------------------------------------
// Adapters keep the existing pages' response shapes intact:
//   list -> { data: [...], total }, get/create/update -> the work order object,
//   kanban -> a { status: [...] } map.
export const woApi = {
  list: (params) =>
    reshape(api.get('/work-orders', { params }), (d) => ({
      data: d.workOrders || [],
      total: d.total ?? (d.workOrders ? d.workOrders.length : 0),
    })),
  stats: () => api.get('/work-orders/stats'),
  kanban: () => reshape(api.get('/work-orders/board'), (d) => d.board || {}),
  get: (id) => reshape(api.get(`/work-orders/${id}`), (d) => d.workOrder),
  create: (data) => reshape(api.post('/work-orders', data), (d) => d.workOrder),
  update: (id, data) => reshape(api.put(`/work-orders/${id}`, data), (d) => d.workOrder),
  complete: (id, note) =>
    reshape(api.post(`/work-orders/${id}/complete`, { note }), (d) => d.workOrder),
  addNote: (id, note) =>
    reshape(api.post(`/work-orders/${id}/notes`, { note }), (d) => d.workOrder),
  delete: (id) => api.delete(`/work-orders/${id}`),
  // "Send scheduling link" now creates a self-hosted scheduling link.
  sendScheduling: (id) => api.post('/scheduling-links', { work_order_id: id }),
  uploadAttachment: (id, file, isCompletion = false) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/work-orders/${id}/attachments${isCompletion ? '?completion=1' : ''}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// --- Tenants -----------------------------------------------------------------
export const tenantApi = {
  list: (params) => reshape(api.get('/tenants', { params }), (d) => d.tenants || []),
  get: (id) => reshape(api.get(`/tenants/${id}`), (d) => d.tenant),
  create: (data) => reshape(api.post('/tenants', data), (d) => d.tenant),
  update: (id, data) => reshape(api.put(`/tenants/${id}`, data), (d) => d.tenant),
};

// --- Properties --------------------------------------------------------------
export const propertyApi = {
  list: () => reshape(api.get('/properties'), (d) => d.properties || []),
  get: (id) => reshape(api.get(`/properties/${id}`), (d) => d.property),
  create: (data) => reshape(api.post('/properties', data), (d) => d.property),
  update: (id, data) => reshape(api.put(`/properties/${id}`, data), (d) => d.property),
  addUnit: (id, data) => reshape(api.post(`/properties/${id}/units`, data), (d) => d.property),
};

// --- Scheduling / appointments ----------------------------------------------
export const schedulingApi = {
  createLink: (workOrderId, ttlHours) =>
    api.post('/scheduling-links', { work_order_id: workOrderId, ttl_hours: ttlHours }),
  revokeLink: (id) => api.delete(`/scheduling-links/${id}`),
  // Public (no auth) — used by the tenant scheduling page.
  publicView: (token) => api.get(`/schedule/${token}`),
  publicBook: (token, slotId) => api.post(`/schedule/${token}/book`, { slot_id: slotId }),
};

export const appointmentApi = {
  forDate: (date) => reshape(api.get('/appointments', { params: { date } }), (d) => d.appointments || []),
  availability: () => reshape(api.get('/availability'), (d) => d.slots || []),
  createSlot: (data) => api.post('/availability', data),
};

// --- Analytics ---------------------------------------------------------------
export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),
  byType: () => api.get('/analytics/by-type'),
  byDay: () => api.get('/analytics/by-day'),
  resolutionTime: () => api.get('/analytics/resolution-time'),
  // Not yet implemented server-side; resolve empty so the page still renders.
  trends: () => Promise.resolve({ data: [] }),
  byUnit: () => Promise.resolve({ data: [] }),
};

// --- Integrations (Gmail / Calendly / Routes) --------------------------------
// NOTE: These endpoints are scheduled for a later migration sub-phase. The
// exports exist so the Settings/Route pages compile and degrade gracefully
// (calls 404 and the page shows an error state) rather than crashing the SPA.
export const gmailApi = {
  status: () => api.get('/gmail/status'),
  authUrl: () => api.get('/gmail/auth-url'),
  sync: () => api.post('/gmail/sync'),
  disconnect: () => api.delete('/gmail/disconnect'),
};

export const calendlyApi = {
  status: () => api.get('/calendly/status'),
};

export const routesApi = {
  getForDate: (date) => api.get('/routes', { params: { date } }),
  optimize: (workOrderIds) => api.post('/routes/optimize', { workOrderIds }),
};

// --- Settings / users --------------------------------------------------------
export const settingsApi = {
  get: () => reshape(api.get('/settings'), (d) => d.settings || {}),
  update: (data) => reshape(api.put('/settings', data), (d) => d.settings || {}),
  assignableUsers: () => reshape(api.get('/users/assignable'), (d) => d.users || []),
};
