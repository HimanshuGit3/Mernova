import { NavLink, Outlet } from 'react-router';
import { ClipboardList, PlusCircle, Sparkles } from 'lucide-react';
import { Logo } from '../ui/Misc.jsx';
import { cn } from '../ui/cn.js';
import { NotificationBell, ProfileMenu, ThemeToggle } from './TopbarItems.jsx';

const NAV = [
  { to: '/my-reports', label: 'My reports', icon: ClipboardList },
  { to: '/report', label: 'Report an issue', icon: PlusCircle },
  { to: '/fixed', label: 'Fixed on campus', icon: Sparkles },
];

function Tab({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'relative inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-bold whitespace-nowrap transition-colors duration-150',
          isActive ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn('size-4', isActive && 'text-[#94690F] dark:text-gold-300')}
            aria-hidden
          />
          {label}
        </>
      )}
    </NavLink>
  );
}

/** Student web: top navigation (My reports, Report, Fixed on campus). */
export function StudentShell() {
  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 font-bold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <NavLink
            to="/my-reports"
            aria-label="FixIt Campus home"
            className="mr-2 shrink-0 rounded-md"
          >
            <span className="sm:hidden">
              <Logo withText={false} />
            </span>
            <span className="hidden sm:block">
              <Logo />
            </span>
          </NavLink>
          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Tab key={n.to} {...n} />
            ))}
          </nav>
          <div className="flex-1 md:hidden" />
          <ThemeToggle />
          <NotificationBell issueBase="/my-reports" />
          <ProfileMenu />
        </div>
        <nav
          aria-label="Main"
          className="flex gap-1 overflow-x-auto border-t border-border px-3 py-1.5 md:hidden"
        >
          {NAV.map((n) => (
            <Tab key={n.to} {...n} />
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
