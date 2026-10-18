import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Where each role lands after signing in. */
export function homeFor(user) {
  if (!user) return '/login';
  if (user.role === 'admin') return '/dashboard';
  if (user.role === 'technician') return '/jobs';
  return '/my-reports';
}

export const NotificationsContext = createContext(null);
export const useNotifications = () => useContext(NotificationsContext);
