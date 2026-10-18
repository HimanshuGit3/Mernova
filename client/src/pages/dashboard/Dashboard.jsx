import { useCallback } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Clock,
  Map as MapIcon,
  PieChart,
  ShieldCheck,
} from 'lucide-react';
import { insightsApi, issuesApi } from '../../api/index.js';
import { useResource } from '../../api/useResource.js';
import { useLiveRefetch } from '../../realtime/hooks.js';
import { PageHeader } from '../../components/layout/AppShell.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from '../../components/ui/States.jsx';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber.jsx';
import { Sparkline, CategoryDonut } from '../../components/charts/Charts.jsx';
import { IssueMap } from '../../components/map/IssueMap.jsx';
import { useStagger } from '../../components/issues/useStagger.js';
import { IssueRow } from '../../components/issues/IssueBits.jsx';
import { STATUS, ACTIVE_STATUSES } from '../../theme/meta.js';
import { formatHours, timeAgo } from '../../theme/format.js';
import { useAuth } from '../../context/auth.js';
import { cn } from '../../components/ui/cn.js';

const KPIS = [
  {
    key: 'open',
    label: 'Open issues',
    icon: CircleDot,
    color: '#3B7BD0',
    deltaLabel: 'new reports vs last week',
    upIsGood: false,
  },
  {
    key: 'overdue',
    label: 'Overdue',
    icon: AlertTriangle,
    color: '#DC2626',
    deltaLabel: 'breaches vs last week',
    upIsGood: false,
  },
  {
    key: 'resolvedThisWeek',
    label: 'Resolved this week',
    icon: CheckCircle2,
    color: '#1F9E89',
    deltaLabel: 'vs last week',
    upIsGood: true,
  },
  {
    key: 'avgResolutionHours',
    label: 'Avg resolution time',
    icon: Clock,
    color: '#C9962B',
    deltaLabel: 'vs last week',
    upIsGood: false,
    hours: true,
  },
];

function Delta({ value, upIsGood, hours, label }) {
  if (value === null || value === undefined)
    return <span className="text-xs text-muted">No data last week</span>;
  if (value === 0) return <span className="text-xs text-muted">No change {label}</span>;
  const up = value > 0;
  const good = up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold whitespace-nowrap tabular',
          good
            ? 'bg-[#1F9E89]/15 text-[#13705F] dark:text-[#5FD3BE]'
            : 'bg-[#DC2626]/12 text-[#B91C1C] dark:text-[#F87171]',
        )}
      >
        <Icon className="size-3" aria-hidden />
        {up ? '+' : '−'}
        {hours ? formatHours(Math.abs(value)) : Math.abs(value)}
      </span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

function KpiCard({ kpi, data, index }) {
  const stagger = useStagger();
  const Icon = kpi.icon;
  const value = data?.[kpi.key];
  return (
    <motion.div {...stagger(index)}>
      <Card className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-muted">{kpi.label}</p>
          <span
            className="grid size-9 place-items-center rounded-[var(--radius-control)]"
            style={{ backgroundColor: `${kpi.color}1f`, color: kpi.color }}
          >
            <Icon className="size-5" aria-hidden />
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          {data ? (
            <p className="text-[32px] leading-none font-extrabold whitespace-nowrap text-text tabular">
              {kpi.hours ? (
                <AnimatedNumber
                  value={value ?? 0}
                  format={(v) => (value === null ? '—' : formatHours(v))}
                />
              ) : (
                <AnimatedNumber value={value ?? 0} />
              )}
            </p>
          ) : (
            <Skeleton className="h-8 w-20" />
          )}
          <div className="w-28 shrink-0">
            {data ? <Sparkline data={data.sparklines?.[kpi.key]} color={kpi.color} /> : null}
          </div>
        </div>
        {data ? (
          <Delta
            value={data.deltas?.[kpi.key]}
            upIsGood={kpi.upIsGood}
            hours={kpi.hours}
            label={kpi.deltaLabel}
          />
        ) : (
          <Skeleton className="h-4 w-28" />
        )}
      </Card>
    </motion.div>
  );
}

const VERB = {
  open: 'reported',
  assigned: 'assigned',
  in_progress: 'started work on',
  resolved: 'resolved',
  closed: 'closed',
  reopened: 'reopened',
  rejected: 'rejected',
};

