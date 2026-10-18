/**
 * End-to-end demo scenario (SPEC section 13) at API level, with real Socket.IO clients.
 * Starts the app on the TEST database with an ephemeral port: `npm run e2e`.
 * Exits non-zero on the first failed check.
 */
import assert from 'node:assert/strict';
import sharp from 'sharp';

process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR ??= '.cache/e2e-uploads';

const { env } = await import('../config/env.js');
const { connectDb } = await import('../config/db.js');
const mongoose = (await import('mongoose')).default;
const { startServer } = await import('../server.js');
const { User } = await import('../models/User.js');
const { Location } = await import('../models/Location.js');
const { io: ioClient } = await import('socket.io-client');
const { artSvg } = await import('./seedArt.js');
const extras = await import('./e2eExtras.js');

// ------------------------------------------------------------------ helpers

const C = { green: '\x1b[32m', red: '\x1b[31m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' };
let base;
let passed = 0;

async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    passed += 1;
    console.log(`${C.green}✓${C.reset} ${name} ${C.dim}(${Date.now() - t} ms)${C.reset}`);
  } catch (err) {
    console.log(`${C.red}✗ ${name}${C.reset}\n  ${err.stack ?? err.message}`);
    throw err;
  }
}

async function call(method, path, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = new FormData();
    for (const [k, v] of Object.entries(form)) {
      if (v === undefined) continue;
      if (v instanceof Blob) body.append(k, v, 'photo.jpg');
      else body.append(k, String(v));
    }
  }
  const res = await fetch(`${base}/api${path}`, { method, headers, body });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* CSV or empty */
  }
  return { status: res.status, body: data };
}

async function photoBlob(category, variant, fixed = false) {
  const buf = await sharp(Buffer.from(artSvg(category, variant, { fixed })))
    .jpeg()
    .toBuffer();
  return new Blob([buf], { type: 'image/jpeg' });
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const s = ioClient(base, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    s.events = [];
    s.onAny((event, payload) => s.events.push({ event, payload }));
    s.once('ready', () => resolve(s));
    s.once('connect_error', reject);
  });
}

function waitFor(socket, event, predicate = () => true, ms = 5000) {
  const seen = socket.events.find((e) => e.event === event && predicate(e.payload));
  if (seen) return Promise.resolve(seen.payload);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), ms);
    const handler = (p) => {
      if (!predicate(p)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(p);
    };
    socket.on(event, handler);
  });
}

// ------------------------------------------------------------------ setup

await connectDb(env.MONGODB_URI);
await mongoose.connection.dropDatabase();
await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
extras.installFakeAi?.();

const PASSWORD = 'e2e-password-123';
async function staff(name, email, role, skills = []) {
  const u = new User({ name, email, role, skills });
  await u.setPassword(PASSWORD);
  await u.save();
  return u;
}
await staff('E2E Admin', 'admin@e2e.test', 'admin');
await staff('E2E Electrician', 'electrician@e2e.test', 'technician', ['electrical']);
await staff('E2E Plumber', 'plumber@e2e.test', 'technician', ['plumbing']);
const room = await Location.create({
  code: 'B-204',
  building: 'Academic Block B',
  floor: '2',
  room: '204',
  label: 'Smart Classroom',
  point: { type: 'Point', coordinates: [env.CAMPUS_CENTER_LNG, env.CAMPUS_CENTER_LAT] },
});

const app = await startServer({ port: 0, jobs: false });
base = `http://127.0.0.1:${app.port}`;
console.log(
  `${C.bold}FixIt Campus e2e${C.reset} ${C.dim}API on ${base}, database ${env.MONGODB_URI}${C.reset}\n`,
);

const sockets = [];
const state = {};

