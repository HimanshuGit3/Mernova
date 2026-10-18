import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/index.js';
import { onUnauthorized, tokenStore } from '../api/client.js';
import { AuthContext } from './auth.js';

/**
 * Session state. On start-up a saved token is checked with GET /auth/me; any 401 from any
 * request (expired or deactivated) clears the session and the router sends the user to Login.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => tokenStore.get());
  const [status, setStatus] = useState(() => (tokenStore.get() ? 'checking' : 'signed-out'));
  const [expired, setExpired] = useState(false);

  // Validate a saved token once at start-up (state is only set in the async callbacks).
  const [initialToken] = useState(token);
  useEffect(() => {
    if (!initialToken) return undefined;
    let cancelled = false;
    authApi.me().then(
      ({ user: u }) => {
        if (cancelled) return;
        setUser(u);
        setStatus('signed-in');
      },
      () => {
        if (cancelled) return;
        tokenStore.clear();
        setToken(null);
        setUser(null);
        setStatus('signed-out');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [initialToken]);

  useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null);
        setToken(null);
        setStatus('signed-out');
        setExpired(true);
      }),
    [],
  );

  const accept = useCallback(({ token: t, user: u }) => {
    tokenStore.set(t);
    setToken(t);
    setUser(u);
    setStatus('signed-in');
    setExpired(false);
    return u;
  }, []);

  const login = useCallback(
    async (email, password) => accept(await authApi.login(email, password)),
    [accept],
  );
  const register = useCallback(async (body) => accept(await authApi.register(body)), [accept]);
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* the token may already be invalid; sign out locally anyway */
    }
    tokenStore.clear();
    setToken(null);
    setUser(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo(
    () => ({ user, token, status, expired, login, register, logout }),
    [user, token, status, expired, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
