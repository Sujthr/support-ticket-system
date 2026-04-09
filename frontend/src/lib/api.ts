import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        }
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;

// ── Auth ──
export const authApi = {
  signup: (data: any) => api.post('/auth/signup', data),
  login: (data: any) => api.post('/auth/login', data),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  invite: (data: any) => api.post('/auth/invite', data),
};

// ── Tickets ──
export const ticketsApi = {
  list: (params?: any) => api.get('/tickets', { params }),
  myTickets: (params?: any) => api.get('/tickets/my', { params }),
  get: (id: string) => api.get(`/tickets/${id}`),
  create: (data: any) => api.post('/tickets', data),
  update: (id: string, data: any) => api.patch(`/tickets/${id}`, data),
  bulkUpdate: (data: any) => api.patch('/tickets/bulk/update', data),
};

// ── Comments ──
export const commentsApi = {
  create: (ticketId: string, data: any) => api.post(`/tickets/${ticketId}/comments`, data),
  update: (ticketId: string, commentId: string, data: any) =>
    api.patch(`/tickets/${ticketId}/comments/${commentId}`, data),
  delete: (ticketId: string, commentId: string) =>
    api.delete(`/tickets/${ticketId}/comments/${commentId}`),
};

// ── Users ──
export const usersApi = {
  list: (params?: any) => api.get('/users', { params }),
  me: () => api.get('/users/me'),
  agents: () => api.get('/users/agents'),
  updateProfile: (data: any) => api.patch('/users/me', data),
};

// ── Organization ──
export const orgApi = {
  getCurrent: () => api.get('/organizations/current'),
  update: (data: any) => api.patch('/organizations/current', data),
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/organizations/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getTags: () => api.get('/organizations/tags'),
};

// ── Categories ──
export const categoriesApi = {
  list: () => api.get('/categories'),
  create: (data: any) => api.post('/categories', data),
  update: (id: string, data: any) => api.patch(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
  reorder: (ids: string[]) => api.patch('/categories/reorder', { ids }),
};

// ── Priorities ──
export const prioritiesApi = {
  list: () => api.get('/priorities'),
  create: (data: any) => api.post('/priorities', data),
  update: (id: string, data: any) => api.patch(`/priorities/${id}`, data),
  delete: (id: string) => api.delete(`/priorities/${id}`),
};

// ── Canned Responses ──
export const cannedResponsesApi = {
  list: () => api.get('/canned-responses'),
  create: (data: any) => api.post('/canned-responses', data),
  update: (id: string, data: any) => api.patch(`/canned-responses/${id}`, data),
  delete: (id: string) => api.delete(`/canned-responses/${id}`),
};

// ── Watchers ──
export const watchersApi = {
  list: (ticketId: string) => api.get(`/tickets/${ticketId}/watchers`),
  add: (ticketId: string, userId: string) => api.post(`/tickets/${ticketId}/watchers`, { userId }),
  remove: (ticketId: string, userId: string) => api.delete(`/tickets/${ticketId}/watchers/${userId}`),
  watchSelf: (ticketId: string) => api.post(`/tickets/${ticketId}/watchers/me`),
  unwatchSelf: (ticketId: string) => api.delete(`/tickets/${ticketId}/watchers/me`),
};

// ── Satisfaction (CSAT) ──
export const csatApi = {
  submit: (ticketId: string, data: any) => api.post(`/satisfaction/tickets/${ticketId}`, data),
  get: (ticketId: string) => api.get(`/satisfaction/tickets/${ticketId}`),
  agentStats: (agentId: string) => api.get(`/satisfaction/agents/${agentId}`),
  overview: () => api.get('/satisfaction/overview'),
};

// ── Time Tracking ──
export const timeTrackingApi = {
  log: (ticketId: string, data: any) => api.post(`/tickets/${ticketId}/time`, data),
  list: (ticketId: string) => api.get(`/tickets/${ticketId}/time`),
  delete: (ticketId: string, entryId: string) => api.delete(`/tickets/${ticketId}/time/${entryId}`),
};

// ── Notifications ──
export const notificationsApi = {
  list: (params?: any) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
};

// ── Analytics ──
export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
  volume: (days?: number) => api.get('/analytics/volume', { params: { days } }),
  agentPerformance: () => api.get('/analytics/agent-performance'),
  agentKpiDetail: (agentId: string) => api.get(`/analytics/agent/${agentId}`),
  byPriority: () => api.get('/analytics/by-priority'),
  byStatus: () => api.get('/analytics/by-status'),
};

// ── Knowledge Base ──
export const kbApi = {
  getCategories: () => api.get('/knowledge-base/categories'),
  createCategory: (data: any) => api.post('/knowledge-base/categories', data),
  getArticles: (params?: any) => api.get('/knowledge-base/articles', { params }),
  getArticle: (id: string) => api.get(`/knowledge-base/articles/${id}`),
  createArticle: (data: any) => api.post('/knowledge-base/articles', data),
  updateArticle: (id: string, data: any) => api.patch(`/knowledge-base/articles/${id}`, data),
  deleteArticle: (id: string) => api.delete(`/knowledge-base/articles/${id}`),
};

// ── Search ──
export const searchApi = {
  tickets: (q: string, params?: any) => api.get('/search/tickets', { params: { q, ...params } }),
};

// ── SLA ──
export const slaApi = {
  list: () => api.get('/sla-policies'),
  update: (id: string, data: any) => api.patch(`/sla-policies/${id}`, data),
};

// ── JIRA ──
export const jiraApi = {
  getConfig: () => api.get('/jira/config'),
  saveConfig: (data: any) => api.post('/jira/config', data),
  deleteConfig: () => api.delete('/jira/config'),
  createIssue: (data: any) => api.post('/jira/create-issue', data),
  syncStatus: (ticketId: string) => api.get(`/jira/sync/${ticketId}`),
};

// ── Email Config ──
export const emailConfigApi = {
  get: () => api.get('/email-config/config'),
  save: (data: any) => api.post('/email-config/config', data),
  test: () => api.post('/email-config/test'),
};

// ── Channels (Inbound Email, Twilio, WhatsApp) ──
export const channelsApi = {
  getConfig: () => api.get('/channels/config'),
  saveConfig: (data: any) => api.post('/channels/config', data),
  deleteConfig: () => api.delete('/channels/config'),
  testImap: (data: any) => api.post('/channels/test-imap', data),
  getMessages: (params?: any) => api.get('/channels/messages', { params }),
};
