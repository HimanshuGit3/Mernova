import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app.js';
import { Issue } from '../models/Issue.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { api, makeUser } from './helpers.js';
import { makeIssue } from './fixtures.js';
import { parseEnv } from '../config/env.js';

// Regression tests for the phase 11 fresh-eyes review findings.
const http = api(createApp({ authRateLimitMax: 1000 }));
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let admin, tech, reporter, other;

beforeAll(async () => {
  admin = await makeUser({ role: 'admin', name: 'Hard Admin' });
  tech = await makeUser({ role: 'technician', name: 'Hard Tech', skills: ['electrical'] });
  reporter = await makeUser({ name: 'Secret Reporter' });
  other = await makeUser({ name: 'Other Student' });
});

describe('technicians never see the reporter identity (D-11)', () => {
  it('history entries by the reporter show only the role; staff names stay visible', async () => {
    const issue = await makeIssue(reporter.user, { title: 'Privacy check' });
    await http.post(`/api/issues/${issue.id}/assign`, admin.token).send({ technicianId: tech.id });
    const res = await http.get(`/api/issues/${issue.id}`, tech.token);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('Secret Reporter');
    expect(res.body.statusHistory[0].changedBy).toEqual({ role: 'student' });
    expect(res.body.statusHistory[1].changedBy).toMatchObject({
      name: 'Hard Admin',
      role: 'admin',
    });
    // admins still see everyone
    const asAdmin = await http.get(`/api/issues/${issue.id}`, admin.token);
    expect(asAdmin.body.statusHistory[0].changedBy.name).toBe('Secret Reporter');
  });
});

describe('"Me too" is atomic', () => {
  it('a double tap (concurrent requests) adds the supporter once and notifies once', async () => {
    const issue = await makeIssue(reporter.user, {
      title: 'Double tap',
      severity: 'medium',
      priorityScore: 30,
    });
    const results = await Promise.all(
      [1, 2, 3].map(() => http.post(`/api/issues/${issue.id}/support`, other.token)),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const stored = await Issue.findById(issue._id);
    expect(stored.supporters.map(String)).toEqual([other.id]);
    expect(stored.priorityScore).toBe(30 + 8);
    expect(await Notification.countDocuments({ issue: issue._id, type: 'me_too' })).toBe(1);
  });
});

describe('push tokens follow the phone, not the old account', () => {
  it('registering a token removes it from any other user', async () => {
    const token = 'shared-phone-token-123456';
    await http.post('/api/auth/fcm-token', reporter.token).send({ token });
    await http.post('/api/auth/fcm-token', other.token).send({ token });
    const a = await User.findById(reporter.user._id).select('+fcmTokens');
    const b = await User.findById(other.user._id).select('+fcmTokens');
    expect(a.fcmTokens).not.toContain(token);
    expect(b.fcmTokens).toContain(token);
  });
});

describe('fail-fast configuration (NFR-04)', () => {
  function loadEnv(overrides) {
    const env = { ...process.env, ...overrides };
    for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete env[k];
    return spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "const { env } = await import('./config/env.js'); console.log(env.NODE_ENV)",
      ],
      {
        cwd: serverRoot,
        env,
        encoding: 'utf8',
      },
    );
  }

  it('refuses an invalid JWT_EXPIRES_IN at start-up', () => {
    const res = loadEnv({ NODE_ENV: 'development', JWT_EXPIRES_IN: '7days' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('JWT_EXPIRES_IN');
  });

  const minimal = {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/x',
    JWT_SECRET: 'x'.repeat(40),
    CLIENT_ORIGIN: 'http://localhost:5173',
  };

  it('defaults to production (no stack traces) when NODE_ENV is not set', () => {
    const { env, problems } = parseEnv(minimal);
    expect(problems).toEqual([]);
    expect(env.NODE_ENV).toBe('production');
  });

  it('accepts real durations and rejects nonsense', () => {
    for (const ok of ['7d', '12h', '3600', '30 m'])
      expect(parseEnv({ ...minimal, JWT_EXPIRES_IN: ok }).problems).toEqual([]);
    for (const bad of ['7days', 'forever', ''])
      expect(parseEnv({ ...minimal, JWT_EXPIRES_IN: bad }).problems[0]).toContain('JWT_EXPIRES_IN');
  });

  it('refuses a test run against a non-test database', () => {
    expect(
      parseEnv({
        ...minimal,
        NODE_ENV: 'test',
        MONGODB_URI_TEST: 'mongodb://127.0.0.1:27017/fixit',
      }).problems[0],
    ).toContain('test');
  });
});
