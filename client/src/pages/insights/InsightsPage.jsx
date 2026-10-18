import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  Inbox,
  LineChart as LineIcon,
  PieChart,
  Timer,
} from 'lucide-react';
import { downloadIssuesCsv, insightsApi } from '../../api/index.js';
import { apiError } from '../../api/client.js';
import { useResource } from '../../api/useResource.js';
import { useLiveRefetch } from '../../realtime/hooks.js';
import { PageHeader } from '../../components/layout/AppShell.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Segmented } from '../../components/ui/Field.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber.jsx';
import {
  CategoryDonut,
  ReportsVsFixesChart,
  ResolutionTimeChart,
  StatusBars,
} from '../../components/charts/Charts.jsx';
import { BaseMap } from '../../components/map/IssueMap.jsx';
import { HeatLayer } from '../../components/map/HeatLayer.jsx';
import { formatHours } from '../../theme/format.js';
import { cn } from '../../components/ui/cn.js';

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

/** Health is a status-like judgement: icon + label + colour, never colour alone. */
function scoreBand(score) {
  if (score >= 75)
    return { label: 'Healthy', color: '#1F9E89', text: 'text-[#13705F] dark:text-[#5FD3BE]' };
  if (score >= 50)
    return { label: 'Needs care', color: '#E0A030', text: 'text-[#8A5A00] dark:text-[#F0C46A]' };
  return { label: 'At risk', color: '#DC2626', text: 'text-[#B91C1C] dark:text-[#F87171]' };
}

function Stat({ icon: Icon, label, value, format, hint }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface-2 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-muted">{label}</p>
        <p className="text-2xl font-extrabold text-text tabular">
          {value === undefined ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <AnimatedNumber value={value ?? 0} format={format} />
          )}
        </p>
        {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
      </div>
    </Card>
  );
}

