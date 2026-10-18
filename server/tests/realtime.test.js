import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, makeUser } from './helpers.js';
import { jpeg } from './fixtures.js';
import { connect, startTestServer, waitFor, sleep } from './socketHelpers.js';

let srv, http;
let admin, tech, alice, bob;
const sockets = [];

beforeAll(async () => {
  srv = await startTestServer();
  http = api(srv.app);
  admin = await makeUser({ role: 'admin', name: 'RT Admin' });
  tech = await makeUser({ role: 'technician', name: 'RT Tech', skills: ['electrical'] });
  alice = await makeUser({ name: 'RT Alice' });
  bob = await makeUser({ name: 'RT Bob' });
});

afterAll(async () => {
  sockets.forEach((s) => s.close());
  await srv.stop();
});

async function open(token) {
  const s = await connect(srv.url, token);
  sockets.push(s);
  return s;
}

async function report(who, title = 'Realtime projector issue') {
  const res = await http
    .post('/api/issues', who.token)
    .field('title', title)
    .field('category', 'electrical')
    .field('severity', 'high')
    .field('landmark', 'Block B, 2nd floor')
    .attach('photo', await jpeg(), { filename: 'p.jpg', contentType: 'image/jpeg' });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Socket.IO handshake (NFR-02)', () => {
  it('refuses a connection without a token', async () => {
    await expect(connect(srv.url)).rejects.toMatchObject({ data: { code: 'UNAUTHENTICATED' } });
  });

  it('refuses a forged token', async () => {
    await expect(connect(srv.url, 'abc.def.ghi')).rejects.toThrow();
  });

  it('refuses a deactivated account', async () => {
    const gone = await makeUser({ isActive: false });
    await expect(connect(srv.url, gone.token)).rejects.toMatchObject({
      data: { code: 'ACCOUNT_DISABLED' },
    });
  });

  it('accepts a valid token and reports the role', async () => {
    const s = await open(admin.token);
    expect(s.connected).toBe(true);
    expect(s.events.find((e) => e.event === 'ready').payload).toMatchObject({
      userId: admin.id,
      role: 'admin',
    });
  });

  it('disconnects a user when an admin deactivates them', async () => {
    const victim = await makeUser({ name: 'Soon Gone' });
    const s = await open(victim.token);
    const disconnected = new Promise((resolve) => s.once('disconnect', resolve));
    const res = await http.patch(`/api/users/${victim.id}`, admin.token).send({ isActive: false });
    expect(res.status).toBe(200);
    await expect(disconnected).resolves.toBeDefined();
  });
});

