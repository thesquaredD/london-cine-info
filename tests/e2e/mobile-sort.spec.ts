import { expect, test } from "@playwright/test";
test.use({ video: "on" });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
});
test("sort controls replace only the mobile secondary column and preserve URL state", async ({
  page,
}, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 1200) >= 800, "Mobile sort control");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  const headers = page.locator(".film-table th:visible");
  await expect(headers).toHaveCount(2);
  await expect(headers.nth(1)).toContainText("Director");
  const trigger = page.getByRole("button", { name: /^Sort:/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Sort films", exact: true });
  const field = dialog.getByLabel("Sort by", { exact: true });
  await expect(field).toBeFocused();
  for (const [key, label] of [
    ["year", "Year"],
    ["runtime", "Runtime"],
    ["im", "IMDb"],
    ["mc", "Metacritic"],
    ["rt", "Rotten Tomatoes"],
    ["lb", "Letterboxd"],
  ]) {
    await field.selectOption(key);
    await expect(headers).toHaveCount(2);
    await expect(headers.nth(1)).toContainText(label);
    const bounds = await headers.nth(1).boundingBox();
    expect(bounds!.width).toBeGreaterThan(100);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect(page).toHaveURL(new RegExp(`sort=${key}`));
  }
  await dialog.getByLabel("Order", { exact: true }).selectOption("asc");
  await expect(headers.nth(1)).toHaveAttribute("aria-sort", "ascending");
  await page.screenshot({ path: testInfo.outputPath("mobile-sort-dialog.png") });
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(trigger).toBeFocused();
  await page.reload();
  await expect(headers.nth(1)).toContainText("Letterboxd");
  await expect(headers.nth(1)).toHaveAttribute("aria-sort", "ascending");
  await page.screenshot({ path: testInfo.outputPath("mobile-sorted-rating.png") });
  await trigger.click();
  await field.selectOption("runtime");
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".mobile-sort-column:visible").nth(1)).toContainText("min");
  await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(page.locator(".film-expanded")).toBeVisible();
  await expect(headers).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("mobile-sorted-runtime-expanded.png") });
  await trigger.click();
  await field.selectOption("title");
  await expect(headers.nth(1)).toContainText("Director");
  await dialog.getByRole("button", { name: "Reset sort", exact: true }).click();
  await expect(headers.nth(1)).toContainText("Director");
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  for (const width of [320, 390, 799]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?decade=1980&genre=drama");
    await expect(headers.nth(1)).toContainText("Director");
    await trigger.click();
    await field.selectOption("year");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(headers.nth(1)).toContainText("Year");
    expect(new URL(page.url()).searchParams.get("genre")).toBe("drama");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: testInfo.outputPath("mobile-sorted-year-dark.png") });
  expect(errors).toEqual([]);
});
test("desktop columns stay intact when a mobile sort URL is opened", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/?sort=runtime&order=asc");
  await expect(page.locator(".film-table th:visible")).toHaveCount(7);
  await expect(page.locator(".film-table .director-column:visible").first()).toContainText(
    "Director",
  );
  await expect(page.locator(".mobile-sort-trigger")).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator(".film-table th:visible")).toHaveCount(2);
  await expect(page.locator(".film-table th:visible").nth(1)).toContainText("Runtime");
});
