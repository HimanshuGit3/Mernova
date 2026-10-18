import { Issue } from '../models/Issue.js';
import { Location } from '../models/Location.js';
import { ACTIVE_STATUSES, CATEGORIES, SEVERITIES, STATUSES } from '../utils/constants.js';
import { POPULATE, toSummary } from './issueView.js';

/** Campus time zone for "per day" buckets (Bengaluru). */
export const TZ = 'Asia/Kolkata';
const HOUR = 36e5;
const DAY = 24 * HOUR;

const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

function lastDays(n, now = new Date()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) keys.push(dayKey(now.getTime() - i * DAY));
  return keys;
}

/** Midnight today in campus time, as a Date. */
export function startOfToday(now = new Date()) {
  const key = dayKey(now);
  return new Date(`${key}T00:00:00+05:30`);
}

const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);
const resolutionHoursExpr = { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, HOUR] };

async function perDay(match, dateField, since, extra = {}) {
  const rows = await Issue.aggregate([
    { $match: { ...match, [dateField]: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}`, timezone: TZ } },
        n: { $sum: 1 },
        ...extra,
      },
    },
  ]);
  return new Map(rows.map((r) => [r._id, r]));
}

async function avgResolution(from, to) {
  const [row] = await Issue.aggregate([
    { $match: { resolvedAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, avg: { $avg: resolutionHoursExpr } } },
  ]);
  return row ? round1(row.avg) : null;
}

/** Dashboard KPI cards with week-over-week deltas and 14-day sparklines (FR-30). */
export async function summary(now = new Date()) {
  const weekAgo = new Date(now - 7 * DAY);
  const twoWeeksAgo = new Date(now - 14 * DAY);
  const range = (field, from, to) => ({ [field]: { $gte: from, $lt: to } });
  const [
    open,
    overdue,
    createdThis,
    createdPrev,
    escThis,
    escPrev,
    resolvedThis,
    resolvedPrev,
    avgThis,
    avgPrev,
  ] = await Promise.all([
    Issue.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
    Issue.countDocuments({ status: { $in: ACTIVE_STATUSES }, dueAt: { $lt: now } }),
    Issue.countDocuments(range('createdAt', weekAgo, now)),
    Issue.countDocuments(range('createdAt', twoWeeksAgo, weekAgo)),
    Issue.countDocuments(range('escalatedAt', weekAgo, now)),
    Issue.countDocuments(range('escalatedAt', twoWeeksAgo, weekAgo)),
    Issue.countDocuments(range('resolvedAt', weekAgo, now)),
    Issue.countDocuments(range('resolvedAt', twoWeeksAgo, weekAgo)),
    avgResolution(weekAgo, now),
    avgResolution(twoWeeksAgo, weekAgo),
  ]);

  const since = new Date(now - 14 * DAY);
  const [created, escalated, resolved] = await Promise.all([
    perDay({}, 'createdAt', since),
    perDay({}, 'escalatedAt', since),
    perDay({}, 'resolvedAt', since, { avg: { $avg: resolutionHoursExpr } }),
  ]);
  const days = lastDays(14, now);
  return {
    open,
    overdue,
    resolvedThisWeek: resolvedThis,
    avgResolutionHours: avgThis,
    deltas: {
      open: createdThis - createdPrev,
      overdue: escThis - escPrev,
      resolvedThisWeek: resolvedThis - resolvedPrev,
      avgResolutionHours: avgThis !== null && avgPrev !== null ? round1(avgThis - avgPrev) : null,
    },
    sparklines: {
      days,
      open: days.map((d) => created.get(d)?.n ?? 0),
      overdue: days.map((d) => escalated.get(d)?.n ?? 0),
      resolvedThisWeek: days.map((d) => resolved.get(d)?.n ?? 0),
      avgResolutionHours: days.map((d) => round1(resolved.get(d)?.avg) ?? 0),
    },
  };
}

async function countBy(field, match) {
  const rows = await Issue.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

const zeroed = (keys, counts) => Object.fromEntries(keys.map((k) => [k, counts[k] ?? 0]));

/** Counts by status/category/severity and daily trends over a window (FR-32). */
export async function overview({ days = 30 } = {}, now = new Date()) {
  const since = new Date(now - days * DAY);
  const match = { createdAt: { $gte: since } };
  const [byStatus, byCategory, bySeverity, created, resolved] = await Promise.all([
    countBy('status', match),
    countBy('category', match),
    countBy('severity', match),
    perDay({}, 'createdAt', since),
    perDay({}, 'resolvedAt', since, { avg: { $avg: resolutionHoursExpr } }),
  ]);
  const keys = lastDays(days, now);
  return {
    days,
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    byStatus: zeroed(STATUSES, byStatus),
    byCategory: zeroed(CATEGORIES, byCategory),
    bySeverity: zeroed(SEVERITIES, bySeverity),
    createdTrend: keys.map((date) => ({ date, count: created.get(date)?.n ?? 0 })),
    resolutionTrend: keys.map((date) => ({
      date,
      resolved: resolved.get(date)?.n ?? 0,
      avgHours: round1(resolved.get(date)?.avg) ?? null,
    })),
  };
}

/**
 * Building health score (FR-56), 0–100, higher is healthier:
 *   100 − 10 × overdue − 3 × open (max −45) − slow-fix penalty (avg resolution above 24 h, −1 per 4 h, max −20)
 */
export function healthScore({ open, overdue, avgResolutionHours }) {
  const slow = avgResolutionHours ? Math.min(20, Math.max(0, (avgResolutionHours - 24) / 4)) : 0;
  const score = 100 - 10 * overdue - Math.min(45, 3 * open) - slow;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function buildingHealth(now = new Date()) {
  const since = new Date(now - 30 * DAY);
  const rows = await Issue.aggregate([
    { $match: { locationRef: { $ne: null } } },
    { $lookup: { from: 'locations', localField: 'locationRef', foreignField: '_id', as: 'loc' } },
    { $unwind: '$loc' },
    {
      $group: {
        _id: '$loc.building',
        open: { $sum: { $cond: [{ $in: ['$status', ACTIVE_STATUSES] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              { $and: [{ $in: ['$status', ACTIVE_STATUSES] }, { $lt: ['$dueAt', now] }] },
              1,
              0,
            ],
          },
        },
        resolved30d: { $sum: { $cond: [{ $gte: ['$resolvedAt', since] }, 1, 0] } },
        total30d: { $sum: { $cond: [{ $gte: ['$createdAt', since] }, 1, 0] } },
        avgRes: {
          $avg: { $cond: [{ $gte: ['$resolvedAt', since] }, resolutionHoursExpr, null] },
        },
      },
    },
  ]);
  const byName = new Map(rows.map((r) => [r._id, r]));
  const names = await Location.distinct('building');
  return names
    .map((building) => {
      const r = byName.get(building) ?? {
        open: 0,
        overdue: 0,
        resolved30d: 0,
        total30d: 0,
        avgRes: null,
      };
      const item = {
        building,
        open: r.open,
        overdue: r.overdue,
        resolved30d: r.resolved30d,
        reported30d: r.total30d,
        avgResolutionHours: round1(r.avgRes),
      };
      return { ...item, score: healthScore(item) };
    })
    .sort((a, b) => a.score - b.score || a.building.localeCompare(b.building));
}

const SEVERITY_HEAT = { low: 0.35, medium: 0.55, high: 0.8, critical: 1 };

export async function heatmap({ days = 30 } = {}, now = new Date()) {
  const docs = await Issue.find({
    createdAt: { $gte: new Date(now - days * DAY) },
    point: { $exists: true },
  })
    .select('point severity')
    .lean();
  return docs.map((d) => [
    d.point.coordinates[1],
    d.point.coordinates[0],
    SEVERITY_HEAT[d.severity],
  ]);
}

/** Overdue or critical active issues, highest priority first (dashboard "Needs attention"). */
export async function attention(now = new Date()) {
  const docs = await Issue.find({
    status: { $in: ACTIVE_STATUSES },
    $or: [{ dueAt: { $lt: now } }, { severity: 'critical' }],
  })
    .sort({ priorityScore: -1, dueAt: 1 })
    .limit(10)
    .populate(POPULATE);
  return docs.map((d) => toSummary(d, 'admin', now));
}

/** Recent status changes across campus (admin activity feed). */
export async function activity({ limit = 20 } = {}) {
  const rows = await Issue.aggregate([
    { $unwind: '$statusHistory' },
    { $sort: { 'statusHistory.at': -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'statusHistory.changedBy',
        foreignField: '_id',
        as: 'actor',
      },
    },
    { $lookup: { from: 'locations', localField: 'locationRef', foreignField: '_id', as: 'loc' } },
    {
      $project: {
        issueId: '$_id',
        title: 1,
        category: 1,
        severity: 1,
        status: '$statusHistory.status',
        at: '$statusHistory.at',
        note: '$statusHistory.note',
        actor: { $arrayElemAt: ['$actor', 0] },
        loc: { $arrayElemAt: ['$loc', 0] },
      },
    },
  ]);
  return rows.map((r) => ({
    issueId: String(r.issueId),
    title: r.title,
    category: r.category,
    severity: r.severity,
    status: r.status,
    at: r.at,
    note: r.note,
    building: r.loc?.building ?? null,
    actor: r.actor ? { name: r.actor.name, role: r.actor.role } : 'system',
  }));
}

const LIVE_KIND = {
  open: 'reported',
  resolved: 'fixed',
  closed: 'confirmed',
  in_progress: 'started',
  assigned: 'assigned',
  reopened: 'reopened',
  rejected: 'rejected',
};

/** Live Booth snapshot (FR-55). Contains no personal data. */
export async function live(now = new Date()) {
  const today = startOfToday(now);
  const [
    reportedToday,
    resolvedToday,
    openNow,
    avgResolutionHours,
    total,
    fixedTotal,
    events,
    pins,
  ] = await Promise.all([
    Issue.countDocuments({ createdAt: { $gte: today } }),
    Issue.countDocuments({ resolvedAt: { $gte: today } }),
    Issue.countDocuments({ status: { $in: ACTIVE_STATUSES } }),
    avgResolution(new Date(now - 7 * DAY), now),
    Issue.countDocuments({}),
    Issue.countDocuments({ status: { $in: ['resolved', 'closed'] } }),
    activity({ limit: 30 }),
    Issue.find({
      point: { $exists: true },
      $or: [{ status: { $in: ACTIVE_STATUSES } }, { resolvedAt: { $gte: new Date(now - DAY) } }],
    })
      .select('point status category severity createdAt')
      .sort({ createdAt: -1 })
      .limit(300)
      .lean(),
  ]);
  return {
    counters: { reportedToday, resolvedToday, openNow, avgResolutionHours, total, fixedTotal },
    feed: events
      .filter((e) => ['open', 'resolved', 'closed', 'in_progress'].includes(e.status))
      .slice(0, 15)
      .map((e) => ({
        issueId: e.issueId,
        kind: LIVE_KIND[e.status],
        title: e.title,
        category: e.category,
        building: e.building,
        at: e.at,
      })),
    pins: pins.map((p) => ({
      id: String(p._id),
      lat: p.point.coordinates[1],
      lng: p.point.coordinates[0],
      status: p.status,
      category: p.category,
      severity: p.severity,
      createdAt: p.createdAt,
    })),
  };
}
