import { expect, test } from '@playwright/test';

test('public homepage exposes accessible search, navigation, and video library', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: /search/i }).first()).toBeVisible();
  await expect(page.getByText('All Shiurim').first()).toBeVisible();
  await expect(page.getByText(/Torat Sion/i).first()).toBeVisible();
});

test('admin route preserves an authenticated entry point', async ({ page }) => {
  await page.goto('/admin/homepage-builder');
  await expect(page.getByText(/Admin sign in/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /username/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
});

test('custom page route is available without exposing editor controls publicly', async ({ page }) => {
  await page.goto('/page/e2e-preview');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Save draft');
  await expect(page.locator('body')).not.toContainText('Publish');
});
