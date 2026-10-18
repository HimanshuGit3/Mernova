import { cn } from './cn.js';

export function Card({ as: Tag = 'section', className, children, ...props }) {
  return (
    <Tag
      className={cn(
        'rounded-[var(--radius-card)] border border-transparent bg-surface shadow-[var(--shadow-card)] dark:border-border',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon, className, id }) {
  return (
    <header className={cn('flex items-start justify-between gap-3 px-5 pt-5 pb-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 id={id} className="truncate text-base font-bold text-text">
            {title}
          </h2>
          {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
