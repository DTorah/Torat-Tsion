import { expect, test } from '@playwright/test';

const videos = Array.from({ length: 40 }, (_, i) => ({
  id: `class-${i}`, title: `${i % 2 ? 'Emunah' : 'Halacha'} lesson ${i}`,
  publishedAt: '2026-11-01T12:00:00Z', embedUrl: `https://www.youtube.com/embed/class-${i}`,
}));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/videos', (route) => route.fulfill({ json: { sources: [{ key: 'bakhshi', videos }] } }));
  await page.route('**/api/home-builder', (route) => route.fulfill({ json: { sections: [{ id: 'empty-keyword', type: 'keyword-shelf', title: 'Unmatched keyword', videoIds: [] }] } }));
});

test('keyword shelves group matches and load more without rendering the entire catalog', async ({ page }) => {
  await page.goto('/');
  const halacha = page.locator('#topic-halacha');
  await expect(halacha.getByLabel(/^Play Halacha/)).toHaveCount(8);
  await expect(halacha.getByLabel(/^Play Emunah/)).toHaveCount(0);
  await expect(page.getByText('Unmatched keyword', { exact: true })).toHaveCount(0);
  await halacha.getByLabel('Load more Halacha').click();
  await expect(halacha.getByLabel(/^Play Halacha/)).toHaveCount(16);
  await expect(page.locator('#new').getByLabel(/^Play /)).toHaveCount(8);
  await page.getByRole('textbox', { name: 'Search Rabbi Bakhshi shiurim' }).fill('Emunah');
  await expect(page.locator('#topic-halacha')).toHaveCount(0);
  await expect(page.locator('#topic-emunah').getByLabel(/^Play Emunah/)).toHaveCount(8);
});

test('mobile search and library fit within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#topic-halacha')).toBeVisible();
  const search = page.getByRole('textbox', { name: 'Search Rabbi Bakhshi shiurim' });
  await expect(search).toBeVisible();
  const bounds = await search.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
