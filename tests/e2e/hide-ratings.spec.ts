import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("remembered watchlist preference removes every rating surface and rating sorts", async ({
  page,
}) => {
  const manifest = JSON.parse(readFileSync("src/generated/manifest.json", "utf8"));
  const films = JSON.parse(readFileSync(`public${manifest.films}`, "utf8"));
  const slugs = films.flatMap((film: { ra: { lb?: { url: string } } }) =>
    film.ra.lb ? [new URL(film.ra.lb.url).pathname.split("/")[2]] : [],
  );
  const stamp = 1791018000;
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "ratings-user",
          email: "fixture@example.com",
          username: "fixture",
          pending: false,
          fetchedAt: stamp,
        },
      },
    }),
  );
  await page.route("**/api/watchlist", (route) =>
    route.fulfill({ json: { slugs, count: slugs.length, fetchedAt: stamp, username: "fixture" } }),
  );
  await page.route("**/api/cinemas", (route) =>
    route.fulfill({ json: { venues: [], version: 0 } }),
  );
  await page.goto("/watchlist?sort=im");
  await expect(page.locator(".film-row").first()).toBeVisible();
  await expect(page.locator(".rating-column").first()).toBeAttached();
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: "Toggle pages" }).click();
  await page
    .locator(
      page.viewportSize()!.width < 800
        ? ".sidebar-drawer .settings-button"
        : ".desktop-sidebar .settings-button",
    )
    .click();
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByLabel("Hide ratings in my watchlist").check();
  await page.keyboard.press("Escape");
  await expect(page.locator(".rating-column")).toHaveCount(0);
  await expect(page.locator(".mobile-sort-score")).toHaveCount(0);
  await expect(page.locator("th.title-column")).toHaveAttribute("aria-sort", "ascending");
  await expect(page.getByRole("button", { name: "Clear sort", exact: true })).toHaveText(
    "Sort: Title ×",
  );
  await expect(page.locator(".mobile-sort-value .rating-chip")).toHaveCount(0);
  await page.locator(".film-row .film-title").first().click();
  await expect(page.locator(".expanded-row")).toBeVisible();
  await expect(page.locator(".rating-card")).toHaveCount(0);
  if (page.viewportSize()!.width < 800) {
    await page.getByRole("button", { name: /^Sort:/ }).click();
    await expect(page.getByLabel("Sort by").locator('option[value="im"]')).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await page.reload();
  await expect(page.locator(".film-row").first()).toBeVisible();
  await expect(page.locator(".rating-column")).toHaveCount(0);
  await page.goto("/");
  await expect(page.locator(".rating-column").first()).toBeAttached();
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: /^Quick filters/ }).click();
  await page
    .locator(page.viewportSize()!.width < 800 ? ".quick-filter-dialog" : ".quick-filters-desktop")
    .getByRole("button", { name: "My watchlist", exact: true })
    .click();
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: /^Show \d/ }).click();
  await expect(page.locator(".rating-column")).toHaveCount(0);
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: "Toggle pages" }).click();
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .filter({ visible: true })
    .click();
  await settings.getByLabel("Hide ratings in my watchlist").uncheck();
  await page.keyboard.press("Escape");
  await expect(page.locator(".rating-column").first()).toBeAttached();
});