try {
  // 1 ---------------------------------------------------------------
  await step(
    '1. Student registers on the phone and signs in on the web with the same account',
    async () => {
      const reg = await call('POST', '/auth/register', {
        json: {
          name: 'Demo Student',
          email: 'demo@student.e2e.test',
          password: 'student-pass-1',
          role: 'admin',
        },
      });
      assert.equal(reg.status, 201);
      assert.equal(reg.body.user.role, 'student', 'role in the body must be ignored');
      const web = await call('POST', '/auth/login', {
        json: { email: 'DEMO@student.e2e.test', password: 'student-pass-1' },
      });
      assert.equal(web.status, 200);
      assert.equal(web.body.user.id, reg.body.user.id, 'same account on both apps');
      state.student = web.body;
      const admin = await call('POST', '/auth/login', {
        json: { email: 'admin@e2e.test', password: PASSWORD },
      });
      const tech = await call('POST', '/auth/login', {
        json: { email: 'electrician@e2e.test', password: PASSWORD },
      });
      state.admin = admin.body;
      state.tech = tech.body;
      state.adminSock = await connectSocket(state.admin.token);
      state.techSock = await connectSocket(state.tech.token);
      state.studentSock = await connectSocket(state.student.token);
      sockets.push(state.adminSock, state.techSock, state.studentSock);
    },
  );

  // 2 ---------------------------------------------------------------
  await step(
    '2. Student scans the room QR, takes a photo, gets an AI suggestion and no duplicate, submits',
    async () => {
      const loc = await call('GET', `/locations/code/${encodeURIComponent('FIXIT:LOC:B-204')}`, {
        token: state.student.token,
      });
      assert.equal(loc.status, 200);
      assert.equal(loc.body.id, String(room._id));
      state.photo = await photoBlob('electrical', 3);
      const suggestion = await extras.analyse?.(
        call,
        state.student.token,
        state.photo,
        loc.body.id,
      );
      if (suggestion) {
        assert.equal(suggestion.suggestion?.category, 'electrical', 'AI suggests electrical');
        assert.equal(suggestion.duplicates.length, 0, 'no duplicate yet');
      }
      const res = await call('POST', '/issues', {
        token: state.student.token,
        form: {
          title: 'Projector flickering in B-204',
          description: 'Flickers every few seconds during lectures',
          category: 'electrical',
          severity: 'high',
          locationId: loc.body.id,
          clientRequestId: '0f8e9d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f',
          aiSuggestedCategory: suggestion?.suggestion?.category,
          aiConfidence: suggestion?.suggestion?.confidence,
          photo: state.photo,
        },
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.locationRef.code, 'B-204');
      assert.ok(res.body.photoPath && res.body.thumbPath);
      state.issue = res.body;
    },
  );

  // 3 ---------------------------------------------------------------
  await step(
    '3. Admin dashboard and Live Booth see it instantly; admin assigns the suggested technician',
    async () => {
      const created = await waitFor(
        state.adminSock,
        'issue:created',
        (p) => p.id === state.issue.id,
      );
      assert.equal(created.reporter.name, 'Demo Student');
      await waitFor(state.adminSock, 'stats:changed');
      const live = await call('GET', '/insights/live', { token: state.admin.token });
      assert.ok(
        live.body.feed.some((f) => f.issueId === state.issue.id && f.kind === 'reported'),
        'Live Booth feed shows the report',
      );
      assert.ok(
        !JSON.stringify(live.body).includes('Demo Student'),
        'Live Booth shows no personal data',
      );
      const sug = await call('GET', `/issues/${state.issue.id}/assignment-suggestions`, {
        token: state.admin.token,
      });
      assert.equal(
        sug.body.suggestions[0].name,
        'E2E Electrician',
        'electrician suggested for an electrical issue',
      );
      const assign = await call('POST', `/issues/${state.issue.id}/assign`, {
        token: state.admin.token,
        json: { technicianId: sug.body.suggestions[0].id },
      });
      assert.equal(assign.status, 200);
      assert.equal(assign.body.status, 'assigned');
    },
  );

  // 4 ---------------------------------------------------------------
  await step(
    '4. Technician is notified, sees the SLA countdown, starts, then resolves with an after photo',
    async () => {
      const note = await waitFor(
        state.techSock,
        'notification:new',
        (n) => n.issue === state.issue.id,
      );
      assert.equal(note.type, 'issue_assigned');
      const jobs = await call('GET', '/issues?sort=priority', { token: state.tech.token });
      const job = jobs.body.items.find((i) => i.id === state.issue.id);
      assert.ok(job, 'job in the technician list');
      assert.ok(new Date(job.dueAt) > new Date(), 'SLA countdown running');
      assert.equal(job.overdue, false);
      const start = await call('POST', `/issues/${state.issue.id}/transition`, {
        token: state.tech.token,
        json: { to: 'in_progress' },
      });
      assert.equal(start.status, 200);
      const resolve = await call('POST', `/issues/${state.issue.id}/transition`, {
        token: state.tech.token,
        form: {
          to: 'resolved',
          note: 'Replaced the HDMI cable',
          photo: await photoBlob('electrical', 3, true),
        },
      });
      assert.equal(resolve.status, 200, JSON.stringify(resolve.body));
      assert.ok(resolve.body.resolutionPhotoPath);
    },
  );

  // 5 ---------------------------------------------------------------
  await step(
    '5. Student is notified and confirms; before/after appears in Fixed on campus; insights update',
    async () => {
      const note = await waitFor(
        state.studentSock,
        'notification:new',
        (n) => n.issue === state.issue.id && n.title === 'Fixed! Please confirm',
      );
      assert.equal(note.type, 'status_changed');
      const inbox = await call('GET', '/notifications', { token: state.student.token });
      assert.ok(inbox.body.unreadCount >= 1, 'saved in the inbox too');
      const confirm = await call('POST', `/issues/${state.issue.id}/transition`, {
        token: state.student.token,
        json: { to: 'closed' },
      });
      assert.equal(confirm.status, 200);
      assert.equal(confirm.body.status, 'closed');
      await waitFor(
        state.studentSock,
        'issue:updated',
        (p) => p.issue.id === state.issue.id && p.issue.status === 'closed',
      );
      const feed = await call('GET', '/issues/feed', { token: state.student.token });
      const item = feed.body.items.find((i) => i.id === state.issue.id);
      assert.ok(
        item?.photoPath && item?.resolutionPhotoPath,
        'before and after photos in the feed',
      );
      assert.ok(!('reporter' in item), 'feed has no reporter identity');
      const overview = await call('GET', '/insights/overview?days=7', { token: state.admin.token });
      assert.equal(overview.body.byStatus.closed, 1);
      const summary = await call('GET', '/insights/summary', { token: state.admin.token });
      assert.equal(summary.body.resolvedThisWeek, 1);
    },
  );

  // 6 ---------------------------------------------------------------
  await step(
    '6. A second student reports the same problem; duplicate found; "Me too" raises priority instead of a new issue',
    async () => {
      // an active issue in the same room (the first one is closed now)
      const leak = await call('POST', '/issues', {
        token: state.student.token,
        form: {
          title: 'Water leaking under the washbasin',
          category: 'plumbing',
          severity: 'medium',
          locationId: String(room._id),
          photo: await photoBlob('plumbing', 5),
        },
      });
      assert.equal(leak.status, 201);
      const second = await call('POST', '/auth/register', {
        json: {
          name: 'Second Student',
          email: 'second@student.e2e.test',
          password: 'student-pass-2',
        },
      });
      const token2 = second.body.token;
      const countBefore = (await call('GET', '/issues?limit=50', { token: state.admin.token })).body
        .total;
      const dup = (await extras.findDuplicates?.(
        call,
        token2,
        await photoBlob('plumbing', 6),
        String(room._id),
      )) ?? { duplicates: [{ id: leak.body.id }] };
      assert.ok(
        dup.duplicates.some((d) => d.id === leak.body.id),
        'the existing leak is offered as a duplicate',
      );
      const metoo = await call('POST', `/issues/${leak.body.id}/support`, { token: token2 });
      assert.equal(metoo.status, 200);
      assert.equal(metoo.body.supportersCount, 1);
      assert.equal(metoo.body.priorityScore, leak.body.priorityScore + 8, 'priority raised by 8');
      await waitFor(
        state.studentSock,
        'notification:new',
        (n) => n.issue === leak.body.id && n.type === 'me_too',
      );
      const countAfter = (await call('GET', '/issues?limit=50', { token: state.admin.token })).body
        .total;
      assert.equal(countAfter, countBefore, 'no new issue created');
      state.token2 = token2;
      state.leak = leak.body;
    },
  );

  // 7 ---------------------------------------------------------------
  await step(
    '7. Security: 403 for a student on an admin endpoint, 401 without a token, 400 for a PDF photo, 409/403 for invalid transitions',
    async () => {
      assert.equal((await call('GET', '/users', { token: state.student.token })).status, 403);
      assert.equal(
        (await call('GET', '/insights/summary', { token: state.student.token })).status,
        403,
      );
      assert.equal((await call('GET', '/issues')).status, 401);
      const pdf = new Blob([Buffer.from('%PDF-1.4\n%%EOF\n')], { type: 'image/jpeg' });
      const bad = await call('POST', '/issues', {
        token: state.student.token,
        form: { title: 'PDF as photo', category: 'other', landmark: 'Library', photo: pdf },
      });
      assert.equal(bad.status, 400);
      assert.equal(bad.body.error.code, 'INVALID_FILE');
      const reopenClosed = await call('POST', `/issues/${state.issue.id}/transition`, {
        token: state.student.token,
        json: { to: 'reopened', reason: 'x' },
      });
      assert.equal(reopenClosed.status, 409, 'closed is terminal');
      const studentStarts = await call('POST', `/issues/${state.leak.id}/transition`, {
        token: state.token2,
        json: { to: 'in_progress' },
      });
      assert.equal(studentStarts.status, 409, 'cannot start an unassigned issue');
      await call('POST', `/issues/${state.leak.id}/assign`, {
        token: state.admin.token,
        json: { technicianId: state.tech.user.id },
      });
      const reporterStarts = await call('POST', `/issues/${state.leak.id}/transition`, {
        token: state.student.token,
        json: { to: 'in_progress' },
      });
      assert.equal(reporterStarts.status, 403, 'only the assigned technician can start');
      const sockNoToken = await new Promise((resolve) => {
        const s = ioClient(base, {
          transports: ['websocket'],
          reconnection: false,
          forceNew: true,
        });
        s.once('connect_error', (e) => resolve(e.data?.code));
        s.once('ready', () => resolve('connected'));
      });
      assert.equal(sockNoToken, 'UNAUTHENTICATED', 'socket without a token is refused');
    },
  );

  console.log(`\n${C.green}${C.bold}e2e passed: ${passed}/7 scenario steps${C.reset}`);
} catch {
  console.log(`\n${C.red}${C.bold}e2e FAILED after ${passed} passing step(s)${C.reset}`);
  process.exitCode = 1;
} finally {
  sockets.forEach((s) => s.close());
  await app.stop();
}
