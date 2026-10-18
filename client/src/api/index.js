import { http, qs } from './client.js';

const data = (p) => p.then((r) => r.data);

export const authApi = {
  login: (email, password) => data(http.post('/auth/login', { email, password })),
  register: (body) => data(http.post('/auth/register', body)),
  me: () => data(http.get('/auth/me')),
  logout: () => data(http.post('/auth/logout', {})),
};

/** Build multipart form data, skipping empty values. */
function form(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '') continue;
    fd.append(k, v);
  }
  return fd;
}

export const issuesApi = {
  list: (params) => data(http.get(`/issues${qs(params)}`)),
  feed: (params) => data(http.get(`/issues/feed${qs(params)}`)),
  get: (id) => data(http.get(`/issues/${id}`)),
  create: (fields, onUploadProgress) =>
    data(http.post('/issues', form(fields), { onUploadProgress })),
  analyse: (fields) => data(http.post('/issues/analyse', form(fields), { timeout: 30000 })),
  patch: (id, body) => data(http.patch(`/issues/${id}`, body)),
  support: (id) => data(http.post(`/issues/${id}/support`)),
  suggestions: (id) => data(http.get(`/issues/${id}/assignment-suggestions`)),
  assign: (id, technicianId, note) =>
    data(http.post(`/issues/${id}/assign`, { technicianId, note })),
  transition: (id, { to, note, reason, duplicateOf, photo }) =>
    photo
      ? data(http.post(`/issues/${id}/transition`, form({ to, note, reason, duplicateOf, photo })))
      : data(http.post(`/issues/${id}/transition`, { to, note, reason, duplicateOf })),
};

export const usersApi = {
  list: (params) => data(http.get(`/users${qs(params)}`)),
  create: (body) => data(http.post('/users', body)),
  update: (id, body) => data(http.patch(`/users/${id}`, body)),
};

export const locationsApi = {
  list: (params) => data(http.get(`/locations${qs(params)}`)),
  buildings: () => data(http.get('/locations/buildings')),
  byCode: (code) => data(http.get(`/locations/code/${encodeURIComponent(code)}`)),
  create: (body) => data(http.post('/locations', body)),
  update: (id, body) => data(http.patch(`/locations/${id}`, body)),
};

export const notificationsApi = {
  list: (params) => data(http.get(`/notifications${qs(params)}`)),
  read: (id) => data(http.post(`/notifications/${id}/read`)),
  readAll: () => data(http.post('/notifications/read-all')),
};

export const insightsApi = {
  summary: () => data(http.get('/insights/summary')),
  overview: (days = 30) => data(http.get(`/insights/overview${qs({ days })}`)),
  buildings: () => data(http.get('/insights/buildings')),
  heatmap: (days = 30) => data(http.get(`/insights/heatmap${qs({ days })}`)),
  attention: () => data(http.get('/insights/attention')),
  activity: (limit = 20) => data(http.get(`/insights/activity${qs({ limit })}`)),
  live: () => data(http.get('/insights/live')),
};

/** Download the CSV export with the auth header, then save it. */
export async function downloadIssuesCsv(params) {
  const res = await http.get(`/export/issues.csv${qs(params)}`, { responseType: 'blob' });
  const name =
    /filename="([^"]+)"/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? 'fixit-issues.csv';
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
