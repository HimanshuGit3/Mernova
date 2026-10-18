import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app.js';
import { api, makeUser } from './helpers.js';

const http = api(createApp({ authRateLimitMax: 1000 }));
let admin;

beforeAll(async () => {
  admin = await makeUser({ role: 'admin', name: 'Admin One' });
});

describe('admin user management (FR-04, FR-05)', () => {
  it('creates a technician with skills who can then log in', async () => {
    const res = await http.post('/api/users', admin.token).send({
      name: 'Ravi Kumar',
      email: 'ravi@staff.edu',
      password: 'password123',
      role: 'technician',
      skills: ['electrical', 'network', 'electrical'],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: 'technician', skills: ['electrical', 'network'] });
    const login = await http
      .post('/api/auth/login')
      .send({ email: 'ravi@staff.edu', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('technician');
  });

  it('requires skills for a technician', async () => {
    const res = await http.post('/api/users', admin.token).send({
      name: 'No Skills',
      email: 'noskills@staff.edu',
      password: 'password123',
      role: 'technician',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('skills');
  });

  it('cannot create a student through the admin endpoint', async () => {
    const res = await http.post('/api/users', admin.token).send({
      name: 'Stu Dent',
      email: 'stu@test.edu',
      password: 'password123',
      role: 'student',
    });
    expect(res.status).toBe(400);
  });

  it('creates another admin (skills ignored)', async () => {
    const res = await http.post('/api/users', admin.token).send({
      name: 'Second Admin',
      email: 'admin2@staff.edu',
      password: 'password123',
      role: 'admin',
      skills: ['plumbing'],
    });
    expect(res.status).toBe(201);
    expect(res.body.skills).toEqual([]);
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await http.post('/api/users', admin.token).send({
      name: 'Ravi Again',
      email: 'RAVI@staff.edu',
      password: 'password123',
      role: 'admin',
    });
    expect(res.status).toBe(409);
  });

  it('deactivates a user, who can no longer log in', async () => {
    const target = await makeUser({ email: 'leaving@test.edu', password: 'password123' });
    const res = await http.patch(`/api/users/${target.id}`, admin.token).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    const login = await http
      .post('/api/auth/login')
      .send({ email: 'leaving@test.edu', password: 'password123' });
    expect(login.status).toBe(403);
  });

  it('refuses to deactivate yourself', async () => {
    const res = await http.patch(`/api/users/${admin.id}`, admin.token).send({ isActive: false });
    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown user and 400 for a bad id', async () => {
    const unknown = await http
      .patch('/api/users/0123456789abcdef01234567', admin.token)
      .send({ name: 'Xx Yy' });
    expect(unknown.status).toBe(404);
    const bad = await http.patch('/api/users/not-an-id', admin.token).send({ name: 'Xx Yy' });
    expect(bad.status).toBe(400);
  });

  it('lists and filters users with pagination bounds', async () => {
    const res = await http.get('/api/users?role=technician', admin.token);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((u) => u.role === 'technician')).toBe(true);
    expect((await http.get('/api/users?limit=51', admin.token)).status).toBe(400);
    expect((await http.get('/api/users?page=0', admin.token)).status).toBe(400);
  });
});
