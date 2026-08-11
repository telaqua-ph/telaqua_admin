/**
 * Shared HTTP client for the Tel-Aqua Hostinger API.
 * Base URL comes from VITE_API_URL only — never hardcode elsewhere.
 */

function normalizeBaseUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '');
}

function normalizePath(path) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL);

const TOKEN_KEY = 'token';
const ADMIN_KEY = 'admin';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthSession(token, admin) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function getStoredAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAdmin(admin) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

function redirectToLogin() {
  clearAuthSession();
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

function buildUrl(path) {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_URL is not configured');
  }
  return `${API_BASE_URL}${normalizePath(path)}`;
}

function friendlyHttpMessage(status) {
  const map = {
    400: 'Invalid request. Please check the details and try again.',
    401: 'Session expired. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'This action conflicts with the current order state.',
    422: 'Some fields are invalid. Please review and try again.',
    429: 'Too many requests. Please wait a moment and try again.',
    500: 'Server error. Please try again later.',
  };
  return map[status] || `Request failed (${status})`;
}

/**
 * Core request helper.
 * Attaches Bearer token for authenticated requests and handles 401 globally.
 * Never attaches Delhivery tokens — Hostinger backend owns those.
 */
export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    auth = true,
    headers: customHeaders = {},
  } = options;

  const headers = {
    Accept: 'application/json',
    ...customHeaders,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const error = new Error(
      'Network error. Check your connection and try again.'
    );
    error.status = 0;
    throw error;
  }

  if (response.status === 401 && auth) {
    redirectToLogin();
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const rawMessage =
      data?.message ||
      data?.error ||
      (typeof data?.errors === 'string' ? data.errors : null);
    // Prefer the Hostinger backend message whenever present.
    const message = rawMessage || friendlyHttpMessage(response.status);
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    error.rawMessage = rawMessage || null;
    throw error;
  }

  return data;
}
