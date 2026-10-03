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
  await secondMenu
    .locator("summary")
    .filter({ hasText: /^Original language/ })
    .click();
  await secondMenu.getByRole("checkbox", { name: /French/ }).check();
  await closeSidebar(page);
  await expect(page.locator(".film-row")).toHaveCount(1);
  const thirdMenu = await sidebar(page);
  await thirdMenu.getByRole("button", { name: "Clear original language", exact: true }).click();
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

test("retrospectives stay grouped, sorted within directors and labelled across pages", async ({
  page,
}) => {
  await page.route("**/films.*.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const extras = Array.from({ length: 201 }, (_, i) => ({
      ...data.find((f: { id: string }) => f.id === "classic-a"),
      id: `extra-${i}`,
      ti: `Extra ${i}`,
      di: [
        { id: "director-a", name: "Fixture Director" },
        { id: "director-b", name: "Zoe Director" },
      ],
      retro: ["director-a", "director-b"],
    }));
    await route.fulfill({ response, json: [...data, ...extras] });
  });
  await page.route("**/meta.*.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.counts.films = 207;
    await route.fulfill({ response, json: data });
  });
  await page.goto("/retrospectives");
  await expect(page.locator(".film-row")).toHaveCount(200);
  await expect(page.locator(".director-group").first()).toContainText("Fixture Director");
  await page.getByRole("button", { name: "Sort by Title", exact: true }).click();
  await expect(page.locator(".film-title").first()).toContainText("Extra 0");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".director-group").first()).toContainText("continued");
  await expect(page.locator(".director-group")).toHaveCount(2);
  await expect(page.locator(".director-group").last()).toContainText("Zoe Director");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("combobox", { name: "Page", exact: true })).toHaveValue("3");
  await expect(page.locator(".director-group").first()).toContainText("Zoe Director");
});

test("multiple choices, correlated screening filters, chips and reset", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  const menu = await sidebar(page);
  await expect(menu.locator(".filter-picker")).toHaveCount(9);
  await menu.locator("summary").filter({ hasText: /^Day/ }).click();
  await menu.getByRole("checkbox", { name: /^Tomorrow/ }).check();
  await menu.getByRole("checkbox", { name: /^Today/ }).check();
  await menu
    .locator("summary")
    .filter({ hasText: /^Cinema/ })
    .click();
  await menu.getByRole("checkbox", { name: /BFI Southbank/ }).check();
  await closeSidebar(page);
  await expect(page).toHaveURL(/day=tomorrow&day=today&venue=/);
  await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(page.locator(".showtime-day")).toHaveCount(1);
  await expect(page.locator(".showtime-day")).toContainText("4 October");
  await expect(page.locator(".showtime-day a")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove day filter: Tomorrow", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fixture Classic A", exact: true })).toHaveCount(0);
  const menu2 = await sidebar(page);
  await menu2.getByRole("button", { name: "Reset all filters" }).click();
  await closeSidebar(page);
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(page.locator(".active-filters button")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("filter options cycle include, exclude and any with keyboard and shareable state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  const menu = await sidebar(page);
  await menu
    .locator("summary")
    .filter({ hasText: /^Original language/ })
    .click();
  const french = menu.getByRole("checkbox", { name: /French/ });
  await french.click();
  await expect(french).toBeChecked();
  await expect(page.locator(".film-row")).toHaveCount(1);
  await french.press("Space");
  await expect(french).toHaveAttribute("aria-checked", "mixed");
  await expect(page.locator(".film-row")).toHaveCount(5);
  await expect(page).toHaveURL(/not_language=fr/);
  await closeSidebar(page);
  await expect(
    page.getByRole("button", { name: "Remove excluded original language filter: French" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".film-row")).toHaveCount(5);
  const secondMenu = await sidebar(page);
  await secondMenu
    .locator("summary")
    .filter({ hasText: /^Original language/ })
    .click();
  const excluded = secondMenu.getByRole("checkbox", { name: /NOT French/ });
  await excluded.click();
  await expect(secondMenu.getByRole("checkbox", { name: /French/ })).not.toBeChecked();
  await expect(secondMenu.getByRole("checkbox", { name: /French/ })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(page.locator(".film-row")).toHaveCount(6);
  await closeSidebar(page);
});

test("Today and Tomorrow shortcuts replace day filters while preserving other choices", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.goto("/?day=beyond&not_day=today&language=fr");
  const today = page.locator(".quick-days").getByRole("button", { name: /^Today/ });
  const tomorrow = page.locator(".quick-days").getByRole("button", { name: /^Tomorrow/ });
  await today.click();
  await expect(today).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/day=today/);
  expect(new URL(page.url()).searchParams.get("not_day")).toBeNull();
  expect(new URL(page.url()).searchParams.get("language")).toBe("fr");
  await tomorrow.click();
  await expect(tomorrow).toHaveAttribute("aria-pressed", "true");
  await expect(today).toHaveAttribute("aria-pressed", "false");
  expect(new URL(page.url()).searchParams.getAll("day")).toEqual(["tomorrow"]);
  await tomorrow.click();
  expect(new URL(page.url()).searchParams.getAll("day")).toEqual([]);
  await expect(page.locator(".film-row")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
