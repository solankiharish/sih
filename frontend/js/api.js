// Small fetch wrapper for talking to the Express backend.
// Since the backend serves this frontend as static files, same-origin
// relative paths work whether you open it via VS Code Live Server or
// directly from Express on http://localhost:5000
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('sih_token');
}

async function apiRequest(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      errMsg = data.error || errMsg;
    }
    throw new Error(errMsg);
  }

  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res; // caller handles raw response (e.g. file blobs)
}

const Api = {
  login: (username, password) =>
    apiRequest('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => apiRequest('/auth/me'),
  createUser: (payload) => apiRequest('/auth/users', { method: 'POST', body: payload }),
  listUsers: () => apiRequest('/auth/users'),

  listDocuments: () => apiRequest('/documents'),
  uploadDocument: (formData) =>
    apiRequest('/documents/upload', { method: 'POST', body: formData, isFormData: true }),
  viewDocumentUrl: (id) => `${API_BASE}/documents/${id}/view`,
  verifyDocument: (id) => apiRequest(`/documents/${id}/verify`),

  listAudit: () => apiRequest('/audit'),
};
