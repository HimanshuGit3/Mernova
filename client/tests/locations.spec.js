import { test, expect } from '@playwright/test';
import { signInAs } from './helpers.js';

test('admin adds a room and opens its printable QR sticker', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.goto('/locations');
  await expect(page.getByRole('heading', { name: 'Rooms and QR stickers' })).toBeVisible();

  const code = `T-${Date.now().toString().slice(-5)}`;
  await page.getByRole('button', { name: 'Add room' }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Add a room' });
  await drawer.getByRole('textbox', { name: 'Code' }).fill(code);
  await drawer.getByRole('combobox', { name: 'Building' }).fill('Test Block');
  await drawer.getByRole('textbox', { name: 'Label' }).fill('Playwright Lab');
  await drawer.getByRole('button', { name: 'Add room' }).click();
  await expect(page.getByText(`${code} added`)).toBeVisible();

  await page.getByRole('textbox', { name: 'Search rooms' }).fill(code);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('row', { name: new RegExp(code) })).toHaveCount(1);
  await page.getByRole('button', { name: `Print sticker for ${code}` }).click();

  await expect(page).toHaveURL(new RegExp(`/locations/print\\?codes=${code}`));
  const sticker = page.getByRole('img', { name: `FIXIT:LOC:${code}` });
  await expect(sticker.locator('svg')).toBeVisible();
  await expect(page.getByText('Playwright Lab')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print' })).toBeEnabled();
});
