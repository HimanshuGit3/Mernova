/**
 * Visual QA screenshots (SPEC 8.4): every route, logged in as each relevant role, at
 * 1440×900 and 390×844, in light and dark, into docs/screenshots/web/.
 *
 *   npm run screenshots -w client                 all routes
 *   npm run screenshots -w client -- live insights   only routes whose name contains a filter word
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { startStack, API_URL, WEB_URL, SEED_PASSWORD } from './stack.mjs';
import { artSvg } from '../../server/scripts/seedArt.js';

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
  { name: 'booth', width: 1920, height: 1080 }, // Live Booth screen (SPEC phase 9)
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
  const res = await fetch(`${API_URL}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/** Build the route list from live seed data (ids differ per seed). */
async function routes() {
  const admin = await login(ACCOUNTS.admin);
  const tech = await login(ACCOUNTS.technician);
  const student = await login(ACCOUNTS.student);
  const open = (await get('/issues?status=open&sort=priority&limit=1', admin.token)).items[0];
  const closed = (await get('/issues?status=closed&limit=1', admin.token)).items[0];
  const job = (await get('/issues?status=assigned,in_progress&sort=priority&limit=1', tech.token))
    .items[0];
  const mineResolved = (await get('/issues?status=resolved,closed&limit=1', student.token))
    .items[0];
  // AI demo: report a photo in the room of a recent open electrical issue → chip + duplicate panel
  const recent = (
    await get('/issues?status=open,assigned&category=electrical&sort=newest&limit=20', admin.token)
  ).items.find((i) => i.locationRef && Date.now() - new Date(i.createdAt) < 6 * 24 * 36e5);
  const photoFile = path.join(os.tmpdir(), 'fixit-electrical.jpg');
  await sharp(Buffer.from(artSvg('electrical', 2)))
    .jpeg()
    .toFile(photoFile);
  const reportWithPhoto = async (page) => {
    if (recent) {
      await page.getByLabel('Building').selectOption(recent.locationRef.building);
      await page.getByLabel('Room').selectOption(recent.locationRef.id);
    }
    await page.getByLabel('Photo', { exact: true }).setInputFiles(photoFile);
    await page
      .getByText(/^AI: /)
      .first()
      .waitFor({ timeout: 30000 })
      .catch(() => {});
  };
  const extra = [{ role: 'student', name: 'report-ai', path: '/report', action: reportWithPhoto }];
  return [
    { role: null, name: 'login', path: '/login' },
    { role: null, name: 'register', path: '/register' },
    { role: null, name: 'not-found', path: '/no-such-page' },
    { role: 'admin', token: admin.token, name: 'dashboard', path: '/dashboard', waitMap: true },
    { role: 'admin', token: admin.token, name: 'issues', path: '/issues' },
    {
      role: 'admin',
      token: admin.token,
      name: 'issues-filtered',
      path: '/issues?status=open,reopened&severity=high,critical&sort=priority',
    },
    {
      role: 'admin',
      token: admin.token,
      name: 'issue-open',
      path: `/issues/${open.id}`,
      waitMap: true,
    },
    {
      role: 'admin',
      token: admin.token,
      name: 'issue-closed',
      path: `/issues/${closed.id}`,
      waitMap: true,
    },
    { role: 'admin', token: admin.token, name: 'map', path: '/map', waitMap: true },
    { role: 'admin', token: admin.token, name: 'insights', path: '/insights', waitMap: true },
    {
      role: 'admin',
      token: admin.token,
      name: 'live',
      path: '/live',
      waitMap: true,
      fullPage: false,
      viewports: ['booth', 'desktop', 'mobile'],
    },
    { role: 'admin', token: admin.token, name: 'users', path: '/users' },
    { role: 'admin', token: admin.token, name: 'locations', path: '/locations' },
    {
      role: 'admin',
      token: admin.token,
      name: 'qr-sheet',
      path: '/locations/print?building=Academic%20Block%20B',
      print: true,
    },
    { role: 'technician', token: tech.token, name: 'jobs', path: '/jobs' },
    { role: 'technician', token: tech.token, name: 'job', path: `/jobs/${job.id}`, waitMap: true },
    { role: 'student', token: student.token, name: 'my-reports', path: '/my-reports' },
    {
      role: 'student',
      token: student.token,
      name: 'my-report-fixed',
      path: `/my-reports/${mineResolved.id}`,
      waitMap: true,
    },
    { role: 'student', token: student.token, name: 'report', path: '/report' },
    { role: 'student', token: student.token, name: 'fixed-feed', path: '/fixed' },
    ...extra.map((r) => ({
      ...r,
      token:
        r.role === 'admin' ? admin.token : r.role === 'technician' ? tech.token : student.token,
    })),
  ];
}

async function settle(page, { waitMap }) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // wait until skeletons are gone
  await page
    .waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, null, {
      timeout: 15000,
    })
    .catch(() => {});
  if (waitMap) {
    await page
      .waitForFunction(
        () => [...document.querySelectorAll('.leaflet-tile')].every((t) => t.complete),
        null,
        { timeout: 15000 },
      )
      .catch(() => {});
  }
  await page.waitForTimeout(400);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const stack = await startStack({ quiet: true, ai: true });
  const browser = await chromium.launch();
  let count = 0;
  const overflow = [];
  try {
    const all = await routes();
    const selected = filters.length
      ? all.filter((r) => filters.some((f) => r.name.includes(f)))
      : all;
    for (const route of selected) {
      for (const vp of VIEWPORTS) {
        if (route.print && vp.name !== 'desktop') continue; // a printed A4 sheet has no phone layout
        if (!(route.viewports ?? ['desktop', 'mobile']).includes(vp.name)) continue;
        for (const theme of THEMES) {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            reducedMotion: 'reduce',
            deviceScaleFactor: 1,
          });
          await context.addInitScript(
            ([token, th]) => {
              if (token) localStorage.setItem('fixit-token', token);
              localStorage.setItem('fixit-theme', th);
            },
            [route.token ?? null, theme],
          );
          const page = await context.newPage();
          if (route.print) await page.emulateMedia({ media: 'print' });
          await page.goto(`${WEB_URL}${route.path}`);
          await settle(page, route);
          if (route.action) {
            await route.action(page);
            await settle(page, route);
          }
          const file = path.join(
            outDir,
            `${route.role ?? 'public'}-${route.name}-${vp.name}-${theme}.png`,
          );
          const width = await page.evaluate(() => document.documentElement.scrollWidth);
          if (width > vp.width + 1)
            overflow.push(
              `${route.role ?? 'public'}-${route.name}-${vp.name}-${theme}: ${width}px`,
            );
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
  if (overflow.length) {
    console.log('Horizontal overflow (page wider than the viewport):');
    for (const o of overflow) console.log(`  ${o}`);
  } else {
    console.log('No horizontal overflow on any page.');
  }
  process.exit(overflow.length ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
