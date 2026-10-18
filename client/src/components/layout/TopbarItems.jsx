import { Bell, CheckCheck, LogOut, Moon, Sun, UserRound, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useNotifications } from '../../context/auth.js';
import { useAuth } from '../../context/auth.js';
import { useTheme } from '../../theme/themeContext.js';
import { ROLE_LABEL } from '../../theme/meta.js';
import { timeAgo } from '../../theme/format.js';
import { IconButton } from '../ui/Button.jsx';
import { Avatar, Popover } from '../ui/Misc.jsx';
import { EmptyState, SkeletonRows } from '../ui/States.jsx';
import { cn } from '../ui/cn.js';

export function ThemeToggle({ className }) {
  const { theme, toggle } = useTheme();
  return (
    <IconButton
      icon={theme === 'dark' ? Sun : Moon}
      label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className={className}
    />
  );
}

/** Shared inbox (FR-50): bell with unread badge and a dropdown of recent notifications. */
export function NotificationBell({ issueBase }) {
  const { items, unread, loading, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  return (
    <Popover
      className="w-[min(92vw,380px)]"
      trigger={({ toggle, open }) => (
        <IconButton
          icon={Bell}
          label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          badge={unread}
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
        />
      )}
    >
      {({ close }) => (
        <div role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-text">Notifications</p>
            {unread ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-primary hover:bg-surface-2"
              >
                <CheckCheck className="size-3.5" aria-hidden /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[60dvh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <SkeletonRows rows={3} className="p-4" />
            ) : items.length === 0 ? (
              <EmptyState
                compact
                icon={Inbox}
                title="You're all caught up"
                body="Updates about your issues will appear here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.readAt) markRead(n.id);
                        close();
                        if (n.issue) navigate(`${issueBase}/${n.issue}`);
                      }}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2',
                        !n.readAt && 'bg-gold-300/10',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          n.readAt ? 'bg-transparent' : 'bg-gold-500',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-text">{n.title}</span>
                        {n.body ? (
                          <span className="mt-0.5 line-clamp-2 block text-sm text-muted">
                            {n.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-xs text-muted">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      {!n.readAt ? <span className="sr-only">Unread</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <Popover
      className="w-64"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Account menu for ${user.name}`}
          className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] px-1.5 hover:bg-surface-2 sm:pr-3"
        >
          <Avatar name={user.name} size="sm" />
          <span className="hidden text-left leading-tight md:block">
            <span className="block max-w-32 truncate text-sm font-bold text-text">{user.name}</span>
            <span className="block text-xs text-muted">{ROLE_LABEL[user.role]}</span>
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <div role="menu" className="p-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={user.name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted">
            <UserRound className="size-4" aria-hidden /> {ROLE_LABEL[user.role]}
            {user.department ? ` · ${user.department}` : ''}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              close();
              await logout();
              navigate('/login');
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-bold text-text hover:bg-surface-2"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </Popover>
  );
}
