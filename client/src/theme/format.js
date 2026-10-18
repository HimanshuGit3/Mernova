const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 hours ago", "in 2 days", "just now" */
export function timeAgo(date, now = Date.now()) {
  if (!date) return '';
  const diff = (new Date(date).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  for (const [unit, secs] of UNITS) {
    if (abs >= secs || unit === 'minute') return rtf.format(Math.round(diff / secs), unit);
  }
  return '';
}

export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "2 h 15 m", "3 d 4 h", "45 m" */
export function formatDuration(ms) {
  const m = Math.max(0, Math.round(Math.abs(ms) / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d} d${h ? ` ${h} h` : ''}`;
  if (h > 0) return `${h} h${mm ? ` ${mm} m` : ''}`;
  return `${mm} m`;
}

export function formatHours(h) {
  if (h === null || h === undefined) return '—';
  if (h < 1) return `${Math.round(h * 60)} m`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round((h / 24) * 10) / 10} d`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function placeOf(issue) {
  const loc = issue?.locationRef;
  if (loc) return `${loc.code} · ${loc.building}`;
  if (issue?.landmark) return issue.landmark;
  if (issue?.location) return 'GPS location';
  return 'Campus';
}
