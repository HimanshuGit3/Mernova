import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { Download, Filter, Inbox, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { downloadIssuesCsv, issuesApi, locationsApi } from '../../api/index.js';
import { apiError } from '../../api/client.js';
import { useResource } from '../../api/useResource.js';
import { useLiveRefetch } from '../../realtime/hooks.js';
import { PageHeader } from '../../components/layout/AppShell.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ChipToggleGroup, Input, Select } from '../../components/ui/Field.jsx';
import { Pagination } from '../../components/ui/Misc.jsx';
import { Photo } from '../../components/ui/Media.jsx';
import { SeverityPill, SlaChip, StatusPill, SupportersChip } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/ui/States.jsx';
import { useStagger } from '../../components/issues/useStagger.js';
import {
  CATEGORY,
  CATEGORY_ORDER,
  SEVERITY,
  SEVERITY_ORDER,
  STATUS,
  STATUS_ORDER,
} from '../../theme/meta.js';
import { placeOf, timeAgo } from '../../theme/format.js';
import { toast } from 'sonner';
import { cn } from '../../components/ui/cn.js';

const LIST_KEYS = ['status', 'severity'];
const SCALAR_KEYS = ['category', 'building', 'from', 'to', 'q', 'sort', 'page'];

/** Filters live in the URL so views can be shared, bookmarked and survive reloads. */
function useUrlFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => {
    const f = {};
    for (const k of LIST_KEYS) f[k] = params.get(k)?.split(',').filter(Boolean) ?? [];
    for (const k of SCALAR_KEYS) f[k] = params.get(k) ?? '';
    f.page = Number(f.page) || 1;
    f.sort = f.sort || 'newest';
    return f;
  }, [params]);
  const update = (patch, { resetPage = true } = {}) => {
    const next = { ...filters, ...patch };
    if (resetPage && !('page' in patch)) next.page = 1;
    const sp = new URLSearchParams();
    for (const k of LIST_KEYS) if (next[k]?.length) sp.set(k, next[k].join(','));
    for (const k of SCALAR_KEYS) {
      const v = next[k];
      if (v && !(k === 'page' && Number(v) === 1) && !(k === 'sort' && v === 'newest'))
        sp.set(k, String(v));
    }
    setParams(sp, { replace: true });
  };
  return [filters, update];
}

function toQuery(f) {
  return {
    status: f.status,
    severity: f.severity,
    category: f.category || undefined,
    building: f.building || undefined,
    from: f.from ? new Date(`${f.from}T00:00:00`).toISOString() : undefined,
    to: f.to ? new Date(`${f.to}T23:59:59`).toISOString() : undefined,
    q: f.q || undefined,
    sort: f.sort,
    page: f.page,
    limit: 20,
  };
}

