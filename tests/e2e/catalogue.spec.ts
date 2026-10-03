import { test, expect, type Page } from "@playwright/test";
async function sidebar(page: Page) {
  if ((page.viewportSize()?.width ?? 1200) < 800) {
    await page.getByRole("button", { name: "Toggle navigation and filters" }).click();
    return page.getByRole("dialog");
  }
  return page.locator(".desktop-sidebar");
}
async function closeSidebar(page: Page) {
  if ((page.viewportSize()?.width ?? 1200) < 800) await page.keyboard.press("Escape");
}
test.beforeEach(async ({ page }) => {
  await page.route("**/fixture.jpg", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="342" height="513" fill="gray"/></svg>',
    }),
  );
});
test("search, language, director links and navigation share URL state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  const menu = await sidebar(page);
  await menu.getByLabel("Search", { exact: true }).fill("Titre B");
  await closeSidebar(page);
  await expect(page.locator(".film-row")).toHaveCount(1);
  await expect(page).toHaveURL(/q=Titre\+B/);
  await expect(page.getByRole("button", { name: /Fixture Classic B/ })).toBeVisible();
  const secondMenu = await sidebar(page);
  await secondMenu.getByLabel("Search", { exact: true }).fill("");
  await secondMenu.getByLabel("Original language").selectOption("fr");
  await closeSidebar(page);
  await expect(page.locator(".film-row")).toHaveCount(1);
  const thirdMenu = await sidebar(page);
  await thirdMenu.getByLabel("Original language").selectOption("");
  await closeSidebar(page);
  await page.locator(".director-column a").first().click();
  await expect(page.locator(".film-row")).toHaveCount(3);
  await expect(page).toHaveURL(/director=director-a/);
  const fourthMenu = await sidebar(page);
  await fourthMenu.getByRole("link", { name: "Events", exact: true }).click();
  await expect(page).toHaveURL(/\/events/);
  await page.goBack();
  await expect(page.locator(".film-row")).toHaveCount(3);
});
test("showtimes are lazy, cached, single-expanded and recover from failure", async ({ page }) => {
  let requests = 0;
  await page.route("**/showtimes.*/classic-a.json", async (route) => {
    requests++;
    if (requests === 1) return route.fulfill({ status: 503, body: "unavailable" });
    const response = await route.fetch();
    const data = await response.json();
    data.days[Object.keys(data.days)[0]][0].bookingFallback = true;
    await route.fulfill({ response, json: data });
  });
  await page.goto("/");
  const title = page.getByRole("button", { name: "Fixture Classic A", exact: true });
  await expect(title).toBeVisible();
  expect(requests).toBe(0);
  await title.click();
  await expect(page.getByRole("alert")).toContainText("Screening details could not be loaded");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Screening details", { exact: true })).toBeVisible();
  await expect(page.getByText("Sold out", { exact: true })).toBeVisible();
  await expect(page.locator(".showtime-day")).toHaveCount(3);
  await title.click();
  await title.click();
  await expect(page.locator(".showtime-day")).toHaveCount(3);
  expect(requests).toBe(2);
  await page.getByRole("button", { name: /Fixture Classic B/ }).click();
  await expect(page.locator(".expanded-row")).toHaveCount(1);
  await expect(title).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("200-row pagination and column sorting", async ({ page }) => {
  await page.route("**/films.*.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const extra = Array.from({ length: 201 }, (_, i) => ({
      ...data[0],
      id: `extra-${i}`,
      ti: `Extra ${i}`,
      ra: { lb: null, im: null, mc: null, rt: null },
    }));
    await route.fulfill({ response, json: [...data, ...extra] });
  });
  await page.route("**/meta.*.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.counts.films = 207;
    await route.fulfill({ response, json: data });
  });
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(200);
  await page.getByRole("button", { name: "Sort by Title", exact: true }).click();
  await expect(page.locator("th.title-column")).toHaveAttribute("aria-sort", "ascending");
  await expect(page.locator(".film-title").first()).toContainText("Extra 0");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".film-row")).toHaveCount(7);
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.locator(".film-row")).toHaveCount(200);
});
test("load retries, system theme, drawer keyboard and no persistent storage", async ({
  page,
  context,
}) => {
  let requests = 0;
  await page.route("**/films.*.json", (route) =>
    ++requests === 1 ? route.fulfill({ status: 503, body: "unavailable" }) : route.continue(),
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("programme could not be loaded");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const menu = await sidebar(page);
  await menu.getByRole("button", { name: /Light mode/ }).click();
  await closeSidebar(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  if ((page.viewportSize()?.width ?? 1200) < 800) {
    await expect(page.getByRole("button", { name: "Toggle navigation and filters" })).toBeFocused();
    await expect(page.locator("th:visible")).toHaveCount(2);
  }
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
