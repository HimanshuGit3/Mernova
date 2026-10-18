import axios from 'axios';
import { API_URL } from '../config.js';

const TOKEN_KEY = 'fixit-token';

/**
 * JWT in localStorage (D11). Trade-off: any script running on the page could read it (XSS),
 * which an httpOnly cookie would prevent; we accept it because the app renders no untrusted
 * HTML, React escapes output, and the token expires (JWT_EXPIRES_IN). See docs/notes/phase-5.md.
 */
export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* storage unavailable: the session lasts until reload */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const http = axios.create({ baseURL: API_URL, timeout: 20000 });

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const unauthorizedListeners = new Set();
/** Called with the error whenever the API answers 401 (expired or revoked session). */
export function onUnauthorized(fn) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const isAuthCall = /\/auth\/(login|register)$/.test(error.config?.url ?? '');
    if (status === 401 && !isAuthCall) {
      tokenStore.clear();
      unauthorizedListeners.forEach((fn) => fn(error));
    }
    return Promise.reject(error);
  },
);

/** Normalise any axios error into `{ status, code, message, details }`. */
export function apiError(err) {
  const body = err?.response?.data?.error;
  if (body) return { status: err.response.status, ...body };
  if (err?.code === 'ECONNABORTED')
    return { status: 0, code: 'TIMEOUT', message: 'The server took too long to answer.' };
  if (err?.request && !err.response) {
    return {
      status: 0,
      code: 'NETWORK',
      message: 'Cannot reach the FixIt server. Check that the API is running.',
    };
  }
  return { status: 500, code: 'UNKNOWN', message: err?.message ?? 'Something went wrong' };
}

/** Map an error's `details` to `{ field: message }` for forms. */
export function fieldErrors(err) {
  const out = {};
  for (const d of apiError(err).details ?? []) if (d.path && !out[d.path]) out[d.path] = d.message;
  return out;
}

/** Build query strings without empty values; arrays become comma lists. */
export function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
