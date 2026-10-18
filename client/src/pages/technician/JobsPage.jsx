import { useState } from 'react';
import { Briefcase, Smartphone } from 'lucide-react';
import { issuesApi } from '../../api/index.js';
import { useResource } from '../../api/useResource.js';
import { useLiveRefetch } from '../../realtime/hooks.js';
import { PageHeader } from '../../components/layout/AppShell.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Segmented } from '../../components/ui/Field.jsx';
import { Pagination } from '../../components/ui/Misc.jsx';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/ui/States.jsx';
import { IssueRow } from '../../components/issues/IssueBits.jsx';

const TABS = [
  { value: 'active', label: 'To do', status: ['assigned', 'in_progress'] },
  { value: 'done', label: 'Done', status: ['resolved', 'closed'] },
];

/** Technician jobs on the web (the main technician experience is the mobile app). */
export function JobsPage() {
  const [tab, setTab] = useState('active');
  const [page, setPage] = useState(1);
  const status = TABS.find((t) => t.value === tab).status;
  const list = useResource(
    () =>
      issuesApi.list({ status, sort: tab === 'active' ? 'priority' : 'newest', page, limit: 20 }),
    [tab, page],
  );
  useLiveRefetch(['issue:updated'], list.reload);

  return (
    <>
      <PageHeader
        eyebrow="My jobs"
        title="Your jobs"
        subtitle="Highest priority first. Use the FixIt app on site to take the after photo."
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          name="jobs-tab"
          label="Show"
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          options={TABS}
        />
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Smartphone className="size-4" aria-hidden /> Same account works in the mobile app
        </p>
      </div>
      <Card className="p-3">
        {list.loading && !list.data ? (
          <SkeletonRows rows={5} className="p-2" />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.retry} />
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={tab === 'active' ? 'No jobs right now' : 'No finished jobs yet'}
            body={tab === 'active' ? 'New assignments appear here instantly.' : undefined}
          />
        ) : (
          <>
            <ul className="flex flex-col">
              {list.data.items.map((issue, i) => (
                <IssueRow key={issue.id} issue={issue} to={`/jobs/${issue.id}`} index={i} />
              ))}
            </ul>
            <div className="px-2 pt-3">
              <Pagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                total={list.data.total}
                label="jobs"
                onPage={setPage}
              />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
