import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Sparkles, Users } from 'lucide-react';
import { CATEGORY, SEVERITY, STATUS } from '../../theme/meta.js';
import { formatDuration } from '../../theme/format.js';
import { cn } from './cn.js';

/**
 * Pills keep text in the neutral text colour (AA contrast in both themes) and carry the
 * semantic colour in a dot, a tint and a border.
 */
export function Pill({ color, children, className, icon: Icon, title }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold whitespace-nowrap text-text',
        className,
      )}
      style={{ backgroundColor: `${color}1f`, borderColor: `${color}59` }}
    >
      {Icon ? (
        <Icon className="size-3.5 shrink-0" style={{ color }} aria-hidden />
      ) : (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function StatusPill({ status, className }) {
  const s = STATUS[status] ?? STATUS.open;
  return (
    <Pill color={s.color} className={className}>
      {s.label}
    </Pill>
  );
}

export function SeverityPill({ severity, className }) {
  const s = SEVERITY[severity] ?? SEVERITY.medium;
  return (
    <Pill
      color={s.color}
      className={className}
      icon={severity === 'critical' ? AlertTriangle : undefined}
    >
      {s.label}
    </Pill>
  );
}

export function CategoryChip({ category, className }) {
  const c = CATEGORY[category] ?? CATEGORY.other;
  return (
    <Pill color={c.color} icon={c.icon} className={className}>
      {c.label}
    </Pill>
  );
}

export function SupportersChip({ count }) {
  if (!count) return null;
  return (
    <Pill
      color="#C9962B"
      icon={Users}
      title={`${count} ${count === 1 ? 'person' : 'people'} said "Me too"`}
    >
      {count}
    </Pill>
  );
}

/** "AI 82%" chip for the suggested category (FR-51). */
export function AiChip({ ai }) {
  if (!ai?.suggestedCategory) return null;
  const pct = Math.round((ai.confidence ?? 0) * 100);
  const label = CATEGORY[ai.suggestedCategory]?.label ?? ai.suggestedCategory;
  return (
    <Pill
      color="#7C5CD6"
      icon={Sparkles}
      title={
        ai.accepted ? 'Reporter accepted the AI suggestion' : 'Reporter chose a different category'
      }
    >
      AI: {label} · {pct}%{ai.accepted === false ? ' (changed)' : ''}
    </Pill>
  );
}

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** SLA countdown chip: green with time left, amber when < 25 % remains, red when overdue. */
export function SlaChip({ issue, className }) {
  const now = useNow();
  if (!issue?.dueAt) return null;
  if (['resolved', 'closed'].includes(issue.status)) {
    const met = issue.resolvedAt && new Date(issue.resolvedAt) <= new Date(issue.dueAt);
    return (
      <Pill color={met ? '#1F9E89' : '#64748B'} icon={CheckCircle2} className={className}>
        {met ? 'SLA met' : 'Done late'}
      </Pill>
    );
  }
  if (issue.status === 'rejected') return null;
  const due = new Date(issue.dueAt).getTime();
  const left = due - now;
  if (left <= 0) {
    return (
      <Pill
        color="#DC2626"
        icon={AlertTriangle}
        className={cn('!border-[#DC2626]/60', className)}
        title={`Due ${new Date(issue.dueAt).toLocaleString()}`}
      >
        Overdue {formatDuration(left)}
      </Pill>
    );
  }
  const total = due - new Date(issue.createdAt).getTime();
  const tight = total > 0 && left / total < 0.25;
  return (
    <Pill
      color={tight ? '#E0A030' : '#1F9E89'}
      icon={Clock}
      className={className}
      title={`Due ${new Date(issue.dueAt).toLocaleString()}`}
    >
      {formatDuration(left)} left
    </Pill>
  );
}
