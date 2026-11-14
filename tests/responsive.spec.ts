import { expect, test } from '@playwright/test';

for (const route of ['/', '/architecture/', '/docs/', '/docs/architecture/', '/docs/reference/api/']) {
  test(`no horizontal overflow at 375px: ${route}`, async ({ page }) => {
    await page.goto(route);
    for (let y = 0; y < 14000; y += 900) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(40);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // body uses overflow-x: clip, so also look for content that is silently cut off at the right edge.
    const cut = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= window.innerWidth + 1) continue;
        let a = el.parentElement;
        let contained = false;
        while (a && a !== document.body) {
          if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(a).overflowX)) { contained = true; break; }
          a = a.parentElement;
        }
        if (!contained) out.push(`${el.tagName}.${String(el.className).slice(0, 60)}`);
      }
      return out.slice(0, 5);
    });
    expect(cut).toEqual([]);
  });
}

test('architecture uses guided mobile layouts instead of shrunken canvases', async ({ page }) => {
  await page.goto('/architecture/');
  const ia = page.locator('#internal .ia-root');
  await ia.scrollIntoViewIfNeeded();
  await expect(ia.locator('svg.diagram-svg')).toBeHidden();
  await expect(ia.getByRole('region', { name: 'Monitored PostgreSQL (read-only)' })).toBeVisible();
  await ia.getByRole('button', { name: /Collectors/ }).first().click();
  await expect(ia.getByText('READ ONLY transaction', { exact: false }).first()).toBeVisible();
  const pt = page.locator('#production .pt-root');
  await pt.scrollIntoViewIfNeeded();
  await expect(pt.getByRole('region', { name: 'Application path' })).toBeVisible();
  await expect(pt.getByRole('region', { name: 'LockLens' })).toBeVisible();
});

test('mobile navigation menu and docs drawer', async ({ page }) => {
  await page.goto('/docs/architecture/');
  await page.getByRole('button', { name: 'Docs menu' }).click();
  const sidebar = page.getByRole('complementary', { name: 'Documentation' });
  await expect(sidebar.getByRole('link', { name: 'PostgreSQL observation & permissions' })).toBeInViewport();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#mobile-menu')).toBeVisible();
});
