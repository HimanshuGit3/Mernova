import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Menu, PanelLeftClose, PanelLeftOpen, Search, WifiOff, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useSocket } from '../../realtime/hooks.js';
import { Logo } from '../ui/Misc.jsx';
import { IconButton } from '../ui/Button.jsx';
import { cn } from '../ui/cn.js';
import { NotificationBell, ProfileMenu, ThemeToggle } from './TopbarItems.jsx';

const COLLAPSE_KEY = 'fixit-sidebar-collapsed';

function NavItems({ nav, collapsed, onNavigate }) {
  return (
    <ul className="flex flex-col gap-1">
      {nav.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-bold transition-colors duration-150',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-[#B9C3DA] hover:bg-white/5 hover:text-white',
                collapsed && 'justify-center px-0',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <span
                    className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-gold-300"
                    aria-hidden
                  />
                ) : null}
                <Icon className={cn('size-5 shrink-0', isActive && 'text-gold-300')} aria-hidden />
                <span className={cn(collapsed && 'sr-only')}>{label}</span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/** Admin/technician shell: collapsible navy sidebar, top bar with search, bell, theme and profile. */
export function AppShell({ nav, searchable = false, issueBase = '/issues', footerNote }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { connected, socket } = useSocket();

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const sidebar = (isMobile) => (
    <div className="campus-grid flex h-full flex-col bg-navy-900 px-3 py-4">
      <div
        className={cn(
          'mb-6 flex items-center px-1',
          collapsed && !isMobile ? 'justify-center' : 'justify-between',
        )}
      >
        <Logo light withText={isMobile || !collapsed} />
        {isMobile ? (
          <IconButton
            icon={X}
            label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="text-white hover:bg-white/10"
          />
        ) : null}
      </div>
      <nav aria-label="Main" className="flex-1">
        <NavItems
          nav={nav}
          collapsed={collapsed && !isMobile}
          onNavigate={() => setMobileOpen(false)}
        />
      </nav>
      {footerNote && (isMobile || !collapsed) ? (
        <div className="mt-4 rounded-[var(--radius-control)] bg-white/5 p-3 text-xs text-[#B9C3DA]">
          {footerNote}
        </div>
      ) : null}
      {!isMobile ? (
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            'mt-4 flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-bold text-[#B9C3DA] hover:bg-white/5 hover:text-white',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" aria-hidden />
          ) : (
            <PanelLeftClose className="size-5" aria-hidden />
          )}
          {!collapsed ? 'Collapse' : null}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 font-bold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <aside
        className={cn(
          'campus-grid hidden shrink-0 bg-navy-900 transition-[width] duration-200 ease-out lg:block',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
      >
        {/* the aside stretches with the page; its content stays pinned to the viewport */}
        <div className="sticky top-0 h-dvh">{sidebar(false)}</div>
      </aside>

      <AnimatePresence>
        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-navy-900/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              aria-label="Menu"
            >
              {sidebar(true)}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-5">
          <IconButton
            icon={Menu}
            label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden"
          />
          {searchable ? <GlobalSearch /> : <div className="flex-1" />}
          {socket && !connected ? (
            <span
              className="hidden items-center gap-1.5 rounded-full bg-[#E0A030]/15 px-2.5 py-1 text-xs font-bold text-text sm:inline-flex"
              role="status"
            >
              <WifiOff className="size-3.5" aria-hidden /> Reconnecting…
            </span>
          ) : null}
          <ThemeToggle />
          <NotificationBell issueBase={issueBase} />
          <ProfileMenu />
        </header>
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      className="flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/issues${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
      }}
    >
      <label className="relative block max-w-md">
        <span className="sr-only">Search issues</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search issues…"
          className="h-10 w-full rounded-full border border-border bg-bg pr-4 pl-9 text-sm text-text placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-ring/40 focus:outline-none"
        />
      </label>
    </form>
  );
}

/** Page title row used by every page in the shell. */
export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-bold tracking-wider text-muted uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-text sm:text-[28px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