export function IssuesPage() {
  const [filters, update] = useUrlFilters();
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState(filters.q);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const stagger = useStagger();
  const query = toQuery(filters);
  const list = useResource(() => issuesApi.list(query), [JSON.stringify(query)]);
  const buildings = useResource(() => locationsApi.buildings(), []);
  useLiveRefetch(['issue:created', 'issue:updated'], list.reload, { delay: 400 });

  const activeCount =
    filters.status.length +
    filters.severity.length +
    ['category', 'building', 'from', 'to'].filter((k) => filters[k]).length;

  async function exportCsv() {
    setExporting(true);
    try {
      const { page: _p, limit: _l, sort: _s, ...rest } = query;
      await downloadIssuesCsv(rest);
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setExporting(false);
    }
  }

  const filterPanel = (
    <div className="grid grid-cols-1 gap-4 border-t border-border px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">Status</p>
          <ChipToggleGroup
            label="Status"
            values={filters.status}
            onChange={(v) => update({ status: v })}
            options={STATUS_ORDER.map((s) => ({
              value: s,
              label: STATUS[s].label,
              color: STATUS[s].color,
            }))}
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">Severity</p>
          <ChipToggleGroup
            label="Severity"
            values={filters.severity}
            onChange={(v) => update({ severity: v })}
            options={SEVERITY_ORDER.map((s) => ({
              value: s,
              label: SEVERITY[s].label,
              color: SEVERITY[s].color,
            }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wide text-muted uppercase">Category</span>
          <Select value={filters.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY[c].label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wide text-muted uppercase">Building</span>
          <Select value={filters.building} onChange={(e) => update({ building: e.target.value })}>
            <option value="">All buildings</option>
            {(buildings.data?.buildings ?? []).map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wide text-muted uppercase">From</span>
          <Input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => update({ from: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wide text-muted uppercase">To</span>
          <Input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => update({ to: e.target.value })}
          />
        </label>
      </div>
    </div>
  );

  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Issues"
        title="All issues"
        subtitle="Filter, search and triage every report on campus."
        actions={
          <Button variant="secondary" icon={Download} loading={exporting} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
          <form
            role="search"
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: search.trim() });
            }}
          >
            <label className="sr-only" htmlFor="issue-search">
              Search issues
            </label>
            <Input
              id="issue-search"
              icon={Search}
              placeholder="Search title, description or landmark"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => search.trim() !== filters.q && update({ q: search.trim() })}
            />
          </form>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="issue-sort">
              Sort
            </label>
            <Select
              id="issue-sort"
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value })}
              className="min-w-44"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="priority">Highest priority</option>
              <option value="due">Due soonest</option>
            </Select>
            <Button
              variant={showFilters ? 'primary' : 'secondary'}
              icon={SlidersHorizontal}
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
              aria-controls="issue-filters"
            >
              Filters{activeCount ? ` (${activeCount})` : ''}
            </Button>
          </div>
        </div>
        {showFilters ? <div id="issue-filters">{filterPanel}</div> : null}
        {activeCount || filters.q ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 text-sm sm:px-5">
            <Filter className="size-4 text-muted" aria-hidden />
            <span className="text-muted">
              {list.data ? `${list.data.total} matching` : 'Filtering'}
              {filters.q ? ` "${filters.q}"` : ''}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                update({
                  status: [],
                  severity: [],
                  category: '',
                  building: '',
                  from: '',
                  to: '',
                  q: '',
                });
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-bold text-primary hover:bg-surface-2"
            >
              <X className="size-3.5" aria-hidden /> Clear all
            </button>
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        {list.loading && !list.data ? (
          <SkeletonRows rows={8} className="p-5" />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.retry} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No issues match"
            body="Try removing a filter or searching for something else."
          />
        ) : (
          <>
            {/* Table from md up */}
            <div className="hidden max-h-[calc(100dvh-280px)] overflow-auto md:block">
              <table className="w-full border-separate border-spacing-0 text-left text-sm">
                <caption className="sr-only">Issues</caption>
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="text-xs font-bold tracking-wide text-muted uppercase">
                    <th scope="col" className="border-b border-border px-5 py-3">
                      Issue
                    </th>
                    <th scope="col" className="border-b border-border px-3 py-3">
                      Status
                    </th>
                    <th scope="col" className="border-b border-border px-3 py-3">
                      Severity
                    </th>
                    <th scope="col" className="border-b border-border px-3 py-3">
                      SLA
                    </th>
                    <th
                      scope="col"
                      className="hidden border-b border-border px-3 py-3 xl:table-cell"
                    >
                      Assignee
                    </th>
                    <th scope="col" className="border-b border-border px-3 py-3 text-right">
                      Reported
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((issue, i) => (
                    <motion.tr
                      key={issue.id}
                      {...stagger(i)}
                      onClick={() => navigate(`/issues/${issue.id}`)}
                      className="cursor-pointer hover:bg-surface-2"
                    >
                      <td className="border-b border-border px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Photo
                            path={issue.thumbPath}
                            alt=""
                            category={issue.category}
                            className="size-11 shrink-0 rounded-lg"
                          />
                          <div className="min-w-0">
                            <Link
                              to={`/issues/${issue.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block max-w-[34ch] truncate font-bold text-text hover:underline"
                            >
                              {issue.title}
                            </Link>
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                              <MapPin className="size-3" aria-hidden />
                              <span className="max-w-[28ch] truncate">{placeOf(issue)}</span>
                              <span aria-hidden>·</span>
                              {CATEGORY[issue.category]?.label}
                            </span>
                          </div>
                          <SupportersChip count={issue.supportersCount} />
                        </div>
                      </td>
                      <td className="border-b border-border px-3 py-3">
                        <StatusPill status={issue.status} />
                      </td>
                      <td className="border-b border-border px-3 py-3">
                        <SeverityPill severity={issue.severity} />
                      </td>
                      <td className="border-b border-border px-3 py-3">
                        <SlaChip issue={issue} />
                      </td>
                      <td className="hidden border-b border-border px-3 py-3 text-text xl:table-cell">
                        {issue.assignedTo?.name ?? <span className="text-muted">Unassigned</span>}
                      </td>
                      <td className="border-b border-border px-3 py-3 text-right text-muted whitespace-nowrap">
                        {timeAgo(issue.createdAt)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Cards below md */}
            <ul className="divide-y divide-border md:hidden">
              {items.map((issue, i) => (
                <motion.li key={issue.id} {...stagger(i)}>
                  <Link to={`/issues/${issue.id}`} className="flex gap-3 p-4 hover:bg-surface-2">
                    <Photo
                      path={issue.thumbPath}
                      alt=""
                      category={issue.category}
                      className="size-16 shrink-0 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold text-text">{issue.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {placeOf(issue)} · {timeAgo(issue.createdAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusPill status={issue.status} />
                        <SeverityPill severity={issue.severity} />
                        <SlaChip issue={issue} />
                      </div>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </ul>
            <div
              className={cn(
                'border-t border-border px-4 py-3 sm:px-5',
                list.loading && 'opacity-60',
              )}
            >
              <Pagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                total={list.data.total}
                label="issues"
                onPage={(p) => update({ page: p }, { resetPage: false })}
              />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
