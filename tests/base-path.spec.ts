import { expect, test } from "@playwright/test";
const base = process.env.BASE_PATH;
test("GitHub Pages prefix preserves assets, navigation, islands and search", async ({
  page,
}) => {
  test.skip(
    !base || base === "/",
    "Run against the prefixed production build.",
  );
  const prefix = base!.replace(/\/$/, "");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith("http://127.0.0.1"))
      errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(`${prefix}/`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "PostgreSQL",
  );
  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Architecture", exact: true }),
  ).toHaveAttribute("href", `${prefix}/architecture/`);
  await page.goto(`${prefix}/architecture/#internal`);
  await page
    .locator("#internal")
    .getByRole("button", { name: "Deep Dive", exact: true })
    .click();
  await expect(page.locator(".ia-root")).toBeVisible();
  await page.goto(`${prefix}/docs/architecture/`);
  await page.getByRole("button", { name: "Search documentation" }).click();
  await page.getByRole("combobox").fill("blocking");
  const result = page.locator("#search-results a").first();
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("href", new RegExp(`${prefix}/docs/`));
  await result.click();
  await expect(page).toHaveURL(new RegExp(`${prefix}/docs/`));
  expect(errors).toEqual([]);
});
