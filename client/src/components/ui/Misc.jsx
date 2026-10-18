import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { initials } from '../../theme/format.js';
import { cn } from './cn.js';

const AVATAR_COLORS = ['#1B3260', '#7C5CD6', '#1F9E89', '#B45309', '#3B7BD0', '#BE185D'];

export function Avatar({ name, size = 'md', className }) {
  const color =
    AVATAR_COLORS[
      [...(name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
    ];
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-bold text-white',
        size === 'sm'
          ? 'size-7 text-[11px]'
          : size === 'lg'
            ? 'size-12 text-base'
            : 'size-9 text-xs',
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Pagination({ page, totalPages, total, onPage, label = 'items' }) {
  if (!totalPages || totalPages <= 1) {
    return total ? (
      <p className="px-1 text-sm text-muted tabular">
        {total} {label}
      </p>
    ) : null;
  }
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted tabular">
        Page {page} of {totalPages} · {total} {label}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm font-bold text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm font-bold text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

/** Popover menu anchored to a trigger; closes on outside click and Escape. */
export function Popover({
  trigger,
  children,
  align = 'right',
  className,
  open: controlled,
  onOpenChange,
}) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = (v) => (onOpenChange ? onOpenChange(v) : setInner(v));
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  });
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open ? (
        <div
          className={cn(
            'absolute top-full z-40 mt-2 rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-pop)]',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
  );
}

export function Logo({ className, light = false, withText = true }) {
  const gradientId = `fixit-logo-${useId().replace(/:/g, '')}`;
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 64 64" className="size-9 shrink-0" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E4BC63" />
            <stop offset="1" stopColor="#C9962B" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="#0F1F3D" />
        <path
          d="M32 9c-9.4 0-17 7.4-17 16.6C15 38 32 55 32 55s17-17 17-29.4C49 16.4 41.4 9 32 9z"
          fill={`url(#${gradientId})`}
        />
        <circle cx="32" cy="25.5" r="9.5" fill="#0F1F3D" />
        <path
          d="M36.9 20.2a5.2 5.2 0 0 0-6.6 6.4l-4.6 4.6a1.6 1.6 0 0 0 2.3 2.3l4.6-4.6a5.2 5.2 0 0 0 6.4-6.6l-2.9 2.9-2.4-.6-.6-2.4z"
          fill="#E4BC63"
        />
      </svg>
      {withText ? (
        <span
          className={cn(
            'text-lg leading-none font-extrabold tracking-tight',
            light ? 'text-white' : 'text-text',
          )}
        >
          FixIt{' '}
          <span className={light ? 'text-gold-300' : 'text-[#94690F] dark:text-gold-300'}>
            Campus
          </span>
        </span>
      ) : null}
    </span>
  );
}
