import * as locations from '../services/locations.js';
import * as notifications from '../services/notifications.js';
import * as insights from '../services/insights.js';
import { issuesCsv } from '../services/export.js';
import { pageOf } from '../utils/paginate.js';
import { ApiError } from '../utils/ApiError.js';

// ---- locations
export async function listLocations(req, res) {
  const q = req.valid.query;
  const { items, total } = await locations.listLocations(q);
  res.json(pageOf(items, total, q));
}
export async function buildings(_req, res) {
  res.json({ buildings: await locations.buildings() });
}
export async function locationByCode(req, res) {
  res.json(await locations.byCode(req.valid.params.code));
}
export async function createLocation(req, res) {
  res.status(201).json(await locations.createLocation(req.body));
}
export async function updateLocation(req, res) {
  res.json(await locations.updateLocation(req.valid.params.id, req.body));
}

// ---- notifications
export async function listNotifications(req, res) {
  const q = req.valid.query;
  const { items, total, unreadCount } = await notifications.listForUser(req.user._id, q);
  res.json({ ...pageOf(items, total, q), unreadCount });
}
export async function readNotification(req, res) {
  const n = await notifications.markRead(req.user._id, req.valid.params.id);
  if (!n) throw ApiError.notFound('Notification not found');
  res.json(n);
}
export async function readAllNotifications(req, res) {
  res.json({ updated: await notifications.markAllRead(req.user._id) });
}

// ---- insights
export async function summary(_req, res) {
  res.json(await insights.summary());
}
export async function overview(req, res) {
  res.json(await insights.overview(req.valid.query));
}
export async function buildingHealth(_req, res) {
  res.json({ buildings: await insights.buildingHealth() });
}
export async function heatmap(req, res) {
  res.json({ points: await insights.heatmap(req.valid.query) });
}
export async function attention(_req, res) {
  res.json({ items: await insights.attention() });
}
export async function activity(req, res) {
  res.json({ items: await insights.activity(req.valid.query) });
}
export async function live(_req, res) {
  res.json(await insights.live());
}

// ---- export
export async function exportCsv(req, res) {
  const csv = await issuesCsv(req.user, req.valid.query);
  const stamp = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="fixit-issues-${stamp}.csv"`);
  res.send(csv);
}
