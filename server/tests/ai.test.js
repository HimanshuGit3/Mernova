import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createApp } from '../app.js';
import { Issue } from '../models/Issue.js';
import { setAiService, analyseImage, cosineSimilarity } from '../services/ai.js';
import { scoreCategories } from '../services/clip.js';
import { api, makeUser } from './helpers.js';
import { jpeg, PDF, makeIssue, makeLocation } from './fixtures.js';
import { createFakeAi } from './fakeAi.js';

const http = api(createApp({ authRateLimitMax: 1000 }));
const RED = '#d02020';
const BLUE = '#2040d0';
const CENTER = { lat: 13.1718, lng: 77.5362 };
// ~111 m north of the centre: outside the 50 m duplicate radius
const FAR = { lat: 13.1728, lng: 77.5362 };

let alice, bob, tech, room;

beforeAll(async () => {
  alice = await makeUser({ name: 'AI Alice' });
  bob = await makeUser({ name: 'AI Bob' });
  tech = await makeUser({ role: 'technician', skills: ['electrical'] });
  room = await makeLocation({ code: 'AI-101', building: 'AI Block', ...CENTER });
  setAiService(createFakeAi());
});

afterEach(() => setAiService(createFakeAi()));

function analyse(who, colour, fields = CENTER) {
  return jpeg({ color: colour }).then((photo) => {
    const req = http.post('/api/issues/analyse', who.token);
    for (const [k, v] of Object.entries(fields)) req.field(k, String(v));
    return req.attach('photo', photo, { filename: 'p.jpg', contentType: 'image/jpeg' });
  });
}

async function report(who, colour, fields = CENTER, extra = {}) {
  const req = http
    .post('/api/issues', who.token)
    .field('title', extra.title ?? 'Sparking socket')
    .field('category', extra.category ?? 'electrical')
    .field('severity', 'high');
  for (const [k, v] of Object.entries(fields)) req.field(k, String(v));
  const res = await req.attach('photo', await jpeg({ color: colour }), {
    filename: 'p.jpg',
    contentType: 'image/jpeg',
  });
  expect(res.status).toBe(201);
  return res.body;
}