function ActivityFeed({ items }) {
  const stagger = useStagger();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((a, i) => (
        <motion.li key={`${a.issueId}-${a.at}-${a.status}`} {...stagger(i)}>
          <Link
            to={`/issues/${a.issueId}`}
            className="flex gap-3 rounded-[var(--radius-control)] px-2 py-2 hover:bg-surface-2"
          >
            <span
              className="mt-1.5 size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS[a.status]?.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-sm">
              <span className="text-text">
                <span className="font-bold">{a.actor === 'system' ? 'FixIt' : a.actor.name}</span>{' '}
                {VERB[a.status] ?? a.status} <span className="font-bold">{a.title}</span>
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {a.building ? `${a.building} · ` : ''}
                {timeAgo(a.at)}
              </span>
            </span>
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const summary = useResource(() => insightsApi.summary(), []);
  const attention = useResource(() => insightsApi.attention(), []);
  const activity = useResource(() => insightsApi.activity(25), []);
  const overview = useResource(() => insightsApi.overview(30), []);
  const mapIssues = useResource(
    () => issuesApi.list({ status: ACTIVE_STATUSES, limit: 50, sort: 'priority' }),
    [],
  );

  const refreshLists = useCallback(() => {
    attention.reload();
    activity.reload();
    overview.reload();
    mapIssues.reload();
  }, [attention, activity, overview, mapIssues]);

  useLiveRefetch(['stats:changed'], summary.reload, { delay: 50 });
  useLiveRefetch(['issue:created', 'issue:updated'], refreshLists, { delay: 300 });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting}, ${user?.name?.split(' ')[0] ?? ''}`}
        subtitle="What needs attention across campus right now. Everything here updates live."
      />

      {summary.error ? (
        <Card className="mb-6">
          <ErrorState error={summary.error} onRetry={summary.retry} />
        </Card>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {KPIS.map((k, i) => (
            <KpiCard key={k.key} kpi={k} data={summary.data} index={i} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" aria-labelledby="attention-title">
          <CardHeader
            id="attention-title"
            icon={AlertTriangle}
            title="Needs attention"
            subtitle="Overdue and critical issues, highest priority first"
            action={
              <Link
                to="/issues?sort=priority&status=open,assigned,in_progress,reopened"
                className="rounded-md px-2 py-1 text-sm font-bold text-primary hover:bg-surface-2"
              >
                View all
              </Link>
            }
          />
          <div className="px-3 pb-4">
            {attention.loading ? (
              <SkeletonRows rows={4} className="px-2" />
            ) : attention.error ? (
              <ErrorState error={attention.error} onRetry={attention.retry} />
            ) : attention.data.items.length === 0 ? (
              <EmptyState
                compact
                icon={ShieldCheck}
                title="Nothing urgent"
                body="No overdue or critical issues. Nice work."
              />
            ) : (
              <ul className="flex flex-col">
                {attention.data.items.map((issue, i) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    to={`/issues/${issue.id}`}
                    index={i}
                    trailing={
                      <span className="hidden shrink-0 text-right sm:block">
                        <span className="block text-lg font-extrabold text-text tabular">
                          {issue.priorityScore}
                        </span>
                        <span className="block text-[11px] font-bold tracking-wide text-muted uppercase">
                          priority
                        </span>
                      </span>
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card aria-labelledby="activity-title" className="relative flex flex-col">
          <CardHeader
            id="activity-title"
            icon={Activity}
            title="Live activity"
            subtitle="Latest changes on campus"
          />
          <div className="max-h-[440px] overflow-y-auto px-3 pb-4 xl:absolute xl:inset-x-0 xl:top-[84px] xl:bottom-0 xl:max-h-none">
            {activity.loading ? (
              <SkeletonRows rows={5} className="px-2" />
            ) : activity.error ? (
              <ErrorState error={activity.error} onRetry={activity.retry} />
            ) : activity.data.items.length === 0 ? (
              <EmptyState
                compact
                icon={Activity}
                title="No activity yet"
                body="New reports and fixes will stream in here."
              />
            ) : (
              <ActivityFeed items={activity.data.items} />
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2" aria-labelledby="map-title">
          <CardHeader
            id="map-title"
            icon={MapIcon}
            title="Campus map"
            subtitle={
              mapIssues.data
                ? `${mapIssues.data.items.filter((i) => i.location).length} active issues with a location`
                : 'Active issues'
            }
            action={
              <Link
                to="/map"
                className="rounded-md px-2 py-1 text-sm font-bold text-primary hover:bg-surface-2"
              >
                Full map
              </Link>
            }
          />
          <div className="px-5 pb-5">
            {mapIssues.error ? (
              <ErrorState error={mapIssues.error} onRetry={mapIssues.retry} />
            ) : mapIssues.loading ? (
              <Skeleton className="h-80 w-full rounded-[var(--radius-card)]" />
            ) : (
              <IssueMap
                issues={mapIssues.data.items}
                className="h-80 rounded-[var(--radius-card)] border border-border"
              />
            )}
          </div>
        </Card>

        <Card aria-labelledby="donut-title">
          <CardHeader
            id="donut-title"
            icon={PieChart}
            title="By category"
            subtitle="Reports in the last 30 days"
          />
          <div className="px-5 pb-5">
            {overview.loading ? (
              <Skeleton className="mx-auto size-40 rounded-full" />
            ) : overview.error ? (
              <ErrorState error={overview.error} onRetry={overview.retry} />
            ) : overview.data.total === 0 ? (
              <EmptyState compact icon={PieChart} title="No reports yet" />
            ) : (
              <CategoryDonut counts={overview.data.byCategory} />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
