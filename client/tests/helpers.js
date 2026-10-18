import { API_URL, SEED_PASSWORD } from '../scripts/stack.mjs';

export const ACCOUNTS = {
  admin: 'admin@fixit.campus',
  technician: 'ravi.tech@fixit.campus',
  student: 'asha@student.fixit.campus',
  student2: 'rahul@student.fixit.campus',
};

/** Log in through the API and return { token, user }. */
export async function apiLogin(email) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  return res.json();
}

export async function api(method, path, token, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Put a session token (and theme) into localStorage before the app loads. */
export async function signInAs(page, role, { theme } = {}) {
  const { token, user } = await apiLogin(ACCOUNTS[role]);
  await page.addInitScript(
    ([t, th]) => {
      localStorage.setItem('fixit-token', t);
      if (th) localStorage.setItem('fixit-theme', th);
    },
    [token, theme ?? null],
  );
  return { token, user };
}