describe('POST /api/issues/analyse (FR-51)', () => {
  it('suggests a category with confidence and finds no duplicates on a fresh campus', async () => {
    const res = await analyse(alice, RED);
    expect(res.status).toBe(200);
    expect(res.body.suggestion).toEqual({ category: 'electrical', confidence: 0.9 });
    expect(res.body.duplicates).toEqual([]);
    expect(res.body.ai).toBe('ready');
  });

  it('requires a real photo', async () => {
    expect((await http.post('/api/issues/analyse', alice.token).field('lat', '13.1')).status).toBe(
      400,
    );
    const pdf = await http
      .post('/api/issues/analyse', alice.token)
      .attach('photo', PDF, { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(pdf.status).toBe(400);
  });

  it('technicians cannot use it (403) and it needs a token (401)', async () => {
    expect((await analyse(tech, RED)).status).toBe(403);
    expect((await http.post('/api/issues/analyse')).status).toBe(401);
  });

  it('carries on without a suggestion when the AI fails', async () => {
    setAiService(createFakeAi({ fail: true }));
    const res = await analyse(alice, RED);
    expect(res.status).toBe(200);
    expect(res.body.suggestion).toBeNull();
  });

  it('times out slow AI calls instead of blocking (AI_TIMEOUT_MS)', async () => {
    setAiService(createFakeAi({ delayMs: 3000 }));
    const started = Date.now();
    const res = await analyse(alice, RED);
    expect(res.status).toBe(200);
    expect(res.body.suggestion).toBeNull();
    expect(Date.now() - started).toBeLessThan(2500);
  });
});

describe('duplicate detection (FR-52, D7)', () => {
  let original;
  beforeAll(async () => {
    original = await report(alice, RED, CENTER, { title: 'Socket sparking in AI-101' });
  });

  it('stores the image embedding on create (never returned by the API)', async () => {
    const stored = await Issue.findById(original.id).select('+embedding');
    expect(stored.embedding).toHaveLength(3);
    expect(original).not.toHaveProperty('embedding');
  });

  it('offers a similar photo nearby as a duplicate, without reporter identity', async () => {
    const res = await analyse(bob, RED);
    expect(res.body.duplicates).toHaveLength(1);
    const d = res.body.duplicates[0];
    expect(d).toMatchObject({
      id: original.id,
      title: 'Socket sparking in AI-101',
      category: 'electrical',
      status: 'open',
    });
    expect(d.similarity).toBeGreaterThanOrEqual(0.88);
    expect(d.distanceM).toBeLessThan(5);
    expect(d).not.toHaveProperty('reporter');
    expect(JSON.stringify(d)).not.toContain('AI Alice');
  });

  it('ignores a dissimilar photo at the same spot', async () => {
    const res = await analyse(bob, BLUE);
    expect(res.body.duplicates).toEqual([]);
  });

  it('ignores the same photo outside the radius', async () => {
    const res = await analyse(bob, RED, FAR);
    expect(res.body.duplicates).toEqual([]);
  });

  it('matches by room when a QR location is given', async () => {
    const inRoom = await report(
      alice,
      '#30c030',
      { locationId: String(room._id) },
      { title: 'Bin overflowing', category: 'cleanliness' },
    );
    const res = await analyse(bob, '#30c030', { locationId: String(room._id) });
    expect(res.body.duplicates.map((d) => d.id)).toContain(inRoom.id);
  });

  it('skips old, closed and own issues', async () => {
    const old = await makeIssue(alice.user, {
      point: { type: 'Point', coordinates: [CENTER.lng, CENTER.lat] },
      embedding: [1, 0, 0],
      createdAt: new Date(Date.now() - 8 * 24 * 36e5),
    });
    const closed = await makeIssue(alice.user, {
      status: 'closed',
      point: { type: 'Point', coordinates: [CENTER.lng, CENTER.lat] },
      embedding: [1, 0, 0],
    });
    const bobs = await makeIssue(bob.user, {
      point: { type: 'Point', coordinates: [CENTER.lng, CENTER.lat] },
      embedding: [1, 0, 0],
    });
    const res = await analyse(bob, RED);
    const ids = res.body.duplicates.map((d) => d.id);
    expect(ids).not.toContain(String(old._id));
    expect(ids).not.toContain(String(closed._id));
    expect(ids).not.toContain(String(bobs._id));
  });

  it('returns at most 3 candidates, best first', async () => {
    for (let i = 0; i < 4; i += 1) await report(alice, RED, CENTER, { title: `Extra ${i}` });
    const res = await analyse(bob, RED);
    expect(res.body.duplicates).toHaveLength(3);
    const sims = res.body.duplicates.map((d) => d.similarity);
    expect(sims).toEqual([...sims].sort((a, b) => b - a));
  });

  it('"Me too" on a candidate raises its priority instead of creating an issue', async () => {
    const before = await Issue.countDocuments();
    const res = await http.post(`/api/issues/${original.id}/support`, bob.token);
    expect(res.status).toBe(200);
    expect(res.body.priorityScore).toBe(original.priorityScore + 8);
    expect(await Issue.countDocuments()).toBe(before);
    const again = await analyse(bob, RED);
    expect(again.body.duplicates.find((d) => d.id === original.id).supportedByMe).toBe(true);
  });

  it('GET /duplicates works without a photo (same category nearby)', async () => {
    const res = await http.get(
      `/api/issues/duplicates?lat=${CENTER.lat}&lng=${CENTER.lng}&category=electrical`,
      bob.token,
    );
    expect(res.status).toBe(200);
    expect(res.body.duplicates.length).toBeGreaterThan(0);
    expect(
      res.body.duplicates.every((d) => d.category === 'electrical' && d.similarity === null),
    ).toBe(true);
    expect((await http.get('/api/issues/duplicates', bob.token)).status).toBe(400);
  });
});

describe('CLIP scoring maths', () => {
  it('cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
  });

  it('scoreCategories sums prompt probabilities per category', () => {
    const prompts = [
      { category: 'electrical', vector: [1, 0] },
      { category: 'electrical', vector: [0.9, 0.1] },
      { category: 'plumbing', vector: [0, 1] },
    ];
    const r = scoreCategories([1, 0], prompts);
    expect(r.category).toBe('electrical');
    expect(r.confidence).toBeGreaterThan(0.99);
    expect(Object.values(r.scores).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it('analyseImage falls back to classify + embed when analyse is missing', async () => {
    const fake = createFakeAi();
    setAiService({ status: fake.status, classify: fake.classify, embed: fake.embed });
    const res = await analyseImage(await jpeg({ color: BLUE }));
    expect(res.suggestion.category).toBe('plumbing');
    expect(res.embedding).toHaveLength(3);
  });
});
