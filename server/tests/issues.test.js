import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { createApp } from '../app.js';
import { Issue } from '../models/Issue.js';
import { Notification } from '../models/Notification.js';
import { absolutePathOf } from '../services/storage.js';
import { api, makeUser } from './helpers.js';
import { jpeg, png, PDF, makeLocation, makeIssue } from './fixtures.js';

const app = createApp({ authRateLimitMax: 1000 });
const http = api(app);

let admin, tech, tech2, inactiveTech, alice, bob, room;

beforeAll(async () => {
  admin = await makeUser({ role: 'admin', name: 'Admin' });
  tech = await makeUser({
    role: 'technician',
    name: 'Tech One',
    skills: ['electrical', 'network'],
  });
  tech2 = await makeUser({ role: 'technician', name: 'Tech Two', skills: ['electrical'] });
  inactiveTech = await makeUser({
    role: 'technician',
    name: 'Gone Tech',
    skills: ['electrical'],
    isActive: false,
  });
  alice = await makeUser({ name: 'Alice Student' });
  bob = await makeUser({ name: 'Bob Student' });
  room = await makeLocation({
    code: 'B-204',
    building: 'Block B',
    room: '204',
    lat: 13.1721,
    lng: 77.5365,
  });
});

/** Report an issue as `who` through the API. */
async function report(who, fields = {}, photo) {
  const req = http.post('/api/issues', who.token);
  const body = {
    title: 'Projector flickering in B-204',
    category: 'electrical',
    severity: 'high',
    lat: 13.1718,
    lng: 77.5362,
    ...fields,
  };
  for (const [k, v] of Object.entries(body)) if (v !== undefined) req.field(k, String(v));
  if (photo !== null)
    req.attach('photo', photo ?? (await jpeg()), {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    });
  return req;
}

describe('create issue (FR-10, FR-14)', () => {
  it('creates an issue with a photo, thumbnail, SLA and history', async () => {
    const res = await report(
      alice,
      { description: 'Flickers every few seconds' },
      await jpeg({ width: 2400, height: 1800 }),
    );
    expect(res.status).toBe(201);
    const issue = res.body;
    expect(issue).toMatchObject({
      status: 'open',
      category: 'electrical',
      severity: 'high',
      reportedByMe: true,
    });
    expect(issue.photoPath).toMatch(/^\/uploads\/\d{4}\/\d{2}\/[a-f0-9]{32}\.jpg$/);
    expect(issue.thumbPath).toMatch(/_thumb\.jpg$/);
    expect(issue.location).toEqual({ lat: 13.1718, lng: 77.5362 });
    expect(new Date(issue.dueAt) - new Date(issue.createdAt)).toBe(24 * 36e5);
    expect(issue.priorityScore).toBe(60);
    expect(issue.statusHistory).toHaveLength(1);
    expect(issue).not.toHaveProperty('embedding');
    // the stored photo is re-encoded and resized to max 1600 px; the thumbnail to 400 px
    const sharp = (await import('sharp')).default;
    const meta = await sharp(absolutePathOf(issue.photoPath)).metadata();
    expect(Math.max(meta.width, meta.height)).toBe(1600);
    const thumb = await sharp(absolutePathOf(issue.thumbPath)).metadata();
    expect(Math.max(thumb.width, thumb.height)).toBe(400);
    // the photo is served
    const img = await http.get(issue.photoPath);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
  });

  it('accepts PNG and re-encodes it as JPEG', async () => {
    const res = await report(alice, {}, await png());
    expect(res.status).toBe(201);
    expect(fs.existsSync(absolutePathOf(res.body.photoPath))).toBe(true);
    expect(res.body.photoPath).toMatch(/\.jpg$/);
  });

  it('rejects a PDF sent as a photo (400), even when it claims to be a JPEG', async () => {
    const asPdf = await http
      .post('/api/issues', alice.token)
      .field('title', 'Not a photo')
      .field('category', 'other')
      .field('landmark', 'Library')
      .attach('photo', PDF, { filename: 'doc.pdf', contentType: 'application/pdf' });
    expect(asPdf.status).toBe(400);
    expect(asPdf.body.error.code).toBe('INVALID_FILE');
    const disguised = await http
      .post('/api/issues', alice.token)
      .field('title', 'Not a photo')
      .field('category', 'other')
      .field('landmark', 'Library')
      .attach('photo', PDF, { filename: 'doc.jpg', contentType: 'image/jpeg' });
    expect(disguised.status).toBe(400);
    expect(disguised.body.error.code).toBe('INVALID_FILE');
  });

  it('rejects a photo over 5 MB (400)', async () => {
    const big = Buffer.concat([await jpeg(), Buffer.alloc(5 * 1024 * 1024 + 10)]);
    const res = await report(alice, {}, big);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('validates fields (400 with details)', async () => {
    const res = await report(alice, { title: 'x', category: 'bogus', severity: 'urgent' });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'category', 'severity']));
  });

  it('requires a landmark without GPS or a room', async () => {
    const res = await report(alice, { lat: undefined, lng: undefined }, null);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain('landmark');
    const ok = await report(
      alice,
      { lat: undefined, lng: undefined, landmark: 'Behind the canteen' },
      null,
    );
    expect(ok.status).toBe(201);
    expect(ok.body.location).toBeNull();
  });

  it('uses the room point when a location is given (web typed location)', async () => {
    const res = await report(
      alice,
      { lat: undefined, lng: undefined, locationId: String(room._id) },
      null,
    );
    expect(res.status).toBe(201);
    expect(res.body.locationRef).toMatchObject({ code: 'B-204', building: 'Block B' });
    expect(res.body.location).toEqual({ lat: 13.1721, lng: 77.5365 });
  });

  it('rejects an inactive location', async () => {
    const closedRoom = await makeLocation({ isActive: false });
    const res = await report(alice, { locationId: String(closedRoom._id) });
    expect(res.status).toBe(400);
  });

  it('technicians cannot report issues (403)', async () => {
    expect((await report(tech)).status).toBe(403);
  });

  it('records the AI suggestion and whether it was accepted', async () => {
    const res = await report(alice, {
      category: 'network',
      aiSuggestedCategory: 'electrical',
      aiConfidence: 0.71,
    });
    expect(res.body.ai).toEqual({
      suggestedCategory: 'electrical',
      confidence: 0.71,
      accepted: false,
    });
  });

  it('notifies every active admin about a new issue', async () => {
    const before = await Notification.countDocuments({
      user: admin.user._id,
      type: 'issue_created',
    });
    await report(bob);
    const after = await Notification.countDocuments({
      user: admin.user._id,
      type: 'issue_created',
    });
    expect(after).toBe(before + 1);
  });
});

