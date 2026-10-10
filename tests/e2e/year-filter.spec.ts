import { test, expect, type Page } from "@playwright/test";
test.use({ video: "on" });
async function openYear(page: Page) {
  const mobile = !(await page.locator(".desktop-filters").isVisible());
  if (mobile) {
    await page.locator(".all-filters").click();
    await page.locator('.filter-sheet [data-filter="year"] > summary').click();
  } else await page.locator('.desktop-filters [data-filter="year"] > summary').click();
  return page.locator(`${mobile ? ".filter-sheet" : ".desktop-filters"} [data-filter="year"]`);
}
test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
});
test("multiple decades, individual years, partial selection and persistent URLs", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  const picker = await openYear(page);
  await picker.getByRole("checkbox", { name: /^1980s/ }).check();
  await picker.getByRole("checkbox", { name: /^1990s/ }).check();
  await expect(page.locator(".film-row")).toHaveCount(2);
  await picker.getByRole("button", { name: "Expand 1990s years" }).click();
  await picker.getByRole("checkbox", { name: /^1990 / }).uncheck();
  await expect(picker.getByRole("checkbox", { name: /^1990s/ })).toHaveAttribute(
    "aria-checked",
    "mixed",
  );
  await expect(page.locator(".film-row")).toHaveCount(1);
  await picker.getByRole("button", { name: "Expand 2020s years" }).click();
  await expect(picker.getByRole("group", { name: "1990s years" })).toHaveCount(0);
  await picker.getByRole("checkbox", { name: /^2026 / }).check();
  await expect(page.locator(".film-row")).toHaveCount(2);
  await expect(picker).toHaveAttribute("open", "");
  expect(new URL(page.url()).searchParams.getAll("year")).toContain("2026");
  await page.screenshot({ path: testInfo.outputPath("year-picker.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Edit year filter" })).toBeVisible();
  await page.getByRole("button", { name: "Edit year filter" }).click();
  await expect(picker).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator(".film-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Remove year filter" }).click();
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});
test("year counts ignore their own selection and respect genre; zero-result choices remain", async ({
  page,
}) => {
  await page.goto("/?decade=1980&genre=comedy");
  const picker = await openYear(page);
  const eighties = picker.getByRole("checkbox", { name: /^1980s/ });
  await expect(eighties).toBeChecked();
  const label = eighties.locator("..");
  await expect(label.locator("small")).toHaveText("0");
  await expect(
    picker
      .getByRole("checkbox", { name: /^2020s/ })
      .locator("..")
      .locator("small"),
  ).toHaveText("1");
  await picker.getByRole("button", { name: "Clear year" }).click();
  await expect(page).toHaveURL(/genre=comedy/);
  await expect(page.locator(".film-row")).toHaveCount(1);
});

test("expansion preserves results and fits the viewport in both themes", async ({
  page,
}, testInfo) => {
  await page.goto("/?decade=1980&decade=1990");
  await expect(page.locator(".film-row")).toHaveCount(2);
  for (const width of [320, 390, 799, 800, 1000, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const picker = await openYear(page);
    const url = page.url();
    const mutations = await page
      .locator(".film-row")
      .first()
      .evaluateHandle((row) => {
        const state = {
          count: 0,
          observer: new MutationObserver(() => {
            state.count++;
          }),
        };
        state.observer.observe(row.parentElement!, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        return state;
      });
    const expand = picker.getByRole("button", { name: "Expand 1990s years" });
    await expand.click();
    await expect(picker.getByRole("group", { name: "1990s years" })).toBeVisible();
    expect(page.url()).toBe(url);
    expect(
      await mutations.evaluate((state) => {
        state.observer.disconnect();
        return state.count;
      }),
    ).toBe(0);
    await mutations.dispose();
    const box = await picker.locator(".picker-content").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await picker.getByRole("button", { name: "Collapse 1990s years" }).click();
    await page.keyboard.press("Escape");
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const picker = await openYear(page);
  await picker.getByRole("button", { name: "Expand 1990s years" }).click();
  await page.screenshot({ path: testInfo.outputPath("year-picker-dark.png") });
});
