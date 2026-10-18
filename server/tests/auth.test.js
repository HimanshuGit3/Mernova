import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { api, makeUser, expectErrorShape as shape } from './helpers.js';

const app = createApp({ authRateLimitMax: 1000 });
const http = api(app);
const expectErrorShape = (res, status, code) => shape(expect, res, status, code);

describe('health', () => {
  it('returns ok', async () => {
    const res = await http.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('up');
  });

  it('unknown route returns 404 in the error shape', async () => {
    expectErrorShape(await http.get('/api/nope'), 404, 'NOT_FOUND');
  });
});

describe('POST /api/auth/register', () => {
  it('creates a student and returns a token without the password hash', async () => {
    const res = await http.post('/api/auth/register').send({
      name: 'Asha Rao',
      email: 'Asha@Student.edu',
      password: 'password123',
      department: 'MCA',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({
      name: 'Asha Rao',
      email: 'asha@student.edu',
      role: 'student',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const stored = await User.findOne({ email: 'asha@student.edu' }).select('+passwordHash');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$10\$/); // bcrypt hash only (NFR-01)
    expect(stored.passwordHash).not.toContain('password123');
  });

  it('ignores a role escalation attempt', async () => {
    const res = await http
      .post('/api/auth/register')
      .send({ name: 'Mallory', email: 'mallory@test.edu', password: 'password123', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('student');
    const stored = await User.findOne({ email: 'mallory@test.edu' });
    expect(stored.role).toBe('student');
  });

  it('rejects invalid input with 400 and field details', async () => {
    const res = await http
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });
    expectErrorShape(res, 400, 'VALIDATION_ERROR');
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expectErrorShape(res, 400);
  });

  it('rejects a duplicate email with 409', async () => {
    const body = { name: 'Dup User', email: 'dup@test.edu', password: 'password123' };
    expect((await http.post('/api/auth/register').send(body)).status).toBe(201);
    const res = await http.post('/api/auth/register').send({ ...body, email: 'DUP@test.edu' });
    expectErrorShape(res, 409, 'CONFLICT');
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await makeUser({ email: 'login@test.edu', password: 'correct-horse' });
    await makeUser({ email: 'disabled@test.edu', password: 'correct-horse', isActive: false });
  });

  it('logs in with the right password', async () => {
    const res = await http
      .post('/api/auth/login')
      .send({ email: 'LOGIN@test.edu', password: 'correct-horse' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@test.edu');
    const payload = jwt.verify(res.body.token, env.JWT_SECRET);
    expect(payload.role).toBe('student');
    expect(payload.exp).toBeGreaterThan(payload.iat); // tokens expire (FR-03)
  });

  it('rejects a wrong password with 401', async () => {
    const res = await http
      .post('/api/auth/login')
      .send({ email: 'login@test.edu', password: 'wrong-password' });
    expectErrorShape(res, 401, 'INVALID_CREDENTIALS');
  });

  it('rejects an unknown email with the same 401', async () => {
    const res = await http
      .post('/api/auth/login')
      .send({ email: 'ghost@test.edu', password: 'whatever1' });
    expectErrorShape(res, 401, 'INVALID_CREDENTIALS');
  });

  it('refuses a deactivated account with 403', async () => {
    const res = await http
      .post('/api/auth/login')
      .send({ email: 'disabled@test.edu', password: 'correct-horse' });
    expectErrorShape(res, 403, 'ACCOUNT_DISABLED');
  });
});

describe('protected routes', () => {
  it('GET /me without a token is 401', async () => {
    expectErrorShape(await http.get('/api/auth/me'), 401, 'UNAUTHENTICATED');
  });

  it('GET /me with a garbage token is 401', async () => {
    expectErrorShape(await http.get('/api/auth/me', 'not.a.jwt'), 401);
  });

  it('GET /me with an expired token is 401 TOKEN_EXPIRED', async () => {
    const { user } = await makeUser();
    const expired = jwt.sign(
      { sub: String(user._id), role: 'student', exp: Math.floor(Date.now() / 1000) - 10 },
      env.JWT_SECRET,
    );
    expectErrorShape(await http.get('/api/auth/me', expired), 401, 'TOKEN_EXPIRED');
  });

  it('GET /me with a token signed by another secret is 401', async () => {
    const { user } = await makeUser();
    const forged = jwt.sign({ sub: String(user._id), role: 'admin' }, 'x'.repeat(40));
    expectErrorShape(await http.get('/api/auth/me', forged), 401);
  });

  it('GET /me returns the current user', async () => {
    const { token, user } = await makeUser({ name: 'Me Myself' });
    const res = await http.get('/api/auth/me', token);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: String(user._id), name: 'Me Myself' });
  });

  it('a deactivated user with an old token is rejected', async () => {
    const { token, user } = await makeUser();
    await User.updateOne({ _id: user._id }, { isActive: false });
    expectErrorShape(await http.get('/api/auth/me', token), 401, 'ACCOUNT_DISABLED');
  });

  it('a student on an admin route is 403', async () => {
    const { token } = await makeUser({ role: 'student' });
    expectErrorShape(await http.get('/api/users', token), 403, 'FORBIDDEN');
  });

  it('a technician on an admin route is 403', async () => {
    const { token } = await makeUser({ role: 'technician', skills: ['electrical'] });
    expectErrorShape(await http.post('/api/users', token).send({}), 403, 'FORBIDDEN');
  });

  it('the role is read from the database, not trusted from the token', async () => {
    const { user } = await makeUser({ role: 'student' });
    const lying = jwt.sign({ sub: String(user._id), role: 'admin' }, env.JWT_SECRET);
    expectErrorShape(await http.get('/api/users', lying), 403, 'FORBIDDEN');
  });

  it('an admin can use admin routes', async () => {
    const { token } = await makeUser({ role: 'admin' });
    const res = await http.get('/api/users?limit=5', token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 5 });
  });
});

describe('logout and FCM tokens', () => {
  it('saves and removes an FCM token', async () => {
    const { token, user } = await makeUser();
    const fcm = 'fcm-token-abcdefghijklmnop';
    expect((await http.post('/api/auth/fcm-token', token).send({ token: fcm })).status).toBe(204);
    let stored = await User.findById(user._id).select('+fcmTokens');
    expect(stored.fcmTokens).toContain(fcm);
    expect((await http.post('/api/auth/logout', token).send({ fcmToken: fcm })).status).toBe(204);
    stored = await User.findById(user._id).select('+fcmTokens');
    expect(stored.fcmTokens).not.toContain(fcm);
  });

  it('logout without a body is fine', async () => {
    const { token } = await makeUser();
    expect((await http.post('/api/auth/logout', token)).status).toBe(204);
  });

  it('validates the FCM token body', async () => {
    const { token } = await makeUser();
    expectErrorShape(
      await http.post('/api/auth/fcm-token', token).send({}),
      400,
      'VALIDATION_ERROR',
    );
  });
});

describe('rate limiting', () => {
  it('limits login attempts per IP with 429', async () => {
    const limited = createApp({ authRateLimitMax: 3 });
    const body = { email: 'nobody@test.edu', password: 'whatever1' };
    for (let i = 0; i < 3; i += 1) {
      expect((await request(limited).post('/api/auth/login').send(body)).status).toBe(401);
    }
    expectErrorShape(
      await request(limited).post('/api/auth/login').send(body),
      429,
      'RATE_LIMITED',
    );
  });
});

describe('CORS', () => {
  it('allows only CLIENT_ORIGIN', async () => {
    const ok = await request(app).get('/api/health').set('Origin', env.CLIENT_ORIGIN.split(',')[0]);
    expect(ok.headers['access-control-allow-origin']).toBe(env.CLIENT_ORIGIN.split(',')[0]);
    const evil = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});
