export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? new URL(API_URL).origin;
export const API_ORIGIN = new URL(API_URL).origin;

/** The API stores photo paths (`/uploads/x.jpg`); the web app builds URLs from its own API origin. */
export function assetUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

export const CAMPUS_CENTER = [13.1718, 77.5362];
