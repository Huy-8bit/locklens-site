import { expect, test } from '@playwright/test';

test.describe('documentation', () => {
  test('docs home and nested routes load directly', async ({ page }) => {
    const res = await page.goto('/docs/');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Learn LockLens' })).toBeVisible();
    for (const route of ['/docs/getting-started/', '/docs/architecture/', '/docs/features/blocking-analysis/', '/docs/deployment/high-availability/', '/docs/reference/api/']) {
      const r = await page.goto(route);
      expect(r?.status(), route).toBe(200);
      await expect(page.locator('article h1')).toBeVisible();
    }
  });

  test('article features: mermaid, images, anchors, edit link, prev/next, TOC', async ({ page }) => {
    await page.goto('/docs/architecture/');
    await expect(page.locator('.mermaid-figure svg').first()).toBeVisible();
    await expect(page.locator('.prose')).not.toContainText('backend/internal');
    await expect(page.locator('.docs-source-details')).toHaveCount(0);
    await expect(page.locator('a[rel="next"]')).toHaveAttribute('href', '/docs/architecture/postgresql-observation/');
    await expect(page.locator('a[rel="prev"]')).toHaveAttribute('href', '/docs/getting-started/troubleshooting/');
    await page.locator('[data-toc-link="several-servers"]').click();
    await expect(page).toHaveURL(/#several-servers$/);
    await page.goto('/docs/features/notifications/');
    await expect(page.getByRole('link', { name: 'Edit on GitHub ↗' })).toHaveAttribute('href', 'https://github.com/Huy-8bit/locklens/edit/main/docs/notifications.md');
    const img = page.locator('.prose img').first();
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  });

  test('copy button copies the code block', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/docs/getting-started/');
    const block = page.locator('.prose .code-block').first();
    await block.getByRole('button', { name: 'Copy code to clipboard' }).click();
    await expect(block.getByRole('button', { name: 'Copy code to clipboard' })).toHaveText('Copied');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip.length).toBeGreaterThan(5);
    expect(await block.locator('pre').innerText()).toContain(clip.split('\n')[0]);
  });

  test('search with Cmd/Ctrl+K, keyboard navigation and Enter', async ({ page }) => {
    await page.goto('/docs/');
    await page.keyboard.press('ControlOrMeta+k');
    const input = page.getByRole('combobox');
    await expect(input).toBeFocused();
    await input.fill('pg_blocking_pids');
    await expect(page.locator('.search-result').first()).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.search-result[aria-selected="true"]')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname !== '/docs/');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('combobox').fill('§§§');
    await expect(page.getByText(/No results for/)).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox')).toBeHidden();
  });

  test('unknown routes return a useful 404', async ({ page }) => {
    const res = await page.goto('/docs/does-not-exist/');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'This page is not here.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Documentation' }).last()).toBeVisible();
  });
});

test('reference tables share the reading width and retain readable file links', async ({ page }) => {
  await page.goto('/docs/getting-started/configuration/');
  await expect(page.locator('article h1')).toHaveText('Configuration');
  const links = await page.locator('.prose a').allTextContents();
  expect(links.filter((label) => /\.md(?:#\S+)?$/.test(label.trim()))).toEqual([]);
  await expect(page.locator('.prose').getByRole('link', { name: 'CLI', exact: true }).first()).toHaveAttribute('href', '/docs/reference/cli/');
  const article = await page.locator('.prose').boundingBox();
  for (const table of await page.locator('.table-wrap').all()) {
    const box = await table.boundingBox();
    expect(Math.abs(box!.width - article!.width)).toBeLessThan(2);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  const table = page.locator('.table-wrap').nth(1);
  await table.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await table.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => table.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

test('query analysis keeps a readable measure and navigable command reference', async ({ page }) => {
  await page.goto('/docs/features/query-analysis/');
  await page.locator('[data-toc-link="statement-types"]').click();
  await expect(page).toHaveURL(/#statement-types$/);
  const reference = page.getByRole('region', { name: /Statement types — table/ });
  await expect(reference).toBeVisible();
  await expect(reference.getByRole('cell', { name: 'transaction', exact: true })).toBeVisible();
  const prose = await page.locator('.prose').boundingBox();
  const table = await reference.boundingBox();
  expect(prose!.width).toBeLessThanOrEqual(760);
  expect(Math.abs(table!.width - prose!.width)).toBeLessThan(2);
  await page.setViewportSize({ width: 375, height: 812 });
  await reference.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
