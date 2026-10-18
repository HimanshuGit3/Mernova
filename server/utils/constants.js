export const ROLES = ['student', 'technician', 'admin'];
export const CATEGORIES = [
  'electrical',
  'plumbing',
  'furniture',
  'network',
  'cleanliness',
  'safety',
  'other',
];
export const SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
  'reopened',
  'rejected',
];
export const TERMINAL_STATUSES = ['closed', 'rejected'];
/** Statuses where the SLA clock no longer runs. */
export const SLA_STOPPED = ['resolved', 'closed', 'rejected'];
export const ACTIVE_STATUSES = ['open', 'assigned', 'in_progress', 'reopened'];
export const NOTIFICATION_TYPES = [
  'issue_created',
  'issue_assigned',
  'status_changed',
  'sla_overdue',
  'me_too',
];
