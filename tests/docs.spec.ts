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
    await expect(page.getByRole('link', { name: 'Edit on GitHub ↗' })).toHaveAttribute('href', 'https://github.com/Huy-8bit/locklens/edit/main/docs/architecture.md');
    await expect(page.locator('a[rel="next"]')).toHaveAttribute('href', '/docs/architecture/postgresql-observation/');
    await expect(page.locator('a[rel="prev"]')).toHaveAttribute('href', '/docs/getting-started/troubleshooting/');
    await page.locator('[data-toc-link="several-servers"]').click();
    await expect(page).toHaveURL(/#several-servers$/);
    await page.goto('/docs/architecture/postgresql-observation/');
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
