import { Link } from 'react-router';
import { motion } from 'motion/react';
import { useStagger } from './useStagger.js';
import { MapPin, ChevronRight } from 'lucide-react';
import { STATUS } from '../../theme/meta.js';
import { placeOf, timeAgo } from '../../theme/format.js';
import { Photo } from '../ui/Media.jsx';
import { SeverityPill, SlaChip, StatusPill, SupportersChip } from '../ui/Badge.jsx';
import { cn } from '../ui/cn.js';

/** Compact issue row used in lists (dashboard, technician jobs). */
export function IssueRow({ issue, to, index = 0, showStatus = true, trailing }) {
  const stagger = useStagger();
  return (
    <motion.li {...stagger(index)}>
      <Link
        to={to}
        className="group flex items-center gap-3 rounded-[var(--radius-control)] px-2 py-2.5 hover:bg-surface-2"
      >
        <Photo
          path={issue.thumbPath}
          alt=""
          category={issue.category}
          className="size-12 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-text">{issue.title}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{placeOf(issue)}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{timeAgo(issue.createdAt)}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {showStatus ? <StatusPill status={issue.status} /> : null}
            <SeverityPill severity={issue.severity} />
            <SlaChip issue={issue} />
            <SupportersChip count={issue.supportersCount} />
          </div>
        </div>
        {trailing}
        <ChevronRight
          className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </motion.li>
  );
}

/** Vertical status timeline from statusHistory. */
export function StatusTimeline({ history }) {
  return (
    <ol className="relative flex flex-col gap-5 pl-6">
      <span className="absolute top-2 bottom-2 left-[7px] w-0.5 bg-border" aria-hidden />
      {history.map((h, i) => {
        const color = STATUS[h.status]?.color ?? '#64748B';
        const who =
          h.changedBy === 'system'
            ? 'FixIt (automatic)'
            : (h.changedBy?.name ??
              (h.changedBy?.role === 'technician'
                ? 'Maintenance team'
                : h.changedBy?.role === 'admin'
                  ? 'Estate office'
                  : 'Reporter'));
        const last = i === history.length - 1;
        return (
          <li key={`${h.status}-${h.at}-${i}`} className="relative">
            <span
              className={cn(
                'absolute top-1 -left-6 size-4 rounded-full border-[3px] border-surface',
                last && 'ring-4',
              )}
              style={{ backgroundColor: color, '--tw-ring-color': `${color}33` }}
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-bold text-text">
                {STATUS[h.status]?.label ?? h.status}
              </span>
              <span className="text-xs text-muted">
                {who} ·{' '}
                <time dateTime={h.at}>
                  {new Date(h.at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </span>
            </div>
            {h.note ? <p className="mt-1 text-sm text-muted">{h.note}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
