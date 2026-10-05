import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
test.use({ video: "on" });
async function pages(page: Page) {
  if ((page.viewportSize()?.width ?? 1200) < 800)
    await page.getByRole("button", { name: "Toggle pages" }).click();
}
async function settings(page: Page) {
  await pages(page);
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .filter({ visible: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Film titles")).toBeFocused();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
}
async function closeSettings(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeHidden();
  await expect(
    page.viewportSize()!.width < 800
      ? page.getByRole("button", { name: "Toggle pages" })
      : page.locator(".desktop-sidebar .settings-button"),
  ).toBeFocused();
}
test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/fixture.jpg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="342" height="513" fill="gray"/></svg>',
    }),
  );
});
test("Calendar groups release dates and repeats a continued heading on page two", async ({
  page,
}) => {
  await page.route("**/films.*.json", async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    const base = data.find((film: { id: string }) => film.id === "upcoming");
    const extra = Array.from({ length: 201 }, (_, i) => ({
      ...base,
      id: `release-${i}`,
      ti: `Release ${i}`,
      rd: "2026-12-01",
    }));
    await route.fulfill({
      response,
      json: [...data, ...extra, { ...base, id: "later", ti: "Unknown date", rd: null, ye: 2028 }],
    });
  });
  await page.route("**/meta.*.json", async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    data.counts.films = 208;
    await route.fulfill({ response, json: data });
  });
  await page.goto("/calendar");
  await expect(page.locator(".release-group").first()).toContainText("Released on 1 December 2026");
  await expect(page.locator(".film-row")).toHaveCount(200);
  await page.getByRole("button", { name: "Sort by Title", exact: true }).click();
  await expect(page.locator(".film-title").first()).toContainText("Release 0");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".release-group").first()).toContainText("continued");
  await expect(page.locator(".release-group")).toHaveCount(3);
  await expect(page.locator(".release-group").last()).toContainText("date unknown");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("calendar.png") });
});
test("Events show occurrences and only matching event dates", async ({ page }) => {
  await page.goto("/events");
  const live = page.locator(".event-row").filter({ hasText: "Fixture Classic A" });
  await expect(live).toContainText("Live score");
  await expect(live.locator("time")).toHaveText("14:00");
  await expect(live.getByRole("link", { name: /^Book/ })).toBeVisible();
  await live.getByRole("button", { name: "Film details", exact: true }).click();
  await expect(page.locator(".showtime-day")).toHaveCount(1);
  await page.goto("/events?day=2026-10-04");
  await expect(page.locator(".event-row")).toHaveCount(1);
  await expect(page.locator(".event-row")).toContainText("Fixture Q&A");
  await page.goto("/events?day=2026-10-03");
  await expect(page.locator(".event-row")).toHaveCount(1);
});
test("Display changes titles and rating order, persists across navigation and resets on reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  await settings(page);
  const controls = page.locator(".display-controls").filter({ visible: true });
  await controls.getByLabel("Film titles").selectOption("original");
  await expect(controls.getByRole("button", { name: "Move Letterboxd rating up" })).toBeDisabled();
  await controls.getByRole("button", { name: "Move IMDb rating up" }).focus();
  await page.keyboard.press("Enter");
  await expect(controls.getByRole("status")).toHaveText("IMDb is rating column 1 of 4.");
  await closeSettings(page);
  await expect(page.locator(".film-title").filter({ hasText: "Titre B" })).not.toContainText(
    "Fixture Classic B",
  );
  await page.getByRole("button", { name: "Sort by Title", exact: true }).click();
  await expect(page.locator(".film-title").last()).toHaveText(/Titre B/);
  await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(page.locator(".rating-card").first()).toContainText("IMDb");
  await pages(page);
  await page
    .getByRole("navigation", { name: "Film pages" })
    .filter({ visible: true })
    .getByRole("link", { name: "Classics", exact: true })
    .click();
  await expect(page.locator(".film-title").filter({ hasText: "Titre B" })).not.toContainText(
    "Fixture Classic B",
  );
  await settings(page);
  await controls.getByLabel("Film titles").selectOption("title");
  await closeSettings(page);
  await expect(page.locator(".film-title i")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".film-title i")).toHaveCount(1);
  await settings(page);
  await expect(controls.getByLabel("Film titles")).toHaveValue("both");
  await expect(controls.getByRole("listitem").first()).toContainText("Letterboxd");
  if ((page.viewportSize()?.width ?? 1200) >= 800) {
    await controls
      .locator('[title="Drag Rotten Tomatoes"]')
      .dragTo(controls.getByRole("listitem").first());
    await expect(controls.getByRole("listitem").first()).toContainText("Rotten Tomatoes");
    await expect(page.getByRole("button", { name: "Sort by RT", exact: true })).toBeVisible();
    await expect(page.locator(".film-table th").nth(2)).toContainText("RT");
  }
  const evidence = process.env.CI
    ? test.info().outputPath("settings")
    : join(homedir(), ".Codex/london-cine-info/discovery/verification");
  await mkdir(evidence, { recursive: true });
  await page.getByRole("dialog", { name: "Settings", exact: true }).evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished));
  });
  await page.screenshot({ path: join(evidence, `settings-${test.info().project.name}.png`) });
});
test("official TMDB attribution loads locally in About", async ({ page }) => {
  await page.goto("/about");
  const logo = page.getByRole("img", { name: "The Movie Database (TMDB)" });
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(
    true,
  );
  await expect(page.getByRole("article")).toContainText(
    "This product uses the TMDB API but is not endorsed or certified by TMDB.",
  );
});
test("all catalogue pages fit phone, tablet and desktop in both themes without console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const theme of ["light", "dark"] as const)
    for (const width of [390, 768, 1200]) {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: theme });
      for (const route of [
        "/",
        "/new",
        "/classics",
        "/retrospectives",
        "/events",
        "/calendar",
        "/watchlist",
        "/radar",
        "/about",
        "/privacy",
      ]) {
        await page.goto(route);
        await expect(page.locator(".catalogue-status")).toHaveCount(0);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${theme} ${width}px ${route}`,
        ).toBe(true);
      }
      await page.goto("/events");
      await expect(page.locator(".event-row")).not.toHaveCount(0);
      await page.screenshot({
        path: test.info().outputPath(`audit-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  expect(errors).toEqual([]);
});

test("Clear all has no reserved empty row and removes its compact chip row after reset", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(page.getByRole("group", { name: "Active filters", exact: true })).toHaveCount(0);
  const summary = page.locator(".filter-summary");
  const baseline = (await summary.boundingBox())!.height;
  await page.locator(".bar-search").fill("Fixture Classic");
  const chips = page.getByRole("group", { name: "Active filters", exact: true });
  await expect(chips).toBeVisible();
  expect((await summary.boundingBox())!.height - baseline).toBeLessThan(60);
  await page.screenshot({ path: test.info().outputPath("clear-all-active.png") });
  await chips.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(chips).toHaveCount(0);
  expect((await summary.boundingBox())!.height).toBe(baseline);
  await page.screenshot({ path: test.info().outputPath("clear-all-reset.png") });
});
