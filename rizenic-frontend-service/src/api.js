const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');
const TOKEN_KEY = 'rizenic.session.token';

function requestHeaders(extra = {}) {
  const headers = new Headers(extra);
  headers.set('X-Request-Id', crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}/api/v1${path}`, { ...options, headers: requestHeaders(options.headers) });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) window.dispatchEvent(new CustomEvent('rizenic:auth-expired'));
  if (!response.ok) {
    const error = new Error(body.error || body.message || 'ไม่สามารถเชื่อมต่อระบบได้');
    error.status = response.status;
    error.requestId = response.headers.get('X-Request-Id');
    throw error;
  }
  return { body, requestId: response.headers.get('X-Request-Id') };
}

export async function putJson(path, payload) {
  return (await request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).body;
}

export async function saveInspection(payload) {
  return (await request('/inspection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).body;
}

export async function login(username, password) {
  const { body, requestId } = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return { ...body, requestId };
}

export function logout() {
  sessionStorage.removeItem('rizenic.session.token');
  sessionStorage.removeItem('rizenic.session.employee');
}

export async function getJson(path) {
  return (await request(path)).body;
}

export async function createReport(payload) {
  return (await request('/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).body;
}

export async function createPartOrder(payload) {
  return (await request('/part-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })).body;
}

export async function createRobotJobJson(payload) {
  return (await request('/robot/outbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })).body;
}

export { API_URL };
