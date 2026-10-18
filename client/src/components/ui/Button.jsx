import { forwardRef } from 'react';
import { Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { cn } from './cn.js';

const VARIANTS = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-sm disabled:bg-primary/60',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-2 disabled:text-muted',
  ghost: 'text-text hover:bg-surface-2 disabled:text-muted',
  danger: 'bg-[#B91C1C] text-white hover:bg-[#991B1B] disabled:bg-[#B91C1C]/60',
  gold: 'bg-gold-500 text-navy-900 hover:bg-gold-300 shadow-sm disabled:opacity-60',
};
const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] font-bold whitespace-nowrap transition-colors duration-150 ease-out disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="size-4" aria-hidden />
      ) : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4" aria-hidden /> : null}
    </button>
  );
});

/** A router link that looks like a button (never nest a button inside a link). */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className,
  children,
  ...props
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] font-bold whitespace-nowrap transition-colors duration-150 ease-out',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </Link>
  );
}

/** Icon-only button: `label` is required (NFR-14 "labels on icon buttons"). */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', className, badge, ...props },
  ref,
) {
  const dims = size === 'sm' ? 'size-9' : 'size-11';
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] transition-colors duration-150',
        dims,
        VARIANTS[variant],
        variant === 'ghost' && 'text-muted hover:text-text',
        className,
      )}
      {...props}
    >
      <Icon className="size-5" aria-hidden />
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-[#DC2626] px-1 text-[11px] leading-5 font-bold text-white tabular ring-2 ring-surface">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
});
