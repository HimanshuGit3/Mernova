import { test, expect } from '@playwright/test';
import { ACCOUNTS, api, apiLogin, signInAs } from './helpers.js';
import { SEED_PASSWORD } from '../scripts/stack.mjs';

async function loginThroughForm(page, email) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('sign in as each role', () => {
  test('admin lands on the dashboard with KPIs', async ({ page }) => {
    await loginThroughForm(page, ACCOUNTS.admin);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Arun');
    for (const kpi of ['Open issues', 'Overdue', 'Resolved this week', 'Avg resolution time']) {
      await expect(page.getByText(kpi, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  });

  test('technician lands on their jobs', async ({ page }) => {
    await loginThroughForm(page, ACCOUNTS.technician);
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole('heading', { name: 'Your jobs' })).toBeVisible();
  });

  test('student lands on My reports', async ({ page }) => {
    await loginThroughForm(page, ACCOUNTS.student);
    await expect(page).toHaveURL(/\/my-reports$/);
    await expect(page.getByRole('heading', { name: 'Your reports' })).toBeVisible();
  });

  test('wrong password shows an error and stays on login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(ACCOUNTS.admin);
    await page.getByRole('textbox', { name: 'Password' }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('incorrect');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a student cannot open admin pages', async ({ page }) => {
    await signInAs(page, 'student');
    await page.goto('/users');
    await expect(page).toHaveURL(/\/my-reports$/);
  });
});

test('admin filters issues and assigns one', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.goto('/issues');
  await page.getByRole('button', { name: /Filters/ }).click();
  await page
    .getByRole('group', { name: 'Status' })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  await expect(page).toHaveURL(/status=open/);
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    await expect(rows.nth(i).getByText('Open', { exact: true })).toBeVisible();
  }
  // the filter survives a reload (URL-synced state)
  await page.reload();
  await expect(page).toHaveURL(/status=open/);

  await rows.first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/issues\/[a-f0-9]{24}$/);
  const panel = page
    .getByRole('region', { name: /Assign a technician/ })
    .or(
      page.locator('section', { has: page.getByRole('heading', { name: 'Assign a technician' }) }),
    );
  await expect(panel.first()).toBeVisible();
  await panel.first().getByRole('button', { name: 'Assign' }).first().click();
  await expect(page.getByText(/^Assigned to /).first()).toBeVisible();
  await expect(page.getByText('Assigned', { exact: true }).first()).toBeVisible();
});

test('a student sees only their own reports', async ({ page }) => {
  const { token } = await apiLogin(ACCOUNTS.student);
  const mine = await api('GET', '/issues?limit=50', token);
  const ownTitles = new Set(mine.body.items.map((i) => i.title));

  const admin = await apiLogin(ACCOUNTS.admin);
  const all = await api('GET', '/issues?limit=50', admin.token);
  const foreign = all.body.items.find(
    (i) => !ownTitles.has(i.title) && i.reporter?.name !== 'Asha Rao',
  );
  expect(foreign).toBeTruthy();

  await signInAs(page, 'student');
  await page.goto('/my-reports');
  await page.getByRole('radio', { name: 'All' }).check({ force: true });
  await expect(page.locator('main article').first()).toBeVisible();
  const titles = await page.locator('main article h2').allTextContents();
  expect(titles.length).toBeGreaterThan(0);
  for (const t of titles) expect(ownTitles.has(t)).toBe(true);

  // someone else's issue is not reachable by URL either
  await page.goto(`/my-reports/${foreign.id}`);
  await expect(page.getByRole('heading', { name: 'Issue not found' })).toBeVisible();
});

test('a new report appears in the admin issue list without reload', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.goto('/issues');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  const title = `Live test leak ${Date.now()}`;

  const { token } = await apiLogin(ACCOUNTS.student2);
  const form = new FormData();
  form.set('title', title);
  form.set('category', 'plumbing');
  form.set('severity', 'high');
  form.set('landmark', 'Library ground floor washroom');
  const res = await fetch(`${process.env.UI_API_URL ?? 'http://localhost:5055/api'}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  expect(res.status).toBe(201);

  // the list refreshes from the socket event; a toast also announces it
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  await expect(page.getByText('New plumbing issue').first()).toBeVisible();
});

test('unknown routes show the 404 page', async ({ page }) => {
  await page.goto('/this/does/not/exist');
  await expect(page.getByRole('heading', { name: /empty/ })).toBeVisible();
});
