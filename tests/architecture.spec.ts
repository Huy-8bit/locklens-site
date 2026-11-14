import { expect, test } from '@playwright/test';
import { EDGES, NODES } from '../src/islands/data/topology';
import { EDGES as INTERNAL_EDGES, NODES as INTERNAL_NODES, STEPS } from '../src/islands/data/internal';

test.describe('architecture data accuracy', () => {
  test('application traffic never touches a LockLens component', () => {
    const layer = new Map(NODES.map((n) => [n.id, n.layer]));
    for (const e of EDGES.filter((x) => x.kind === 'app')) {
      expect(layer.get(e.from), e.id).not.toBe('locklens');
      expect(layer.get(e.to), e.id).not.toBe('locklens');
    }
  });
  test('monitoring edges only go from PostgreSQL servers to a LockLens server', () => {
    const byId = new Map(NODES.map((n) => [n.id, n]));
    for (const e of EDGES.filter((x) => x.kind === 'collect')) {
      expect(byId.get(e.from)?.layer, e.id).toBe('db');
      expect(byId.get(e.to)?.layer, e.id).toBe('locklens');
    }
  });
  test('replication only within one cluster', () => {
    const byId = new Map(NODES.map((n) => [n.id, n]));
    for (const e of EDGES.filter((x) => x.kind === 'repl')) expect(byId.get(e.from)?.cluster).toBe(byId.get(e.to)?.cluster);
  });
  test('every internal edge and step references existing nodes', () => {
    const ids = new Set(INTERNAL_NODES.map((n) => n.id));
    for (const e of INTERNAL_EDGES) expect(ids.has(e.from) && ids.has(e.to), e.id).toBe(true);
    const edgeIds = new Set(INTERNAL_EDGES.map((e) => e.id));
    for (const s of STEPS) {
      s.nodes.forEach((n) => expect(ids.has(n), `${s.id}:${n}`).toBe(true));
      s.edges.forEach((e) => expect(edgeIds.has(e), `${s.id}:${e}`).toBe(true));
    }
  });
});

test.describe('architecture explorer', () => {
  test('internal architecture: step controls, node details, zoom', async ({ page }) => {
    await page.goto('/architecture/#internal');
    const root = page.locator('#internal .ia-root');
    await root.scrollIntoViewIfNeeded();
    await root.getByRole('button', { name: 'Next step' }).click();
    await expect(root.getByText('Step 1 of 6').filter({ visible: true })).toBeVisible();
    await root.getByRole('button', { name: 'Next step' }).click();
    await expect(root.getByText('Step 2 of 6').filter({ visible: true })).toBeVisible();
    await root.getByRole('button', { name: 'Previous step' }).click();
    await expect(root.getByText('Step 1 of 6').filter({ visible: true })).toBeVisible();
    await root.getByRole('button', { name: 'Reset' }).click();
    await expect(root.getByText('One process, two images, one store').filter({ visible: true })).toBeVisible();
    await root.getByRole('button', { name: /^Collectors — / }).click();
    const panel = root.getByRole('complementary', { name: 'Collectors details' });
    await expect(panel).toContainText('READ ONLY transaction');
    await root.getByRole('button', { name: 'Zoom in' }).click();
    await expect(root.getByText('125%')).toBeVisible();
    await root.getByRole('button', { name: 'Fit diagram' }).click();
    await expect(root.getByText('100%')).toBeVisible();
    await root.getByRole('button', { name: 'Play architecture flow' }).click();
    await expect(root.getByText('Step 1 of 6').filter({ visible: true })).toBeVisible({ timeout: 3000 });
    await root.getByRole('button', { name: 'Pause' }).click();
  });

  test('production topology: modes, toggles, cluster focus, HA takeover', async ({ page }) => {
    await page.goto('/architecture/#production');
    const root = page.locator('#production .pt-root');
    await root.scrollIntoViewIfNeeded();
    await expect(root.locator('animateMotion')).toHaveCount(0);
    await root.getByRole('button', { name: 'Replay data flow', exact: true }).click();
    await expect.poll(() => root.locator('animateMotion').count()).toBeGreaterThan(0);
    await root.getByRole('button', { name: 'Stop replay', exact: true }).click();
    await expect(root.locator('animateMotion')).toHaveCount(0);
    for (const [label, title] of [
      ['Single instance', 'Start with one database'],
      ['Production cluster', 'Alongside a production cluster'],
      ['Microservices fleet', 'A microservices fleet with several clusters'],
    ]) {
      await root.getByRole('tab', { name: label }).click();
      await expect(root.getByRole('heading', { name: title })).toBeVisible();
    }
    await page.waitForTimeout(1200); // let the layout tween settle
    const appEdges = root.locator('svg [data-kind="app"]');
    expect(await appEdges.count()).toBeGreaterThan(10);
    await root.getByRole('button', { name: 'App traffic' }).click();
    await page.waitForTimeout(700); // CSS opacity transition
    const opacities = await appEdges.evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).opacity)));
    expect(Math.max(...opacities)).toBeLessThan(0.01);
    await root.getByRole('button', { name: 'App traffic' }).click();
    await root.getByRole('combobox', { name: 'Cluster' }).selectOption('payments');
    await root.getByRole('button', { name: /^payments-primary/ }).click();
    await expect(root.getByRole('complementary', { name: 'payments-primary details' })).toContainText('Monitored target');
    await page.locator('[data-mode-btn="ha"]').click();
    await expect(root.getByRole('heading', { name: 'Several LockLens servers, one store' })).toBeVisible();
    await root.getByRole('button', { name: 'Stop server B' }).click();
    await expect(root.getByText(/Server B stopped/)).toBeVisible();
    await expect(root.getByText(/Servers A and C took the expired leases/)).toBeVisible({ timeout: 9000 });
    await root.getByRole('button', { name: 'Restore' }).click();
  });

  test('incident simulation: start, step, pause, reset, consistent graph', async ({ page }) => {
    await page.goto('/architecture/#incident');
    const root = page.locator('#incident .is-root');
    await root.scrollIntoViewIfNeeded();
    await root.getByRole('button', { name: 'Start incident' }).click();
    await expect(root.getByText(/Scene 1 of 6/)).toBeVisible({ timeout: 3000 });
    await root.getByRole('button', { name: 'Pause' }).click();
    for (let i = 0; i < 3; i++) await root.getByRole('button', { name: 'Next step' }).click();
    await expect(root.getByText('Scene 4 of 6 · 14:02:40')).toBeVisible();
    await expect(root.locator('svg.diagram-svg')).toContainText('root · blocks 3 in total');
    await expect(root.getByText('blocking.long_chain: pid 4127 blocked 3 session(s) for 30 s across 11 samples')).toBeVisible();
    await root.getByRole('button', { name: 'Previous step' }).click();
    await expect(root.getByText('Scene 3 of 6 · 14:02:31')).toBeVisible();
    await expect(root.getByText(/No incident yet/)).toBeVisible();
    await root.getByRole('button', { name: 'LockLens detects' }).click();
    await root.getByRole('button', { name: 'Recovery' }).click();
    await expect(root.getByText('#42 · resolved · lasted 1m 24s')).toBeVisible();
    await root.getByRole('button', { name: 'Reset' }).click();
    await expect(root.getByText('Ready')).toBeVisible();
  });
});