describe('idempotent retries (FR-58)', () => {
  it('the same clientRequestId twice creates one issue and returns it again', async () => {
    const clientRequestId = '7f1d2c3b-4a5e-4f60-8a9b-0c1d2e3f4a5b';
    const first = await report(alice, { clientRequestId, title: 'Offline report' });
    expect(first.status).toBe(201);
    const second = await report(alice, { clientRequestId, title: 'Offline report' });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(await Issue.countDocuments({ clientRequestId })).toBe(1);
  });

  it("another user cannot reuse someone else's clientRequestId (409)", async () => {
    const clientRequestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expect((await report(alice, { clientRequestId })).status).toBe(201);
    const res = await report(bob, { clientRequestId });
    expect(res.status).toBe(409);
  });

  it('concurrent retries still create exactly one issue', async () => {
    const clientRequestId = 'cccccccc-dddd-4eee-8fff-000000000000';
    const results = await Promise.all([
      report(alice, { clientRequestId }),
      report(alice, { clientRequestId }),
      report(alice, { clientRequestId }),
    ]);
    expect(results.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await Issue.countDocuments({ clientRequestId })).toBe(1);
  });
});

describe('visibility (SPEC 5)', () => {
  let alicesIssue;
  beforeAll(async () => {
    alicesIssue = (await report(alice, { title: 'Alice private issue' })).body;
  });

  it('the reporter sees their issue', async () => {
    expect((await http.get(`/api/issues/${alicesIssue.id}`, alice.token)).status).toBe(200);
  });

  it('another student gets 404', async () => {
    const res = await http.get(`/api/issues/${alicesIssue.id}`, bob.token);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('an unassigned technician gets 404; the admin sees it with the reporter', async () => {
    expect((await http.get(`/api/issues/${alicesIssue.id}`, tech.token)).status).toBe(404);
    const res = await http.get(`/api/issues/${alicesIssue.id}`, admin.token);
    expect(res.status).toBe(200);
    expect(res.body.reporter.name).toBe('Alice Student');
  });

  it('a nonexistent id is 404 and a malformed id is 400', async () => {
    expect((await http.get('/api/issues/0123456789abcdef01234567', admin.token)).status).toBe(404);
    expect((await http.get('/api/issues/xyz', admin.token)).status).toBe(400);
  });

  it('lists are scoped: a student only sees their own reports', async () => {
    const res = await http.get('/api/issues?limit=50', bob.token);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((i) => i.reportedByMe || i.supportedByMe)).toBe(true);
    expect(res.body.items.find((i) => i.id === alicesIssue.id)).toBeUndefined();
  });

  it("a student never sees another reporter's identity, even as a supporter", async () => {
    const sup = await http.post(`/api/issues/${alicesIssue.id}/support`, bob.token);
    expect(sup.status).toBe(200);
    expect(sup.body.supportedByMe).toBe(true);
    expect(sup.body).not.toHaveProperty('reporter');
    const detail = await http.get(`/api/issues/${alicesIssue.id}`, bob.token);
    expect(detail.status).toBe(200); // supporters can see the issue
    expect(detail.body).not.toHaveProperty('reporter');
    expect(detail.body.statusHistory[0].changedBy).toEqual({ role: 'student' });
  });

  it('unauthenticated requests are 401', async () => {
    expect((await http.get('/api/issues')).status).toBe(401);
  });
});

describe('list filters, search, sort and pagination (FR-31)', () => {
  let filterAdmin;
  beforeAll(async () => {
    // a dedicated reporter so counts are predictable
    filterAdmin = admin;
    const s = await makeUser({ name: 'Filter Student' });
    const day = 24 * 36e5;
    await makeIssue(s.user, {
      title: 'Water leak in washroom',
      category: 'plumbing',
      severity: 'critical',
      createdAt: new Date(Date.now() - 2 * day),
    });
    await makeIssue(s.user, {
      title: 'Broken chair',
      category: 'furniture',
      severity: 'low',
      createdAt: new Date(Date.now() - 20 * day),
    });
    await makeIssue(s.user, {
      title: 'Wi-Fi dead zone',
      category: 'network',
      severity: 'medium',
      locationRef: room._id,
      createdAt: new Date(Date.now() - 1 * day),
    });
  });

  it('filters by status, category and severity (comma lists)', async () => {
    const res = await http.get(
      '/api/issues?category=plumbing,furniture&limit=50',
      filterAdmin.token,
    );
    expect(res.body.items.every((i) => ['plumbing', 'furniture'].includes(i.category))).toBe(true);
    const crit = await http.get('/api/issues?severity=critical', filterAdmin.token);
    expect(crit.body.items.every((i) => i.severity === 'critical')).toBe(true);
    const bad = await http.get('/api/issues?status=bogus', filterAdmin.token);
    expect(bad.status).toBe(400);
  });

  it('filters by building and date range', async () => {
    const byBuilding = await http.get('/api/issues?building=Block%20B&limit=50', filterAdmin.token);
    expect(byBuilding.body.items.length).toBeGreaterThan(0);
    expect(byBuilding.body.items.every((i) => i.locationRef?.building === 'Block B')).toBe(true);
    const from = new Date(Date.now() - 5 * 24 * 36e5).toISOString();
    const recent = await http.get(`/api/issues?from=${from}&limit=50`, filterAdmin.token);
    expect(recent.body.items.find((i) => i.title === 'Broken chair')).toBeUndefined();
  });

  it('searches title and description (regex-safe)', async () => {
    const res = await http.get('/api/issues?q=wi-fi', filterAdmin.token);
    expect(res.body.items.map((i) => i.title)).toContain('Wi-Fi dead zone');
    expect((await http.get('/api/issues?q=(.*', filterAdmin.token)).status).toBe(200);
  });

  it('sorts by priority and newest first', async () => {
    const pr = await http.get('/api/issues?sort=priority&limit=50', filterAdmin.token);
    const scores = pr.body.items.map((i) => i.priorityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const nw = await http.get('/api/issues?limit=50', filterAdmin.token);
    const dates = nw.body.items.map((i) => new Date(i.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('paginates with default 20, max 50', async () => {
    const res = await http.get('/api/issues', filterAdmin.token);
    expect(res.body).toMatchObject({ page: 1, limit: 20 });
    expect(res.body.items.length).toBeLessThanOrEqual(20);
    const p2 = await http.get('/api/issues?page=2&limit=5', filterAdmin.token);
    expect(p2.body).toMatchObject({ page: 2, limit: 5 });
    expect(p2.body.totalPages).toBe(Math.ceil(p2.body.total / 5));
    expect((await http.get('/api/issues?limit=51', filterAdmin.token)).status).toBe(400);
    expect((await http.get('/api/issues?limit=0', filterAdmin.token)).status).toBe(400);
    expect((await http.get('/api/issues?page=-1', filterAdmin.token)).status).toBe(400);
  });
});

describe('full lifecycle over HTTP (D1)', () => {
  let issue;
  beforeAll(async () => {
    issue = (await report(alice, { title: 'Lifecycle issue' })).body;
  });

  it('only admins get assignment suggestions, sorted by load', async () => {
    expect(
      (await http.get(`/api/issues/${issue.id}/assignment-suggestions`, alice.token)).status,
    ).toBe(403);
    const res = await http.get(`/api/issues/${issue.id}/assignment-suggestions`, admin.token);
    expect(res.status).toBe(200);
    const names = res.body.suggestions.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['Tech One', 'Tech Two']));
    expect(names).not.toContain('Gone Tech');
    const loads = res.body.suggestions.map((s) => s.openLoad);
    expect(loads).toEqual([...loads].sort((a, b) => a - b));
    expect(res.body.suggestions.length).toBeLessThanOrEqual(3);
  });

  it('assignment validates the technician', async () => {
    const asStudent = await http
      .post(`/api/issues/${issue.id}/assign`, admin.token)
      .send({ technicianId: alice.id });
    expect(asStudent.status).toBe(400);
    const inactive = await http
      .post(`/api/issues/${issue.id}/assign`, admin.token)
      .send({ technicianId: inactiveTech.id });
    expect(inactive.status).toBe(400);
    const missing = await http
      .post(`/api/issues/${issue.id}/assign`, admin.token)
      .send({ technicianId: '0123456789abcdef01234567' });
    expect(missing.status).toBe(400);
    const badId = await http
      .post(`/api/issues/${issue.id}/assign`, admin.token)
      .send({ technicianId: 'nope' });
    expect(badId.status).toBe(400);
    const notAdmin = await http
      .post(`/api/issues/${issue.id}/assign`, tech.token)
      .send({ technicianId: tech.id });
    expect(notAdmin.status).toBe(403);
  });

  it('a student cannot start work (403 after visibility)', async () => {
    const res = await http
      .post(`/api/issues/${issue.id}/transition`, alice.token)
      .send({ to: 'in_progress' });
    expect(res.status).toBe(409); // still open: invalid from this status
  });

  it('admin assigns; the technician is notified and now sees the job', async () => {
    const res = await http
      .post(`/api/issues/${issue.id}/assign`, admin.token)
      .send({ technicianId: tech.id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'assigned', assignedTo: { name: 'Tech One' } });
    expect(
      await Notification.exists({ user: tech.user._id, type: 'issue_assigned', issue: issue.id }),
    ).toBeTruthy();
    const jobs = await http.get('/api/issues?sort=priority', tech.token);
    expect(jobs.body.items.map((i) => i.id)).toContain(issue.id);
    expect(jobs.body.items.every((i) => i.assignedTo?.name === 'Tech One')).toBe(true);
    const detail = await http.get(`/api/issues/${issue.id}`, tech.token);
    expect(detail.body.allowedActions).toEqual(['in_progress']);
  });

  it('assigning the same technician again is 409', async () => {
    const res = await http
      .post(`/api/issues/${issue.id}/assign`, admin.token)
      .send({ technicianId: tech.id });
    expect(res.status).toBe(409);
  });

  it('another technician cannot see or start it (404)', async () => {
    const res = await http
      .post(`/api/issues/${issue.id}/transition`, tech2.token)
      .send({ to: 'in_progress' });
    expect(res.status).toBe(404);
  });

  it('the reporter cannot start it (403)', async () => {
    const res = await http
      .post(`/api/issues/${issue.id}/transition`, alice.token)
      .send({ to: 'in_progress' });
    expect(res.status).toBe(403);
  });

  it('the technician cannot skip to resolved (409) and starts work', async () => {
    const skip = await http
      .post(`/api/issues/${issue.id}/transition`, tech.token)
      .field('to', 'resolved')
      .attach('photo', await jpeg(), 'after.jpg');
    expect(skip.status).toBe(409);
    const res = await http
      .post(`/api/issues/${issue.id}/transition`, tech.token)
      .send({ to: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('resolving needs an after photo (400), then succeeds with one', async () => {
    const noPhoto = await http
      .post(`/api/issues/${issue.id}/transition`, tech.token)
      .send({ to: 'resolved' });
    expect(noPhoto.status).toBe(400);
    const res = await http
      .post(`/api/issues/${issue.id}/transition`, tech.token)
      .field('to', 'resolved')
      .field('note', 'Replaced the HDMI cable')
      .attach('photo', await jpeg({ color: '#1f9e89' }), {
        filename: 'after.jpg',
        contentType: 'image/jpeg',
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'resolved',
      resolutionNote: 'Replaced the HDMI cable',
    });
    expect(res.body.resolutionPhotoPath).toMatch(/^\/uploads\//);
    expect(
      await Notification.exists({
        user: alice.user._id,
        type: 'status_changed',
        issue: issue.id,
        title: 'Fixed! Please confirm',
      }),
    ).toBeTruthy();
  });

  it('a supporter cannot confirm (403); the reporter can reopen with a reason', async () => {
    await Issue.updateOne({ _id: issue.id }, { $addToSet: { supporters: bob.user._id } });
    const bySupporter = await http
      .post(`/api/issues/${issue.id}/transition`, bob.token)
      .send({ to: 'closed' });
    expect(bySupporter.status).toBe(403);
    const noReason = await http
      .post(`/api/issues/${issue.id}/transition`, alice.token)
      .send({ to: 'reopened' });
    expect(noReason.status).toBe(400);
    const res = await http
      .post(`/api/issues/${issue.id}/transition`, alice.token)
      .send({ to: 'reopened', reason: 'Still flickering' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('reopened');
    expect(res.body.resolvedAt).toBeNull();
    expect(new Date(res.body.dueAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('reassign → start → resolve → reporter confirms → closed is terminal', async () => {
    expect(
      (
        await http
          .post(`/api/issues/${issue.id}/assign`, admin.token)
          .send({ technicianId: tech2.id })
      ).status,
    ).toBe(200);
    expect(
      (
        await http
          .post(`/api/issues/${issue.id}/transition`, tech2.token)
          .send({ to: 'in_progress' })
      ).status,
    ).toBe(200);
    // reassigning while in progress returns it to assigned
    const back = await http
      .post(`/api/issues/${issue.id}/assign`, admin.token)
      .send({ technicianId: tech.id });
    expect(back.body.status).toBe('assigned');
    expect(
      await Notification.exists({ user: tech2.user._id, title: 'Job reassigned' }),
    ).toBeTruthy();
    expect(
      (
        await http
          .post(`/api/issues/${issue.id}/transition`, tech.token)
          .send({ to: 'in_progress' })
      ).status,
    ).toBe(200);
    const resolved = await http
      .post(`/api/issues/${issue.id}/transition`, tech.token)
      .field('to', 'resolved')
      .attach('photo', await jpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(resolved.status).toBe(200);
    const closed = await http
      .post(`/api/issues/${issue.id}/transition`, alice.token)
      .send({ to: 'closed' });
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('closed');
    expect(closed.body.allowedActions).toEqual([]);
    for (const to of ['reopened', 'rejected', 'in_progress']) {
      const r = await http
        .post(`/api/issues/${issue.id}/transition`, admin.token)
        .send({ to, reason: 'x' });
      expect(r.status).toBe(409);
    }
    const reassignClosed = await http
      .post(`/api/issues/${issue.id}/assign`, admin.token)
      .send({ technicianId: tech.id });
    expect(reassignClosed.status).toBe(409);
    const history = (await http.get(`/api/issues/${issue.id}`, admin.token)).body.statusHistory.map(
      (h) => h.status,
    );
    expect(history).toEqual([
      'open',
      'assigned',
      'in_progress',
      'resolved',
      'reopened',
      'assigned',
      'in_progress',
      'assigned',
      'in_progress',
      'resolved',
      'closed',
    ]);
  });

  it('admin rejects an open issue with a reason and duplicateOf', async () => {
    const dup = (await report(bob, { title: 'Same projector' })).body;
    const noReason = await http
      .post(`/api/issues/${dup.id}/transition`, admin.token)
      .send({ to: 'rejected' });
    expect(noReason.status).toBe(400);
    const res = await http
      .post(`/api/issues/${dup.id}/transition`, admin.token)
      .send({ to: 'rejected', reason: 'Duplicate report', duplicateOf: issue.id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Duplicate report',
      duplicateOf: issue.id,
    });
  });

  it('a student cannot reject (403) and an unknown target is 400', async () => {
    const own = (await report(bob, { title: 'Bob issue' })).body;
    expect(
      (
        await http
          .post(`/api/issues/${own.id}/transition`, bob.token)
          .send({ to: 'rejected', reason: 'x' })
      ).status,
    ).toBe(403);
    expect(
      (await http.post(`/api/issues/${own.id}/transition`, admin.token).send({ to: 'deleted' }))
        .status,
    ).toBe(400);
    expect(
      (await http.post(`/api/issues/${own.id}/transition`, admin.token).send({ to: 'assigned' }))
        .status,
    ).toBe(400);
  });

  it('the reopen window closes after 7 days (409)', async () => {
    const old = await makeIssue(alice.user, {
      status: 'resolved',
      assignedTo: tech.user._id,
      resolvedAt: new Date(Date.now() - 8 * 24 * 36e5),
      resolutionPhotoPath: '/uploads/x.jpg',
    });
    const res = await http
      .post(`/api/issues/${old.id}/transition`, alice.token)
      .send({ to: 'reopened', reason: 'Broken again' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REOPEN_WINDOW_CLOSED');
  });
});

describe('admin edits (severity change recomputes SLA)', () => {
  it('changes severity, dueAt and priority', async () => {
    const created = (await report(alice, { severity: 'low' })).body;
    expect(created.priorityScore).toBe(10);
    const res = await http
      .patch(`/api/issues/${created.id}`, admin.token)
      .send({ severity: 'critical' });
    expect(res.status).toBe(200);
    expect(res.body.priorityScore).toBe(100);
    expect(new Date(res.body.dueAt) - new Date(res.body.createdAt)).toBe(4 * 36e5);
    expect(
      (await http.patch(`/api/issues/${created.id}`, alice.token).send({ severity: 'low' })).status,
    ).toBe(403);
  });
});

describe('me too (FR-52)', () => {
  it('adds a supporter once, raises priority and notifies the reporter', async () => {
    const issue = (await report(alice, { severity: 'medium', title: 'Leaking tap' })).body;
    const res = await http.post(`/api/issues/${issue.id}/support`, bob.token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ supportersCount: 1, supportedByMe: true, priorityScore: 38 });
    const again = await http.post(`/api/issues/${issue.id}/support`, bob.token);
    expect(again.body.supportersCount).toBe(1);
    expect(
      await Notification.countDocuments({ user: alice.user._id, type: 'me_too', issue: issue.id }),
    ).toBe(1);
  });

  it('cannot support your own issue, a closed issue, or as staff', async () => {
    const issue = (await report(alice)).body;
    expect((await http.post(`/api/issues/${issue.id}/support`, alice.token)).status).toBe(409);
    expect((await http.post(`/api/issues/${issue.id}/support`, tech.token)).status).toBe(403);
    const closed = await makeIssue(alice.user, { status: 'closed' });
    expect((await http.post(`/api/issues/${closed.id}/support`, bob.token)).status).toBe(409);
    expect(
      (await http.post('/api/issues/0123456789abcdef01234567/support', bob.token)).status,
    ).toBe(404);
  });
});

describe('Fixed on campus feed (FR-59)', () => {
  it('lists resolved and closed issues with photos and no identities', async () => {
    await makeIssue(alice.user, {
      title: 'Fixed light',
      status: 'closed',
      assignedTo: tech.user._id,
      photoPath: '/uploads/before.jpg',
      resolutionPhotoPath: '/uploads/after.jpg',
      resolvedAt: new Date(),
      locationRef: room._id,
    });
    const res = await http.get('/api/issues/feed', bob.token);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(['resolved', 'closed']).toContain(item.status);
      expect(item.resolutionPhotoPath).toBeTruthy();
      expect(item).not.toHaveProperty('reporter');
      expect(item).not.toHaveProperty('assignedTo');
      expect(JSON.stringify(item)).not.toMatch(/Alice|Tech One/);
    }
    expect(res.body.items.find((i) => i.title === 'Fixed light').place).toBe('Block B · Room 204');
  });
});
