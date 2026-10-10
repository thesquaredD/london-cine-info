import { test, expect } from "@playwright/test";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
const evidence = join(homedir(), ".Codex/london-cine-info/filter-strip");
test.use({ video: "on" });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
});
test("visible shortcuts toggle date and evening with fixture counts", async ({ page }) => {
  await page.goto("/");
  const strip = page.getByRole("group", { name: "Shortcuts" });
  await expect(strip).toBeVisible();
  await expect(strip.getByRole("button")).toHaveText([
    "Today",
    "Tomorrow",
    "This weekend",
    "This week",
    "Evening",
    "Near me",
  ]);
  await expect(page.locator(".all-filters")).toHaveAccessibleName("Filters");
  const searchBox = (await page.locator(".bar-search").boundingBox())!;
  const filtersBox = (await page.locator(".all-filters").boundingBox())!;
  expect(searchBox.y).toBe(filtersBox.y);
  expect(searchBox.height).toBe(filtersBox.height);
  await expect(page.getByRole("button", { name: /Quick filters/ })).toHaveCount(0);
  const today = strip.getByRole("button", { name: "Today", exact: true });
  await expect(today).toHaveAttribute("title", "5 films");
  await today.click();
  await expect(today).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".film-row")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Clear all", exact: true })).toBeVisible();
  await strip.getByRole("button", { name: "Evening", exact: true }).click();
  await expect(today).toHaveAttribute("aria-pressed", "true");
  await expect(strip.getByRole("button", { name: "Evening", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".film-row")).toHaveCount(2);
  await today.click();
  await expect(today).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.locator(".film-row")).toHaveCount(6);
});
test("sheet runtime toggle changes results and badge; Year chip opens the sheet", async ({
  page,
}) => {
  await page.goto("/");
  const filters = page.locator(".all-filters");
  await filters.click();
  const sheet = page.getByRole("dialog", { name: "Filters", exact: true });
  await expect(sheet.getByRole("button", { name: /^Watchlists/ })).toBeVisible();
  await sheet.getByRole("checkbox", { name: "Under 2 hours", exact: true }).check();
  await expect(page.locator(".film-row")).toHaveCount(0);
  await expect(filters.locator(".shortcut-count")).toContainText("1");
  await page.keyboard.press("Escape");
  await expect(filters).toBeFocused();
  await page.goto("/?year=1977");
  await page.getByRole("button", { name: "Edit year filter" }).click();
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-filter="year"]')).toHaveAttribute("open", "");
  await expect(sheet.locator('[data-filter="year"] > summary')).toBeFocused();
});
test("strip wraps without overflow and seven guest items fit the height budget", async ({
  page,
}, info) => {
  const width = info.project.name === "mobile" ? 390 : 1280;
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: join(evidence, `signed-out-${width}.png`) });
  await page.addInitScript(() =>
    localStorage.setItem(
      "london-cine.cinemas.v1",
      JSON.stringify({
        browserId: "12345678-1234-1234-1234-123456789abc",
        venues: ["bfi.org.uk-southbank"],
      }),
    ),
  );
  await page.reload();
  const strip = page.getByRole("group", { name: "Shortcuts" });
  await expect(strip.getByRole("button")).toHaveCount(7);
  expect((await strip.boundingBox())!.height).toBeLessThanOrEqual(width === 390 ? 80 : 30);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: join(evidence, `guest-cinemas-${width}.png`) });
});
