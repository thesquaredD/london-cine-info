import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/image.tmdb.org/**", (route) =>
    route.fulfill({ status: 404, body: "No fixture image" }),
  );
});

const listTitles = (page: Page) =>
  page
    .locator(".film-row .film-title-text")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("title")));
const posterTitles = (page: Page) =>
  page
    .locator(".poster-card")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));

test("posters show the same films in the same order and keep browsing choices", async ({
  page,
}) => {
  const address = "/?q=a&sort=year&order=asc";
  await page.goto(address);
  await expect(page.locator(".film-row").first()).toBeVisible();
  const list = await listTitles(page);
  expect(list.length).toBeGreaterThan(1);
  const status = await page.locator(".result-status").textContent();

  await page.getByRole("button", { name: "Posters" }).click();
  await expect(page.locator(".poster-card").first()).toBeVisible();
  expect(await posterTitles(page)).toEqual(list);
  expect(await page.locator(".result-status").textContent()).toBe(status);
  const url = new URL(page.url());
  expect(`${url.pathname}${url.search}`).toBe(address);
  await expect(page.getByRole("button", { name: "Posters" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // A sort change in the poster view reaches the list unchanged.
  await page.locator(".results-heading .mobile-sort-trigger").click();
  await page.getByLabel("Sort by", { exact: true }).selectOption("title");
  await page.getByRole("button", { name: "Close sort films" }).click();
  const posters = await posterTitles(page);
  await page.getByRole("button", { name: "List" }).click();
  expect(await listTitles(page)).toEqual(posters);
});

test("the poster choice is remembered and Events stays an agenda", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Posters" }).click();
  await expect(page.locator(".poster-card").first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("london-cine.film-view.v1"))).toBe(
    "posters",
  );
  await page.reload();
  await expect(page.locator(".poster-card").first()).toBeVisible();
  await expect(page.locator(".film-table")).toHaveCount(0);

  await page.goto("/events");
  await expect(page.locator(".view-switch")).toHaveCount(0);
  await expect(page.locator(".poster-card")).toHaveCount(0);

  await page.goto("/");
  await page.getByRole("button", { name: "List" }).click();
  await page.reload();
  await expect(page.locator(".film-row").first()).toBeVisible();
  await expect(page.locator(".poster-card")).toHaveCount(0);
});

test("one press opens details and screenings, and focus returns to the poster", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("london-cine.film-view.v1", "posters"));
  await page.goto("/");
  const card = page.locator(".poster-card").first();
  await expect(card).toBeVisible();
  const title = await card.getAttribute("aria-label");
  const boxes = () =>
    page
      .locator(".poster-card")
      .evaluateAll((nodes) =>
        nodes.slice(0, 12).map((node) => JSON.stringify(node.getBoundingClientRect())),
      );
  const before = await boxes();
  if (page.viewportSize()!.width >= 800) {
    await page.locator(".poster-card").nth(1).hover();
    expect(await boxes()).toEqual(before);
  }
  // Fallback artwork names the film when the poster image is unavailable.
  await expect(card.locator(".poster-fallback-title")).toHaveText(title!.split(",")[0]!);

  await card.focus();
  await card.press("Enter");
  const dialog = page.getByRole("dialog", { name: title!.split(",")[0]! });
  await expect(dialog.locator(".film-expanded")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("film")).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(card).toBeFocused();
  expect(new URL(page.url()).searchParams.get("film")).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("posters respect hidden watchlist ratings", async ({ page }) => {
  const manifest = JSON.parse(readFileSync("src/generated/manifest.json", "utf8"));
  const films = JSON.parse(readFileSync(`public${manifest.films}`, "utf8"));
  const slugs = films.flatMap((film: { ra: { lb?: { url: string } } }) =>
    film.ra.lb ? [new URL(film.ra.lb.url).pathname.split("/")[2]] : [],
  );
  const stamp = 1791018000;
  const user = { id: "u", email: "fixture@example.com", username: "fixture", pending: false };
  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { user: { ...user, fetchedAt: stamp } } }),
  );
  await page.route("**/api/watchlist", (route) =>
    route.fulfill({ json: { slugs, count: slugs.length, fetchedAt: stamp, username: "fixture" } }),
  );
  await page.route("**/api/cinemas", (route) =>
    route.fulfill({ json: { venues: [], version: 0 } }),
  );
  await page.addInitScript(() => {
    localStorage.setItem("london-cine.film-view.v1", "posters");
    localStorage.setItem("london-cine.hide-watchlist-ratings.v1", "true");
  });
  await page.goto("/watchlist");
  const card = page.locator(".poster-card").first();
  await expect(card).toBeVisible();
  await expect(card).toHaveAccessibleName(/on your watchlist$/);
  await expect(page.locator(".poster-info-facts", { hasText: /\b(LB|IMDb|MC|RT)\b/ })).toHaveCount(
    0,
  );
  await page.goto("/");
  await expect(page.locator(".poster-info-facts", { hasText: "LB" }).first()).toBeAttached();
});

