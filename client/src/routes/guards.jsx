import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth, homeFor } from '../context/auth.js';
import { Logo } from '../components/ui/Misc.jsx';

export function Splash() {
  return (
    <div
      className="grid min-h-dvh place-items-center bg-bg"
      role="status"
      aria-label="Loading FixIt Campus"
    >
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-gold-500" />
        </div>
      </div>
    </div>
  );
}

/**
 * Client-side guard for navigation only. Access control is enforced by the API on every
 * request (NFR-02); hiding a route here is never the security boundary.
 */
export function RequireRole({ roles }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'checking') return <Splash />;
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

export function Home() {
  const { user, status } = useAuth();
  if (status === 'checking') return <Splash />;
  return <Navigate to={homeFor(user)} replace />;
}
