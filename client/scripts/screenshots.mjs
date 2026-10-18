/**
 * Visual QA screenshots (SPEC 8.4): every route, logged in as each relevant role, at
 * 1440×900 and 390×844, in light and dark, into docs/screenshots/web/.
 *
 *   npm run screenshots -w client                 all routes
 *   npm run screenshots -w client -- live insights   only routes whose name contains a filter word
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { startStack, API_URL, WEB_URL, SEED_PASSWORD } from './stack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', '..', 'docs', 'screenshots', 'web');
const filters = process.argv.slice(2).map((f) => f.toLowerCase());

const ACCOUNTS = {
  admin: 'admin@fixit.campus',
  technician: 'ravi.tech@fixit.campus',
  student: 'asha@student.fixit.campus',
};
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const THEMES = ['light', 'dark'];

async function login(email) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  return res.json();
}

async function get(pathname, token) {
  const res = await fetch(`${API_URL}${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

/** Build the route list from live seed data (ids differ per seed). */
async function routes() {
  const admin = await login(ACCOUNTS.admin);
  const tech = await login(ACCOUNTS.technician);
  const student = await login(ACCOUNTS.student);
  const open = (await get('/issues?status=open&sort=priority&limit=1', admin.token)).items[0];
  const closed = (await get('/issues?status=closed&limit=1', admin.token)).items[0];
  const job = (await get('/issues?status=assigned,in_progress&sort=priority&limit=1', tech.token)).items[0];
  const mineResolved = (await get('/issues?status=resolved,closed&limit=1', student.token)).items[0];
  const extra = globalThis.EXTRA_ROUTES ?? [];
  return [
    { role: null, name: 'login', path: '/login' },
    { role: null, name: 'register', path: '/register' },
    { role: null, name: 'not-found', path: '/no-such-page' },
    { role: 'admin', token: admin.token, name: 'dashboard', path: '/dashboard', waitMap: true },
    { role: 'admin', token: admin.token, name: 'issues', path: '/issues' },
    { role: 'admin', token: admin.token, name: 'issues-filtered', path: '/issues?status=open,reopened&severity=high,critical&sort=priority' },
    { role: 'admin', token: admin.token, name: 'issue-open', path: `/issues/${open.id}`, waitMap: true },
    { role: 'admin', token: admin.token, name: 'issue-closed', path: `/issues/${closed.id}`, waitMap: true },
    { role: 'admin', token: admin.token, name: 'map', path: '/map', waitMap: true },
    { role: 'admin', token: admin.token, name: 'users', path: '/users' },
    { role: 'technician', token: tech.token, name: 'jobs', path: '/jobs' },
    { role: 'technician', token: tech.token, name: 'job', path: `/jobs/${job.id}`, waitMap: true },
    { role: 'student', token: student.token, name: 'my-reports', path: '/my-reports' },
    { role: 'student', token: student.token, name: 'my-report-fixed', path: `/my-reports/${mineResolved.id}`, waitMap: true },
    { role: 'student', token: student.token, name: 'report', path: '/report' },
    { role: 'student', token: student.token, name: 'fixed-feed', path: '/fixed' },
    ...extra.map((r) => ({ ...r, token: r.role === 'admin' ? admin.token : r.role === 'technician' ? tech.token : student.token })),
  ];
}

async function settle(page, { waitMap }) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // wait until skeletons are gone
  await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, null, { timeout: 15000 }).catch(() => {});
  if (waitMap) {
    await page
      .waitForFunction(() => [...document.querySelectorAll('.leaflet-tile')].every((t) => t.complete), null, { timeout: 15000 })
      .catch(() => {});
  }
  await page.waitForTimeout(400);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const stack = await startStack({ quiet: true });
  const browser = await chromium.launch();
  let count = 0;
  try {
    const all = await routes();
    const selected = filters.length ? all.filter((r) => filters.some((f) => r.name.includes(f))) : all;
    for (const route of selected) {
      for (const vp of VIEWPORTS) {
        for (const theme of THEMES) {
          const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
          await context.addInitScript(
            ([token, th]) => {
              if (token) localStorage.setItem('fixit-token', token);
              localStorage.setItem('fixit-theme', th);
            },
            [route.token ?? null, theme],
          );
          const page = await context.newPage();
          await page.goto(`${WEB_URL}${route.path}`);
          await settle(page, route);
          const file = path.join(outDir, `${route.role ?? 'public'}-${route.name}-${vp.name}-${theme}.png`);
          await page.screenshot({ path: file, fullPage: route.fullPage ?? true });
          count += 1;
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    stack.stop();
  }
  console.log(`Saved ${count} screenshots to ${path.relative(process.cwd(), outDir)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
