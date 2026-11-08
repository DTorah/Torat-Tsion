import { expect, test } from '@playwright/test';

test('public homepage exposes accessible search, navigation, and video library', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: /search/i }).first()).toBeVisible();
  await expect(page.getByText('All Shiurim').first()).toBeVisible();
  await expect(page.getByText(/Torah Farsi/i).first()).toBeVisible();
});

test('admin route preserves an authenticated entry point', async ({ page }) => {
  await page.goto('/admin/homepage-builder');
  await expect(page.getByText(/Admin sign in/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /username/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
});

test('editor mode renders the real homepage and selects registered elements', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('torat-tsion-admin-session', 'e2e-token'));
  await page.route('**/api/admin/home-builder', async (route) => route.fulfill({ json: { draft: { design: {}, elements: {}, sections: [] }, history: [], deleted: [] } }));
  await page.route('**/api/videos', async (route) => route.fulfill({ json: { sources: [{ key: 'bakhshi', label: 'Library', videos: [] }] } }));
  await page.route('**/api/home-builder', async (route) => route.fulfill({ json: { design: {}, elements: {}, sections: [] } }));
  await page.route('**/api/admin/media', async (route) => route.fulfill({ json: { assets: [], folders: [] } }));
  await page.route('**/api/admin/home-builder/templates', async (route) => route.fulfill({ json: { templates: [] } }));
  await page.goto('/admin/homepage-builder?tab=design');
  await expect(page.getByText('EDITOR MODE')).toBeVisible();
  await expect(page.getByText(/Click any registered element/i)).toBeVisible();
});

test('custom page route is available without exposing editor controls publicly', async ({ page }) => {
  await page.goto('/page/e2e-preview');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Save draft');
  await expect(page.locator('body')).not.toContainText('Publish');
});
