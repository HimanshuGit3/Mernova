import { test, expect } from '@playwright/test';
import { ACCOUNTS, apiLogin, signInAs } from './helpers.js';
import { API_URL } from '../scripts/stack.mjs';

test.use({ viewport: { width: 1920, height: 1080 } });

test('Live Booth updates without reload when an issue is created via the API', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.goto('/live');
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible();
  const counter = page.locator('section[aria-label="Today in numbers"] p.tabular').first();
  await expect(counter).not.toHaveText('—');
  // let the counter animation settle before reading it
  await page.waitForTimeout(1200);
  const before = Number((await counter.textContent()).replace(/\D/g, ''));

  const title = `Booth demo leak ${Date.now()}`;
  const { token } = await apiLogin(ACCOUNTS.student2);
  const form = new FormData();
  form.set('title', title);
  form.set('category', 'plumbing');
  form.set('severity', 'high');
  form.set('lat', '13.1718');
  form.set('lng', '77.5362');
  const res = await fetch(`${API_URL}/issues`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  expect(res.status).toBe(201);

  // the feed shows the new report and the counter goes up, with no reload
  await expect(page.getByLabel('Live feed').getByText(title)).toBeVisible();
  await expect(counter).toHaveText(String(before + 1), { timeout: 10_000 });
  // and no reporter identity is shown anywhere on the booth screen
  await expect(page.getByText('Rahul Verma')).toHaveCount(0);
});
