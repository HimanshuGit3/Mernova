import { Zap, Droplets, Armchair, Wifi, Trash2, ShieldAlert, CircleHelp } from 'lucide-react';

/** Labels, colours and icons shared by every screen (SPEC 8.1). Colours match the tokens in index.css. */

export const STATUS = {
  open: { label: 'Open', color: '#3B7BD0' },
  assigned: { label: 'Assigned', color: '#7C5CD6' },
  in_progress: { label: 'In progress', color: '#E0A030' },
  resolved: { label: 'Resolved', color: '#1F9E89' },
  closed: { label: 'Closed', color: '#64748B' },
  reopened: { label: 'Reopened', color: '#E2654B' },
  rejected: { label: 'Rejected', color: '#9CA3AF' },
};
export const STATUS_ORDER = Object.keys(STATUS);
export const ACTIVE_STATUSES = ['open', 'assigned', 'in_progress', 'reopened'];

export const SEVERITY = {
  low: { label: 'Low', color: '#64748B' },
  medium: { label: 'Medium', color: '#3B7BD0' },
  high: { label: 'High', color: '#E0A030' },
  critical: { label: 'Critical', color: '#DC2626' },
};
export const SEVERITY_ORDER = Object.keys(SEVERITY);

export const CATEGORY = {
  electrical: { label: 'Electrical', icon: Zap, color: '#E0A030', colorDark: '#C0841C' },
  plumbing: { label: 'Plumbing', icon: Droplets, color: '#3B7BD0' },
  furniture: { label: 'Furniture', icon: Armchair, color: '#B5651D' },
  network: { label: 'Network', icon: Wifi, color: '#7C5CD6' },
  cleanliness: { label: 'Cleanliness', icon: Trash2, color: '#1F9E89' },
  safety: { label: 'Safety', icon: ShieldAlert, color: '#DC2626' },
  other: { label: 'Other', icon: CircleHelp, color: '#D6409F' },
};
export const CATEGORY_ORDER = Object.keys(CATEGORY);

export const ROLE_LABEL = { student: 'Student', technician: 'Technician', admin: 'Admin' };

/** Action labels for status transitions (allowedActions from the API). */
export const ACTION = {
  in_progress: { label: 'Start work' },
  resolved: { label: 'Mark resolved' },
  closed: { label: 'Confirm fix' },
  reopened: { label: 'Reopen' },
  rejected: { label: 'Reject' },
};

/**
 * Category colour for charts. The categorical palette is validated (dataviz validator:
 * lightness band, chroma, CVD and normal-vision separation) separately for each surface,
 * so dark mode has its own amber step instead of an automatic flip.
 */
export function categoryColor(category, theme = 'light') {
  const c = CATEGORY[category] ?? CATEGORY.other;
  return theme === 'dark' && c.colorDark ? c.colorDark : c.color;
}
