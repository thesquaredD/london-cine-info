import { expect, test } from "@playwright/test";

test.use({ video: "on" });

test("static search endpoints serve XML, text and route-specific HTML", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(await robots.text()).toContain("Sitemap: https://london-cine.info/sitemap.xml");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.headers()["content-type"]).toContain("xml");
  expect(await sitemap.text()).toContain("/film/classic-a/fixture-classic-a/");
  const account = await (await request.get("/account")).text();
  expect(account).toContain('name="robots" content="noindex, follow"');
  const classics = await (await request.get("/classics")).text();
  expect(classics).toContain('href="https://london-cine.info/classics"');
  expect(classics).toContain('href="/film/classic-a/fixture-classic-a/"');
  const missing = await (await request.get("/film/404.html")).text();
  expect(missing).toContain('name="robots" content="noindex, follow"');
  expect(missing).toContain("Film link unavailable");
  expect(missing).toContain('type="module"');
});

test("film programmes are readable with JavaScript disabled", async ({
  browser,
  baseURL,
}, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
    recordVideo: { dir: testInfo.outputPath("video") },
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/film/classic-a/fixture-classic-a/`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fixture Classic A (1977)");
  await expect(page.getByRole("heading", { name: "London screenings", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Book with the cinema" }).first()).toBeVisible();
  await expect(page.getByText("Programme updated", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath("film-without-javascript.png"),
    fullPage: true,
  });
  await context.close();
});

test("navigation replaces film metadata and keeps account pages out of search", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.goto("/film/classic-a/fixture-classic-a/?screening=invalid");
  await expect(page.locator(".film-expanded")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://london-cine.info/film/classic-a/fixture-classic-a/",
  );
  await expect(page.locator("#static-content")).toHaveCount(0);
  await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://london-cine.info/",
  );
  expect(await page.locator("#seo-data").textContent()).not.toContain('"@type":"Movie"');
  await page.goto("/account");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await page.goto("/classics?q=fixture");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow, max-image-preview:large",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://london-cine.info/classics",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath("catalogue.png"), fullPage: true });
  expect(errors).toEqual([]);
});
