import { expect, test } from '@playwright/test';

test.describe('landing page', () => {
  test('renders every section, navigation and CTAs without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('PostgreSQL');
    for (const name of ['Features', 'Architecture', 'Interactive demo', 'Documentation']) {
      await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs/');
    for (const id of ['problem-title', 'showcase-title', 'arch-title', 'features-title', 'quick-start', 'incident-demo']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.getByRole('link', { name: 'Explore LockLens' })).toHaveAttribute('href', '/#features');
    await expect(page.getByRole('link', { name: 'View architecture' })).toHaveAttribute('href', '/architecture/');
    // Scroll through to hydrate islands and load lazy images.
    for (let y = 0; y < 16000; y += 800) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(60);
    }
    const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
    expect(broken).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('focused landing routes visitors to the demo and quickstart', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Launch interactive demo' }).click();
    await expect(page).toHaveURL(/architecture\/#incident$/);
    await expect(page.locator('#incident .is-root')).toBeVisible();
    await page.goto('/#quick-start');
    await expect(page.locator('#quick-start')).toContainText('make lab-up');
    await expect(page.locator('#quick-start').getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/docs/getting-started/');
  });

  test('decorative motion can be paused and resumed', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Pause decorative motion' }).click();
    await expect(page.locator('.signal-particles')).toHaveCSS('animation-play-state', 'paused');
    await page.getByRole('button', { name: 'Resume decorative motion' }).click();
    await expect(page.locator('.signal-particles')).toHaveCSS('animation-play-state', 'running');
  });

  test('reduced motion retains the hero without autoplay', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('.signal-landscape')).toBeVisible();
    await expect(page.locator('.signal-particles')).toHaveCSS('animation-name', 'none');
    await ctx.close();
  });
});
