import axios from 'axios';

// In production the frontend (Bluehost) and API (Railway) live on different
// origins, so the build injects VITE_API_BASE_URL. In dev the var is unset and
// requests fall through to the Vite proxy via a relative '/api' path.
// Tolerate a base provided with or without a trailing slash or '/api' suffix.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

const api = axios.create({ baseURL: `${API_BASE}/api` });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dispatch_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dispatch_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
};

// Work Orders
export const woApi = {
  list: (params) => api.get('/workorders', { params }),
  stats: () => api.get('/workorders/stats'),
  kanban: () => api.get('/workorders/kanban'),
  get: (id) => api.get(`/workorders/${id}`),
  create: (data) => api.post('/workorders', data),
  update: (id, data) => api.put(`/workorders/${id}`, data),
  delete: (id) => api.delete(`/workorders/${id}`),
  sendScheduling: (id) => api.post(`/workorders/${id}/send-scheduling`),
};

// Gmail
export const gmailApi = {
  status: () => api.get('/gmail/status'),
  authUrl: () => api.get('/gmail/auth-url'),
  sync: () => api.post('/gmail/sync'),
  disconnect: () => api.delete('/gmail/disconnect'),
};

// Analytics
export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),
  trends: (params) => api.get('/analytics/trends', { params }),
  byType: () => api.get('/analytics/by-type'),
  resolutionTime: () => api.get('/analytics/resolution-time'),
  byDay: () => api.get('/analytics/by-day'),
  byUnit: () => api.get('/analytics/by-unit'),
};

// Routes
export const routesApi = {
  getForDate: (date) => api.get('/routes', { params: { date } }),
  optimize: (workOrderIds) => api.post('/routes/optimize', { workOrderIds }),
};

// Settings
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// Calendly
export const calendlyApi = {
  status: () => api.get('/calendly/status'),
};
