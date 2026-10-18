import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ClipboardList, MapPin, Plus, HeartHandshake } from 'lucide-react';
import { issuesApi } from '../../api/index.js';
import { useResource } from '../../api/useResource.js';
import { useLiveRefetch } from '../../realtime/hooks.js';
import { PageHeader } from '../../components/layout/AppShell.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { Segmented } from '../../components/ui/Field.jsx';
import { Photo } from '../../components/ui/Media.jsx';
import { Pagination } from '../../components/ui/Misc.jsx';
import { SlaChip, StatusPill, SupportersChip } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { useStagger } from '../../components/issues/useStagger.js';
import { STATUS } from '../../theme/meta.js';
import { placeOf, timeAgo } from '../../theme/format.js';
import { cn } from '../../components/ui/cn.js';

const STEPS = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];
const STEP_LABEL = {
  open: 'Reported',
  assigned: 'Assigned',
  in_progress: 'Working',
  resolved: 'Fixed',
  closed: 'Confirmed',
};

/** Five-step progress bar from reported to confirmed. */
export function ProgressSteps({ status }) {
  if (status === 'rejected')
    return <p className="text-xs font-bold text-muted">Closed without action</p>;
  const current = status === 'reopened' ? 0 : STEPS.indexOf(status);
  return (
    <div>
      <div className="flex gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn('h-1.5 flex-1 rounded-full', i <= current ? '' : 'bg-surface-2')}
            style={i <= current ? { backgroundColor: STATUS[status]?.color } : undefined}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs font-bold text-muted">
        {status === 'reopened'
          ? 'Reopened · waiting for a technician'
          : `Step ${current + 1} of 5 · ${STEP_LABEL[status]}`}
      </p>
    </div>
  );
}

const FILTERS = [
  {
    value: 'active',
    label: 'In progress',
    status: ['open', 'assigned', 'in_progress', 'reopened', 'resolved'],
  },
  { value: 'done', label: 'Done', status: ['closed', 'rejected'] },
  { value: 'all', label: 'All', status: [] },
];

export function MyReportsPage() {
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(1);
  const stagger = useStagger();
  const status = FILTERS.find((f) => f.value === filter).status;
  const list = useResource(() => issuesApi.list({ status, page, limit: 12 }), [filter, page]);
  useLiveRefetch(['issue:updated'], list.reload);

  return (
    <>
      <PageHeader
        eyebrow="My reports"
        title="Your reports"
        subtitle="Track every issue you reported or supported, live."
        actions={
          <ButtonLink to="/report" icon={Plus}>
            Report an issue
          </ButtonLink>
        }
      />
      <Segmented
        name="report-filter"
        label="Show"
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        options={FILTERS}
        className="mb-5"
      />
      {list.loading && !list.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : list.error ? (
        <Card>
          <ErrorState error={list.error} onRetry={list.retry} />
        </Card>
      ) : list.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={filter === 'done' ? 'Nothing finished yet' : 'No open reports'}
            body="Spotted something broken on campus? Report it in under a minute."
            action={
              <ButtonLink to="/report" icon={Plus}>
                Report an issue
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.items.map((issue, i) => (
              <motion.li key={issue.id} {...stagger(i)}>
                <Link to={`/my-reports/${issue.id}`} className="group block h-full">
                  <Card
                    as="article"
                    className="flex h-full flex-col overflow-hidden transition-shadow duration-200 group-hover:shadow-[var(--shadow-pop)]"
                  >
                    <div className="relative">
                      <Photo
                        path={issue.thumbPath}
                        alt=""
                        category={issue.category}
                        className="aspect-[16/9] w-full"
                      />
                      <div className="absolute top-3 left-3">
                        <StatusPill status={issue.status} className="bg-surface/95 backdrop-blur" />
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div>
                        <h2 className="line-clamp-2 font-bold text-text">{issue.title}</h2>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                          <MapPin className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{placeOf(issue)}</span> ·{' '}
                          {timeAgo(issue.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <SlaChip issue={issue} />
                        <SupportersChip count={issue.supportersCount} />
                        {issue.supportedByMe ? (
                          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-gold-300/25 px-2.5 text-xs font-bold text-text">
                            <HeartHandshake className="size-3.5" aria-hidden /> You said Me too
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-auto">
                        <ProgressSteps status={issue.status} />
                      </div>
                      {issue.status === 'resolved' && issue.reportedByMe ? (
                        <p className="rounded-[var(--radius-control)] bg-[#1F9E89]/12 px-3 py-2 text-xs font-bold text-text">
                          Fixed! Open it to confirm or reopen.
                        </p>
                      ) : null}
                    </div>
                  </Card>
                </Link>
              </motion.li>
            ))}
          </ul>
          <div className="mt-5">
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              total={list.data.total}
              label="reports"
              onPage={setPage}
            />
          </div>
        </>
      )}
    </>
  );
}
