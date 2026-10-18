import { Issue } from '../models/Issue.js';
import { buildListFilter } from './issues.js';
import { isOverdue } from './sla.js';

export const EXPORT_MAX_ROWS = 5000;
const BOM = String.fromCharCode(0xfeff);

const COLUMNS = [
  'id',
  'title',
  'category',
  'severity',
  'status',
  'building',
  'room',
  'locationCode',
  'landmark',
  'latitude',
  'longitude',
  'reporter',
  'assignedTo',
  'supporters',
  'priorityScore',
  'overdue',
  'createdAt',
  'dueAt',
  'resolvedAt',
  'closedAt',
  'resolutionHours',
];

/**
 * Quote a CSV cell (RFC 4180) and neutralise spreadsheet formulas: a cell that starts
 * with = + - @ (or tab/CR) would be executed by Excel, so it is prefixed with a quote.
 */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function issuesCsv(admin, query) {
  const filter = await buildListFilter(admin, query);
  const docs = await Issue.find(filter)
    .sort({ createdAt: -1 })
    .limit(EXPORT_MAX_ROWS)
    .populate([
      { path: 'locationRef', select: 'code building room' },
      { path: 'reportedBy', select: 'name' },
      { path: 'assignedTo', select: 'name' },
    ])
    .lean();
  const now = new Date();
  const lines = [COLUMNS.join(',')];
  for (const d of docs) {
    const resolutionHours = d.resolvedAt
      ? ((new Date(d.resolvedAt) - new Date(d.createdAt)) / 36e5).toFixed(1)
      : '';
    const row = [
      d._id,
      d.title,
      d.category,
      d.severity,
      d.status,
      d.locationRef?.building,
      d.locationRef?.room,
      d.locationRef?.code,
      d.landmark,
      d.point?.coordinates?.[1],
      d.point?.coordinates?.[0],
      d.reportedBy?.name,
      d.assignedTo?.name,
      d.supporters?.length ?? 0,
      d.priorityScore,
      isOverdue(d, now) ? 'yes' : 'no',
      d.createdAt,
      d.dueAt,
      d.resolvedAt,
      d.closedAt,
      resolutionHours,
    ];
    lines.push(row.map(csvCell).join(','));
  }
  // BOM so Excel opens UTF-8 correctly; CRLF line endings per RFC 4180.
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