test("a film opened from a link returns focus to its poster, and Back does not reopen it", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("london-cine.film-view.v1", "posters"));
  await page.goto("/");
  const key = await page.locator(".poster-item").nth(1).getAttribute("data-film-key");
  await page.goto(`/?film=${encodeURIComponent(key!)}`);
  const dialog = page.locator(".poster-film-dialog");
  await expect(dialog.locator(".film-expanded")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator(`[data-film-key="${key}"] .poster-card`)).toBeFocused();

  // Opened by a press, closed, then Back: the previous page shows, not the dialog again.
  await page.goto("/");
  await page.locator(".poster-card").first().click();
  await expect(dialog.locator(".film-expanded")).toBeVisible();
  await page.getByRole("button", { name: /^Close / }).click();
  await expect(dialog).toBeHidden();
  expect(new URL(page.url()).searchParams.get("film")).toBeNull();
  await page.goBack();
  await expect(page.locator(".poster-card").first()).toBeVisible();
  await expect(dialog).toBeHidden();
});

test("the list keeps its own control hover and row toggling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Pointer hover only");
  await page.goto("/?sort=title&order=asc");
  const chip = page.getByRole("button", { name: "Clear sort" });
  await chip.hover();
  expect(await chip.evaluate((node) => getComputedStyle(node).textDecorationLine)).toBe(
    "underline",
  );
  const row = page.locator(".film-row .film-title").first();
  await row.click();
  await expect(page.locator(".expanded-row")).toBeVisible();
  await row.click();
  await expect(page.locator(".expanded-row")).toHaveCount(0);

  await page.getByRole("button", { name: "Posters" }).click();
  await chip.hover();
  expect(await chip.evaluate((node) => getComputedStyle(node).textDecorationLine)).toBe("none");
  const next = page.getByRole("button", { name: "Next page" });
  const box = await next.boundingBox();
  if (box) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
});

test.describe("touch", () => {
  test.use({ hasTouch: true });
  test("one tap opens a poster's details and screenings", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("london-cine.film-view.v1", "posters"));
    await page.goto("/");
    const card = page.locator(".poster-card").first();
    await card.tap();
    await expect(page.locator(".poster-film-dialog .film-expanded")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("film")).toBeTruthy();
  });
});

test("the poster film sheet holds its size and place while screenings load", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Widths are set per test");
  // Each width holds the screenings until the loading sheet has been measured.
  let release = () => {};
  let held = Promise.resolve();
  await page.route(/\/showtimes[^/]*\/[^/]+\.json$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.addInitScript(() => localStorage.setItem("london-cine.film-view.v1", "posters"));
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [1440, 900],
  ] as const) {
    held = new Promise<void>((resolve) => (release = resolve));
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.locator(".poster-card").first().click();
    const dialog = page.locator(".poster-film-dialog");
    await expect(dialog.getByText("Loading screenings…")).toBeVisible();
    await dialog.evaluate((node) =>
      Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
    const loading = await dialog.boundingBox();
    release();
    await expect(dialog.locator(".showtime-day").first()).toBeVisible();
    const loaded = await dialog.boundingBox();
    expect(loaded, `${width}px`).toEqual(loading);
    // Phones get the full-width bottom sheet; wider screens a centred sheet.
    if (width < 800) {
      // clientWidth excludes classic scrollbars (Linux CI), which the sheet does not cover.
      const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(loaded!.x).toBe(0);
      expect(loaded!.width).toBe(pageWidth);
    } else {
      expect(loaded!.width).toBeLessThanOrEqual(960);
      expect(loaded!.x).toBeGreaterThan(0);
    }
    await page.keyboard.press("Escape");
  }
});
