import { useState } from 'react';
import { MapPinned } from 'lucide-react';
import { issuesApi } from '../../api/index.js';
import { useResource } from '../../api/useResource.js';
import { useLiveRefetch } from '../../realtime/hooks.js';
import { PageHeader } from '../../components/layout/AppShell.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ChipToggleGroup } from '../../components/ui/Field.jsx';
import { ErrorState, Skeleton, EmptyState } from '../../components/ui/States.jsx';
import { IssueMap } from '../../components/map/IssueMap.jsx';
import { STATUS, ACTIVE_STATUSES } from '../../theme/meta.js';

/** Full-page campus map of issues, filterable by status, updating live. */
export function MapPage() {
  const [status, setStatus] = useState(ACTIVE_STATUSES);
  const list = useResource(
    () => issuesApi.list({ status, limit: 50, sort: 'priority' }),
    [status.join(',')],
  );
  useLiveRefetch(['issue:created', 'issue:updated'], list.reload, { delay: 400 });
  const located = list.data?.items.filter((i) => i.location) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Map"
        title="Campus map"
        subtitle="Each pin is an issue, coloured by status. Click a pin to open it."
      />
      <Card className="mb-4 p-4 sm:p-5">
        <ChipToggleGroup
          label="Statuses on the map"
          values={status}
          onChange={setStatus}
          options={Object.entries(STATUS).map(([value, s]) => ({
            value,
            label: s.label,
            color: s.color,
          }))}
        />
      </Card>
      <Card className="overflow-hidden p-0">
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.retry} />
        ) : list.loading && !list.data ? (
          <Skeleton className="h-[65dvh] w-full rounded-none" />
        ) : located.length === 0 ? (
          <EmptyState icon={MapPinned} title="No issues to show" body="Pick more statuses above." />
        ) : (
          <IssueMap issues={located} className="h-[65dvh] min-h-96 w-full" />
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        Showing the {located.length} highest-priority issues with a location (max 50).
      </p>
    </>
  );
}
