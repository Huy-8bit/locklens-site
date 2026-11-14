import { expect, test } from "@playwright/test";
import { NODES, EDGES } from "../src/islands/data/internal";
import { OVERVIEW_GROUPS, OVERVIEW_EDGES } from "../src/islands/data/overview";

test("overview is a complete projection of the detailed architecture", () => {
  const members = OVERVIEW_GROUPS.flatMap((g) => g.members);
  expect(new Set(members).size).toBe(members.length);
  expect([...members].sort()).toEqual(NODES.map((n) => n.id).sort());
  const membership = new Map(
    OVERVIEW_GROUPS.flatMap((g) => g.members.map((id) => [id, g.id])),
  );
  const projected = OVERVIEW_EDGES.flatMap((e) => e.sourceEdges);
  expect(projected.sort()).toEqual(
    EDGES.filter((e) => membership.get(e.from) !== membership.get(e.to))
      .map((e) => e.id)
      .sort(),
  );
});

test("comparison transforms the same signals and supports keyboard activation", async ({
  page,
}) => {
  await page.goto("/");
  const root = page.locator(".signal-comparison");
  await root.scrollIntoViewIfNeeded();
  await page
    .locator("astro-island")
    .filter({ has: root })
    .evaluate(
      (el) =>
        new Promise<void>((resolve) => {
          if (!el.hasAttribute("ssr")) resolve();
          else
            el.addEventListener("astro:hydrate", () => resolve(), {
              once: true,
            });
        }),
    );
  const fragment = await root
    .locator(".signal-fragment")
    .first()
    .elementHandle();
  await root
    .getByRole("button", { name: "With LockLens", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(root).toHaveClass(/is-connected/);
  expect(await fragment!.evaluate((el) => el.isConnected)).toBe(true);
  await expect(root).toContainText("Snapshots and timeline preserved.");
  await root
    .getByRole("button", { name: "Without LockLens", exact: true })
    .click();
  await expect(root).not.toHaveClass(/is-connected/);
});

test("investigation preserves sessions through detection and recovery", async ({
  page,
}) => {
  await page.goto("/#incident-demo");
  const root = page.locator(".investigation-experience");
  await expect(
    root.getByRole("button", { name: "Play investigation" }),
  ).toBeVisible();
  await root.getByRole("button", { name: "03 Blocking chain" }).click();
  await expect(root.locator(".experience-metrics").first()).toContainText("03");
  await expect(
    root.getByRole("img", {
      name: "Root blocker 4127 blocks 4133 and 4142; 4133 blocks 4139",
    }),
  ).toBeVisible();
  const node = await root
    .locator(".experience-graph g.experience-root")
    .elementHandle();
  await root.getByRole("button", { name: "04 Detection" }).click();
  await expect(root.locator(".evidence-status")).toContainText("Incident #42");
  expect(await node!.evaluate((el) => el.isConnected)).toBe(true);
  await root.getByRole("button", { name: "06 Recovery" }).click();
  await expect(root.locator(".evidence-status")).toContainText("resolved");
  await expect(root.locator(".experience-metrics")).toContainText("00");
  await root.getByRole("button", { name: "Reset investigation" }).click();
  await expect(root.locator(".scene-announcement")).toContainText("Scene 1");
  await root.getByRole("button", { name: "Play investigation" }).click();
  await root.getByRole("button", { name: "Pause investigation" }).click();
  await expect(
    root.getByRole("button", { name: "Play investigation" }),
  ).toBeVisible();
});

test("overview selection, flow controls, deep dive and topology keyboard", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/architecture/#internal");
  const root = page.locator(".pipeline-explorer");
  await expect(
    root.getByRole("button", { name: "Deep Dive", exact: true }),
  ).toBeEnabled();
  await root
    .getByRole("button", { name: /^Collection — .*Show details/ })
    .click();
  await expect(root.getByRole("complementary")).toContainText(
    "Included components",
  );
  await root.getByRole("button", { name: "Play overview flow" }).click();
  await expect(root.locator("animateMotion").first()).toBeAttached();
  await root.getByRole("button", { name: "Pause overview flow" }).click();
  await expect(root.locator("animateMotion")).toHaveCount(0);
  await root.getByRole("button", { name: "Reset overview" }).click();
  await expect(root.getByRole("complementary")).toHaveCount(0);
  await root.getByRole("button", { name: "Deep Dive", exact: true }).click();
  await expect(root.locator(".ia-root")).toBeVisible();
  const tab = page.getByRole("tab", {
    name: "Production cluster",
    exact: true,
  });
  await tab.scrollIntoViewIfNeeded();
  await page.locator('astro-island').filter({ has: page.locator('.pt-root') }).evaluate(el => new Promise<void>(resolve => {
    if (!el.hasAttribute('ssr')) resolve();
    else el.addEventListener('astro:hydrate', () => resolve(), { once: true });
  }));
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Microservices fleet", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Microservices fleet", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

for (const width of [390, 768, 1024, 1920])
  test(`tablet and laptop layouts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1024 });
    for (const route of [
      "/",
      "/architecture/",
      "/docs/features/query-analysis/",
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

test("reduced motion keeps investigation controls usable without animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#incident-demo");
  const root = page.locator(".investigation-experience");
  await expect(
    root.getByRole("button", { name: "Play investigation" }),
  ).toHaveCount(0);
  await root.getByRole("button", { name: "Next investigation scene" }).click();
  await expect(root.locator(".scene-announcement")).toContainText("Scene 2");
  expect(
    await root
      .locator(".experience-edge")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration)),
  ).toBeLessThan(0.001);
});

test('investigation pauses offscreen under CPU throttling', async ({ page }) => {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/#incident-demo');
  const root = page.locator('.investigation-experience');
  await root.getByRole('button', { name: 'Play investigation' }).click();
  await page.locator('footer').scrollIntoViewIfNeeded();
  const pausedScene = await root.locator('.scene-announcement').textContent();
  await page.waitForTimeout(4700);
  await expect(root.locator('.scene-announcement')).toHaveText(pausedScene!);
  await root.scrollIntoViewIfNeeded();
  await expect(root.locator('.scene-announcement')).not.toHaveText(pausedScene!, { timeout: 7000 });
  await root.getByRole('button', { name: 'Pause investigation' }).click();
  await session.detach();
});


test("published integrations preserve Prometheus and omit removed destinations", async ({ page }) => {
  for (const route of ['/docs/deployment/integrations/', '/docs/getting-started/configuration/', '/docs/architecture/production-topology/', '/docs/getting-started/ui-guide/']) {
    await page.goto(route);
    const content = page.locator('main');
    await expect(content).not.toContainText(/OpenTelemetry|Grafana|OTLP/i);
    if (!route.includes('ui-guide')) await expect(content).toContainText('Prometheus');
  }
  await page.goto('/architecture/');
  await page.getByRole('tab', { name: 'Microservices fleet', exact: true }).click();
  await expect(page.locator('main')).not.toContainText(/OpenTelemetry|Grafana|OTLP/i);
});

test("scroll narrative shares one workspace and manual controls take over", async ({ page }) => {
  await page.goto('/#incident-demo');
  const journey = page.locator('.investigation-journey');
  await expect(journey).toHaveAttribute('data-guided', 'true');
  const workspace = await journey.locator('.investigation-experience').elementHandle();
  await journey.locator('[data-chapter="2"]').scrollIntoViewIfNeeded();
  await expect(journey.locator('.investigation-experience')).toHaveAttribute('data-scene', '4');
  await journey.getByRole('button', { name: '06 Recovery' }).click();
  await expect(journey).toHaveAttribute('data-guided', 'false');
  await journey.locator('.journey-chapters').getByRole('button', { name: '01 Observe' }).click();
  await expect(journey.locator('.investigation-experience')).toHaveAttribute('data-scene', '0');
  expect(await workspace!.evaluate(el => el.isConnected)).toBe(true);
  await journey.getByRole('button', { name: '06 Recovery' }).click();
  await journey.locator('.journey-chapters').getByRole('button', { name: '01 Observe' }).click();
  await expect(journey.locator('.investigation-experience')).toHaveAttribute('data-scene', '0');
});