function BuildingHealth({ rows }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Building health scores</caption>
        <thead>
          <tr className="text-xs font-bold tracking-wide text-muted uppercase">
            <th scope="col" className="border-b border-border px-5 py-3">
              Building
            </th>
            <th scope="col" className="w-[34%] border-b border-border px-3 py-3">
              Health score
            </th>
            <th scope="col" className="border-b border-border px-3 py-3 text-right">
              Open
            </th>
            <th scope="col" className="border-b border-border px-3 py-3 text-right">
              Overdue
            </th>
            <th scope="col" className="border-b border-border px-3 py-3 text-right">
              Fixed (30 d)
            </th>
            <th scope="col" className="border-b border-border px-5 py-3 text-right">
              Avg fix time
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const band = scoreBand(b.score);
            return (
              <tr key={b.building} className="hover:bg-surface-2">
                <th scope="row" className="border-b border-border px-5 py-3 font-bold text-text">
                  {b.building}
                </th>
                <td className="border-b border-border px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${b.score}%`, backgroundColor: band.color }}
                      />
                    </span>
                    <span className="w-8 text-right font-extrabold text-text tabular">
                      {b.score}
                    </span>
                    <span className={cn('w-20 text-xs font-bold', band.text)}>{band.label}</span>
                  </div>
                </td>
                <td className="border-b border-border px-3 py-3 text-right text-text tabular">
                  {b.open}
                </td>
                <td
                  className={cn(
                    'border-b border-border px-3 py-3 text-right tabular',
                    b.overdue ? 'font-bold text-[#B91C1C] dark:text-[#F87171]' : 'text-text',
                  )}
                >
                  {b.overdue}
                </td>
                <td className="border-b border-border px-3 py-3 text-right text-text tabular">
                  {b.resolved30d}
                </td>
                <td className="border-b border-border px-5 py-3 text-right text-text tabular">
                  {formatHours(b.avgResolutionHours)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function InsightsPage() {
  const [range, setRange] = useState('30');
  const [exporting, setExporting] = useState(false);
  const days = Number(range);
  const overview = useResource(() => insightsApi.overview(days), [days]);
  const buildings = useResource(() => insightsApi.buildings(), []);
  const heat = useResource(() => insightsApi.heatmap(days), [days]);
  useLiveRefetch(
    ['stats:changed'],
    () => {
      overview.reload();
      buildings.reload();
      heat.reload();
    },
    { delay: 500 },
  );

  const totals = useMemo(() => {
    const o = overview.data;
    if (!o) return {};
    const resolved = o.resolutionTrend.reduce((a, d) => a + d.resolved, 0);
    const weighted = o.resolutionTrend.reduce((a, d) => a + (d.avgHours ?? 0) * d.resolved, 0);
    return { reported: o.total, resolved, avgHours: resolved ? weighted / resolved : null };
  }, [overview.data]);

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadIssuesCsv({ from: new Date(Date.now() - days * 864e5).toISOString() });
      toast.success(`Exported the last ${days} days`);
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setExporting(false);
    }
  }

  const points = heat.data?.points ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Campus insights"
        subtitle="Where problems happen, how fast they get fixed, and which buildings need care."
        actions={
          <>
            <Segmented
              name="range"
              label="Time range"
              value={range}
              onChange={setRange}
              options={RANGES}
            />
            <Button variant="secondary" icon={Download} loading={exporting} onClick={exportCsv}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          icon={Inbox}
          label="Reported"
          value={overview.data ? totals.reported : undefined}
          hint={`in the last ${days} days`}
        />
        <Stat
          icon={CheckCircle2}
          label="Fixed"
          value={overview.data ? totals.resolved : undefined}
          hint={`in the last ${days} days`}
        />
        <Stat
          icon={Timer}
          label="Average time to fix"
          value={overview.data ? (totals.avgHours ?? null) : undefined}
          format={(v) => (totals.avgHours === null ? '—' : formatHours(v))}
          hint="from report to fix"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card aria-labelledby="trend-title">
          <CardHeader
            id="trend-title"
            icon={LineIcon}
            title="Reports vs fixes"
            subtitle="Per day"
          />
          <div className="px-5 pb-5">
            {overview.error ? (
              <ErrorState error={overview.error} onRetry={overview.retry} />
            ) : !overview.data ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ReportsVsFixesChart
                created={overview.data.createdTrend}
                resolution={overview.data.resolutionTrend}
              />
            )}
          </div>
        </Card>
        <Card aria-labelledby="fix-title">
          <CardHeader
            id="fix-title"
            icon={Clock}
            title="Average time to fix"
            subtitle="Hours from report to fix, by day fixed"
          />
          <div className="px-5 pb-5">
            {overview.error ? (
              <ErrorState error={overview.error} onRetry={overview.retry} />
            ) : !overview.data ? (
              <Skeleton className="h-56 w-full" />
            ) : totals.resolved === 0 ? (
              <EmptyState compact icon={Clock} title="No fixes in this period" />
            ) : (
              <ResolutionTimeChart resolution={overview.data.resolutionTrend} />
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2" aria-labelledby="heat-title">
          <CardHeader
            id="heat-title"
            icon={Flame}
            title="Problem hotspots"
            subtitle={`Reports in the last ${days} days, weighted by severity (darker = more severe or more frequent)`}
          />
          <div className="px-5 pb-5">
            {heat.error ? (
              <ErrorState error={heat.error} onRetry={heat.retry} />
            ) : !heat.data ? (
              <Skeleton className="h-96 w-full" />
            ) : points.length === 0 ? (
              <EmptyState compact icon={Flame} title="No located reports in this period" />
            ) : (
              <BaseMap
                className="h-96 rounded-[var(--radius-card)] border border-border"
                label="Heatmap of reports"
              >
                <HeatLayer points={points} />
              </BaseMap>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden xl:col-span-2" aria-labelledby="health-title">
          <CardHeader
            id="health-title"
            icon={Building2}
            title="Building health"
            subtitle="100 = no open or overdue issues and fast fixes. Worst first."
          />
          {buildings.error ? (
            <ErrorState error={buildings.error} onRetry={buildings.retry} />
          ) : !buildings.data ? (
            <Skeleton className="mx-5 mb-5 h-64" />
          ) : (
            <BuildingHealth rows={buildings.data.buildings} />
          )}
        </Card>

        <Card aria-labelledby="status-title">
          <CardHeader
            id="status-title"
            icon={CheckCircle2}
            title="By status"
            subtitle={`Reports from the last ${days} days`}
          />
          <div className="px-5 pb-5">
            {overview.data ? (
              <StatusBars counts={overview.data.byStatus} />
            ) : (
              <Skeleton className="h-48 w-full" />
            )}
          </div>
        </Card>
        <Card aria-labelledby="cat-title">
          <CardHeader
            id="cat-title"
            icon={PieChart}
            title="By category"
            subtitle={`Reports from the last ${days} days`}
          />
          <div className="px-5 pb-5">
            {overview.data ? (
              overview.data.total ? (
                <CategoryDonut counts={overview.data.byCategory} />
              ) : (
                <EmptyState compact icon={PieChart} title="No reports" />
              )
            ) : (
              <Skeleton className="mx-auto size-40 rounded-full" />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
