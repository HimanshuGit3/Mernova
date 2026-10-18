import request from 'supertest';
import { User } from '../models/User.js';
import { signToken } from '../services/tokens.js';

let counter = 0;

/** Create a user directly in the database and return it with a valid token. */
export async function makeUser(overrides = {}) {
  counter += 1;
  const user = new User({
    name: overrides.name ?? `User ${counter}`,
    email: overrides.email ?? `user${counter}-${Date.now()}@test.edu`,
    role: overrides.role ?? 'student',
    skills: overrides.skills ?? [],
    department: overrides.department ?? '',
    isActive: overrides.isActive ?? true,
  });
  await user.setPassword(overrides.password ?? 'password123');
  await user.save();
  return { user, token: signToken(user), id: String(user._id) };
}

/** Small supertest wrapper: http.get(url, token) adds the bearer header when a token is given. */
export function api(app) {
  const withAuth = (req, token) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  return {
    get: (url, token) => withAuth(request(app).get(url), token),
    post: (url, token) => withAuth(request(app).post(url), token),
    patch: (url, token) => withAuth(request(app).patch(url), token),
  };
}

export function expectErrorShape(expect, res, status, code) {
  expect(res.status).toBe(status);
  expect(res.body).toHaveProperty('error.code');
  expect(res.body).toHaveProperty('error.message');
  if (code) expect(res.body.error.code).toBe(code);
  expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js:\d+/); // no stack trace (NFR-09)
}
