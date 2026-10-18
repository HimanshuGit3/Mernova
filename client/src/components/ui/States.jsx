import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';
import { cn } from './cn.js';

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-2', className)} aria-hidden />;
}

/** A list of skeleton rows for tables and feeds. */
export function SkeletonRows({ rows = 5, className }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Illustrated empty state built from shapes and an icon (no stock art). */
export function EmptyState({ icon: Icon, title, body, action, className, compact }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <div className="relative grid place-items-center">
        <div
          className={cn('absolute rounded-full bg-gold-300/20', compact ? 'size-16' : 'size-24')}
          aria-hidden
        />
        <div
          className={cn(
            'relative grid place-items-center rounded-2xl bg-surface-2 text-primary ring-1 ring-border',
            compact ? 'size-11' : 'size-14',
          )}
        >
          {Icon ? <Icon className={compact ? 'size-5' : 'size-7'} aria-hidden /> : null}
        </div>
      </div>
      <h3 className={cn('font-bold text-text', compact ? 'text-sm' : 'mt-2 text-base')}>{title}</h3>
      {body ? <p className="max-w-sm text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, className, title = 'Something went wrong' }) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}
    >
      <div className="grid size-12 place-items-center rounded-full bg-[#DC2626]/12 text-[#DC2626]">
        <AlertCircle className="size-6" aria-hidden />
      </div>
      <h3 className="font-bold text-text">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{error?.message ?? 'Please try again.'}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => onRetry()}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