describe('events and rooms (SPEC 10)', () => {
  let adminSock, techSock, aliceSock, bobSock;
  beforeAll(async () => {
    [adminSock, techSock, aliceSock, bobSock] = await Promise.all([
      open(admin.token),
      open(tech.token),
      open(alice.token),
      open(bob.token),
    ]);
  });

  it('issue:created goes to admins only, with the reporter; admins get notification:new', async () => {
    const issue = await report(alice, 'Created event issue');
    const created = await waitFor(adminSock, 'issue:created', (p) => p.id === issue.id);
    expect(created.reporter.name).toBe('RT Alice');
    expect(created).not.toHaveProperty('embedding');
    const note = await waitFor(adminSock, 'notification:new', (n) => n.issue === issue.id);
    expect(note.type).toBe('issue_created');
    await sleep(300);
    for (const s of [techSock, aliceSock, bobSock]) {
      expect(s.events.some((e) => e.event === 'issue:created')).toBe(false);
    }
  });

  it('stats:changed reaches admins', async () => {
    await waitFor(adminSock, 'stats:changed');
  });

  it('assignment: technician gets notification:new; reporter and admin get issue:updated', async () => {
    const issue = await report(alice, 'Assign event issue');
    await http.post(`/api/issues/${issue.id}/assign`, admin.token).send({ technicianId: tech.id });
    const note = await waitFor(techSock, 'notification:new', (n) => n.issue === issue.id);
    expect(note).toMatchObject({ type: 'issue_assigned', title: 'New job assigned to you' });
    const forTech = await waitFor(techSock, 'issue:updated', (p) => p.issue.id === issue.id);
    expect(forTech.changes).toEqual(['status', 'assignedTo']);
    expect(forTech.issue).not.toHaveProperty('reporter'); // technicians never get the reporter's identity
    const forAlice = await waitFor(aliceSock, 'issue:updated', (p) => p.issue.id === issue.id);
    expect(forAlice.issue.status).toBe('assigned');
    expect(forAlice.issue.reportedByMe).toBe(true);
    const forAdmin = await waitFor(adminSock, 'issue:updated', (p) => p.issue.id === issue.id);
    expect(forAdmin.issue.reporter.name).toBe('RT Alice');
    await sleep(200);
    expect(
      bobSock.events.some((e) => e.event === 'issue:updated' && e.payload.issue.id === issue.id),
    ).toBe(false);
  });

  it('each socket gets exactly one copy of issue:updated', async () => {
    const issue = await report(alice, 'One copy issue');
    await http.post(`/api/issues/${issue.id}/support`, bob.token);
    await waitFor(bobSock, 'issue:updated', (p) => p.issue.id === issue.id);
    await sleep(300);
    const count = (s) =>
      s.events.filter((e) => e.event === 'issue:updated' && e.payload.issue.id === issue.id).length;
    expect(count(adminSock)).toBe(1);
    expect(count(aliceSock)).toBe(1);
    expect(count(bobSock)).toBe(1);
  });

  it('a supporter receives updates without the reporter identity; reporter gets me_too', async () => {
    const issue = await report(alice, 'Supporter event issue');
    await http.post(`/api/issues/${issue.id}/support`, bob.token);
    const metoo = await waitFor(
      aliceSock,
      'notification:new',
      (n) => n.issue === issue.id && n.type === 'me_too',
    );
    expect(metoo.title).toMatch(/too/);
    await http.post(`/api/issues/${issue.id}/assign`, admin.token).send({ technicianId: tech.id });
    const forBob = await waitFor(
      bobSock,
      'issue:updated',
      (p) => p.issue.id === issue.id && p.issue.status === 'assigned',
    );
    expect(forBob.issue).not.toHaveProperty('reporter');
    expect(forBob.issue.supportersCount).toBe(1);
  });

  it('a full fix cycle notifies the reporter in real time', async () => {
    const issue = await report(alice, 'Fix cycle event issue');
    await http.post(`/api/issues/${issue.id}/assign`, admin.token).send({ technicianId: tech.id });
    await http.post(`/api/issues/${issue.id}/transition`, tech.token).send({ to: 'in_progress' });
    await waitFor(
      aliceSock,
      'notification:new',
      (n) => n.issue === issue.id && n.title === 'Work has started',
    );
    await http
      .post(`/api/issues/${issue.id}/transition`, tech.token)
      .field('to', 'resolved')
      .attach('photo', await jpeg({ color: '#1f9e89' }), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      });
    const fixed = await waitFor(
      aliceSock,
      'notification:new',
      (n) => n.issue === issue.id && n.title === 'Fixed! Please confirm',
    );
    expect(fixed.type).toBe('status_changed');
    await http.post(`/api/issues/${issue.id}/transition`, alice.token).send({ to: 'closed' });
    const confirmed = await waitFor(
      techSock,
      'notification:new',
      (n) => n.issue === issue.id && n.title === 'Fix confirmed',
    );
    expect(confirmed).toBeTruthy();
  });

  it('stats:changed is throttled to at most one per 2 seconds', async () => {
    await sleep(2100);
    const before = adminSock.events.filter((e) => e.event === 'stats:changed').length;
    // a burst of 4 changes
    for (let i = 0; i < 4; i += 1) await report(bob, `Burst ${i}`);
    await sleep(2500);
    const after = adminSock.events.filter((e) => e.event === 'stats:changed').length;
    expect(after - before).toBeGreaterThanOrEqual(1);
    expect(after - before).toBeLessThanOrEqual(2);
  });
});
