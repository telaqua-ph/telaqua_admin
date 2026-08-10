/**
 * Shared HTTP client for the Tel-Aqua API.
 * Base URL lives here so pages never hardcode it.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL;

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

/**
 * Core request helper.
 * Attaches Bearer token for authenticated requests and handles 401 globally.
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
    const message =
      data?.message ||
      data?.error ||
      `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
