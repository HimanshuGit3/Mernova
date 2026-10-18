import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { Notification } from '../models/Notification.js';
import { csvCell } from '../services/export.js';
import { healthScore } from '../services/insights.js';
import { api, makeUser } from './helpers.js';
import { makeIssue, makeLocation } from './fixtures.js';

const http = api(createApp({ authRateLimitMax: 1000 }));
let admin, student, tech;

beforeAll(async () => {
  admin = await makeUser({ role: 'admin', name: 'Res Admin' });
  student = await makeUser({ name: 'Res Student' });
  tech = await makeUser({ role: 'technician', name: 'Res Tech', skills: ['plumbing'] });
});

describe('locations (FR-53)', () => {
  let created;

  it('admin creates a location; code is normalised and has QR content', async () => {
    const res = await http.post('/api/locations', admin.token).send({
      code: 'lib-101',
      building: 'Library',
      floor: '1',
      room: '101',
      label: 'Reading hall',
      lat: 13.171,
      lng: 77.536,
    });
    expect(res.status).toBe(201);
    created = res.body;
    expect(created).toMatchObject({
      code: 'LIB-101',
      qr: 'FIXIT:LOC:LIB-101',
      lat: 13.171,
      lng: 77.536,
      isActive: true,
    });
  });

  it('rejects a duplicate code (409) and bad input (400)', async () => {
    const dup = await http
      .post('/api/locations', admin.token)
      .send({ code: 'LIB-101', building: 'Library', lat: 13.1, lng: 77.5 });
    expect(dup.status).toBe(409);
    const bad = await http
      .post('/api/locations', admin.token)
      .send({ code: 'bad code!', building: '', lat: 200, lng: 77.5 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.map((d) => d.path)).toEqual(
      expect.arrayContaining(['code', 'building', 'lat']),
    );
  });

  it('students cannot create locations (403)', async () => {
    const res = await http
      .post('/api/locations', student.token)
      .send({ code: 'X-1', building: 'X', lat: 1, lng: 1 });
    expect(res.status).toBe(403);
  });

  it('looks up by bare code or by full QR content', async () => {
    const bare = await http.get('/api/locations/code/lib-101', student.token);
    expect(bare.status).toBe(200);
    expect(bare.body.id).toBe(created.id);
    const qr = await http.get(
      `/api/locations/code/${encodeURIComponent('FIXIT:LOC:LIB-101')}`,
      student.token,
    );
    expect(qr.status).toBe(200);
    expect((await http.get('/api/locations/code/NOPE-1', student.token)).status).toBe(404);
  });

  it('an inactive location cannot be looked up (404) but is still listed for admins', async () => {
    const res = await http
      .patch(`/api/locations/${created.id}`, admin.token)
      .send({ isActive: false, label: 'Closed for works' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isActive: false, label: 'Closed for works', floor: '1' });
    expect((await http.get('/api/locations/code/LIB-101', student.token)).status).toBe(404);
    const list = await http.get('/api/locations?active=false', admin.token);
    expect(list.body.items.map((l) => l.code)).toContain('LIB-101');
  });

  it('lists buildings and filters locations', async () => {
    await makeLocation({ code: 'HOS-1', building: 'Hostel' });
    const b = await http.get('/api/locations/buildings', student.token);
    expect(b.body.buildings).toContain('Hostel');
    const filtered = await http.get('/api/locations?building=Hostel', student.token);
    expect(filtered.body.items.every((l) => l.building === 'Hostel')).toBe(true);
    const search = await http.get('/api/locations?q=hos', student.token);
    expect(search.body.items.map((l) => l.code)).toContain('HOS-1');
  });

  it('moves a location', async () => {
    const res = await http.patch(`/api/locations/${created.id}`, admin.token).send({ lat: 13.2 });
    expect(res.body).toMatchObject({ lat: 13.2, lng: 77.536 });
  });
});

describe('notifications inbox (FR-50)', () => {
  let mine, theirs;
  beforeAll(async () => {
    mine = await Notification.create({
      user: student.user._id,
      type: 'status_changed',
      title: 'Hello',
      body: 'World',
    });
    await Notification.create({ user: student.user._id, type: 'me_too', title: 'Second' });
    theirs = await Notification.create({
      user: tech.user._id,
      type: 'issue_assigned',
      title: 'Job',
    });
  });

  it('lists only my notifications, newest first, with an unread count', async () => {
    const res = await http.get('/api/notifications', student.token);
    expect(res.status).toBe(200);
    expect(res.body.items.map((n) => n.title)).toEqual(['Second', 'Hello']);
    expect(res.body.unreadCount).toBe(2);
    expect(res.body.items.every((n) => n.user === student.id)).toBe(true);
  });

  it("marks one as read; someone else's is 404", async () => {
    const res = await http.post(`/api/notifications/${mine.id}/read`, student.token);
    expect(res.status).toBe(200);
    expect(res.body.readAt).toBeTruthy();
    expect((await http.post(`/api/notifications/${theirs.id}/read`, student.token)).status).toBe(
      404,
    );
    const unread = await http.get('/api/notifications?unread=true', student.token);
    expect(unread.body.items.map((n) => n.title)).toEqual(['Second']);
    expect(unread.body.unreadCount).toBe(1);
  });

  it('marks all as read', async () => {
    const res = await http.post('/api/notifications/read-all', student.token);
    expect(res.body.updated).toBe(1);
    expect((await http.get('/api/notifications', student.token)).body.unreadCount).toBe(0);
  });
});

describe('insights (FR-30, FR-32, FR-56)', () => {
  beforeAll(async () => {
    const room = await makeLocation({ code: 'INS-1', building: 'Insight Block' });
    const day = 24 * 36e5;
    await makeIssue(student.user, {
      title: '=HYPERLINK("http://evil")',
      category: 'plumbing',
      severity: 'critical',
      locationRef: room._id,
      point: { type: 'Point', coordinates: [77.5, 13.1] },
      createdAt: new Date(Date.now() - 3 * day),
      dueAt: new Date(Date.now() - 2 * day),
    });
    await makeIssue(student.user, {
      title: 'Resolved, quickly',
      status: 'resolved',
      category: 'electrical',
      locationRef: room._id,
      resolvedAt: new Date(Date.now() - day + 36e5),
      resolutionPhotoPath: '/uploads/x.jpg',
      createdAt: new Date(Date.now() - day),
    });
  });

  it('are admin-only', async () => {
    for (const path of [
      'summary',
      'overview',
      'buildings',
      'heatmap',
      'attention',
      'activity',
      'live',
    ]) {
      expect((await http.get(`/api/insights/${path}`, student.token)).status).toBe(403);
    }
    expect((await http.get('/api/export/issues.csv', tech.token)).status).toBe(403);
  });

  it('summary has the 4 KPI cards, deltas and 14-day sparklines', async () => {
    const res = await http.get('/api/insights/summary', admin.token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      open: expect.any(Number),
      overdue: expect.any(Number),
      resolvedThisWeek: expect.any(Number),
    });
    expect(res.body.overdue).toBeGreaterThanOrEqual(1);
    expect(res.body.resolvedThisWeek).toBeGreaterThanOrEqual(1);
    expect(res.body.avgResolutionHours).toBeCloseTo(1, 1); // created 24 h ago, resolved 23 h ago
    expect(res.body.sparklines.open).toHaveLength(14);
    expect(res.body.sparklines.days).toHaveLength(14);
  });

  it('overview counts by status/category with daily trends', async () => {
    const res = await http.get('/api/insights/overview?days=7', admin.token);
    expect(res.body.byCategory.plumbing).toBeGreaterThanOrEqual(1);
    expect(Object.keys(res.body.byStatus)).toHaveLength(7);
    expect(res.body.createdTrend).toHaveLength(7);
    expect(res.body.resolutionTrend.some((d) => d.resolved > 0)).toBe(true);
    expect((await http.get('/api/insights/overview?days=0', admin.token)).status).toBe(400);
  });

  it('building health scores penalise overdue work', async () => {
    const res = await http.get('/api/insights/buildings', admin.token);
    const b = res.body.buildings.find((x) => x.building === 'Insight Block');
    expect(b).toMatchObject({ open: 1, overdue: 1, resolved30d: 1 });
    expect(b.score).toBe(healthScore(b));
    expect(b.score).toBeLessThan(100);
    expect(healthScore({ open: 0, overdue: 0, avgResolutionHours: null })).toBe(100);
    expect(healthScore({ open: 30, overdue: 10, avgResolutionHours: 500 })).toBe(0);
  });

  it('attention lists overdue/critical issues; heatmap returns weighted points; live has no personal data', async () => {
    const att = await http.get('/api/insights/attention', admin.token);
    expect(att.body.items.length).toBeGreaterThan(0);
    expect(att.body.items.every((i) => i.overdue || i.severity === 'critical')).toBe(true);
    const heat = await http.get('/api/insights/heatmap', admin.token);
    expect(heat.body.points).toContainEqual([13.1, 77.5, 1]);
    const live = await http.get('/api/insights/live', admin.token);
    expect(live.body.counters).toHaveProperty('openNow');
    expect(JSON.stringify(live.body)).not.toContain('Res Student');
    const activity = await http.get('/api/insights/activity?limit=5', admin.token);
    expect(activity.body.items.length).toBeLessThanOrEqual(5);
  });
});

describe('CSV export (FR-56)', () => {
  it('escapes cells and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(null)).toBe('');
  });

  it('downloads the filtered issues as CSV', async () => {
    const res = await http.get('/api/export/issues.csv?category=plumbing', admin.token);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="fixit-issues-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    expect(res.text.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM for Excel
    const lines = res.text.slice(1).trim().split('\r\n');
    expect(lines[0].split(',')).toEqual(
      expect.arrayContaining(['id', 'title', 'category', 'status', 'building', 'overdue']),
    );
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.slice(1).every((l) => l.includes(',plumbing,'))).toBe(true);
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });
});
