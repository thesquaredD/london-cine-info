import { test, expect, type Page } from "@playwright/test";
async function openFilters(page: Page) {
  await page.getByRole("button", { name: /^(More filters|All filters)$/ }).click();
  return page.getByRole("dialog", { name: "Filters", exact: true });
}
async function closeFilters(page: Page) {
  await page.keyboard.press("Escape");
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
  const menu = await openFilters(page);
  await menu.getByLabel("Search", { exact: true }).fill("Titre B");
  await closeFilters(page);
  await expect(page.locator(".film-row")).toHaveCount(1);
  await expect(page).toHaveURL(/q=Titre\+B/);
  await expect(page.getByRole("button", { name: /Fixture Classic B/ })).toBeVisible();
  const secondMenu = await openFilters(page);
  await secondMenu.getByLabel("Search", { exact: true }).fill("");
  await secondMenu
    .locator("summary")
    .filter({ hasText: /^Original language/ })
    .click();
  await secondMenu.getByRole("checkbox", { name: /French/ }).check();
  await closeFilters(page);
  await expect(page.locator(".film-row")).toHaveCount(1);
  const thirdMenu = await openFilters(page);
  await thirdMenu
    .locator("summary")
    .filter({ hasText: /^Original language/ })
    .click();
  await thirdMenu.getByRole("button", { name: "Clear original language", exact: true }).click();
  await closeFilters(page);
  await page.locator(".director-column a").first().click();
  await expect(page.locator(".film-row")).toHaveCount(3);
  await expect(page).toHaveURL(/director=director-a/);
  if ((page.viewportSize()?.width ?? 1200) < 800)
    await page.getByRole("button", { name: "Toggle pages" }).click();
  await page
    .getByRole("navigation", { name: "Film pages" })
    .filter({ visible: true })
    .getByRole("link", { name: "Events", exact: true })
    .click();
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
  await page.getByRole("button", { name: "Sort by Title", exact: true }).click();
  await expect(page.locator("th.title-column")).toHaveAttribute("aria-sort", "descending");
  await page.getByRole("button", { name: "Sort by Title", exact: true }).click();
  await expect(page.locator("th.title-column")).toHaveAttribute("aria-sort", "none");
  await expect(page.locator("th.lb-column")).toHaveAttribute("aria-sort", "descending");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Clear sort", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sort by Director", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clear sort", exact: true })).toHaveText(
    "Sort: Director ×",
  );
  await page.getByRole("button", { name: "Clear sort", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Sort by Title", exact: true }).click();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("th.lb-column")).toHaveAttribute("aria-sort", "descending");
  await page.goto("/calendar?sort=title&order=asc");
  await page.getByRole("button", { name: "Clear sort", exact: true }).click();
  await expect(page).toHaveURL("/calendar");
  await expect(page.locator("th.title-column")).toHaveAttribute("aria-sort", "none");
  await page.getByRole("button", { name: "Sort by Director", exact: true }).click();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page).toHaveURL("/calendar");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("sort-reset.png"),
  });
});
test("load retries, system theme, sheet keyboard and no persistent storage", async ({
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
  const menu = await openFilters(page);
  await expect(menu).toBeVisible();
  await closeFilters(page);
  await expect(page.getByRole("button", { name: /^(More filters|All filters)$/ })).toBeFocused();
  if ((page.viewportSize()?.width ?? 1200) < 800)
    await page.getByRole("button", { name: "Toggle pages" }).click();
  await expect(page.getByRole("button", { name: /Light mode/ })).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 1200) < 800)
    await page.getByRole("button", { name: "Close pages" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  if ((page.viewportSize()?.width ?? 1200) < 800) {
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
  const menu = await openFilters(page);
  await expect(menu.locator(".filter-picker")).toHaveCount(10);
  await menu.locator("summary").filter({ hasText: /^Day/ }).click();
  await menu
    .locator(".calendar-grid")
    .getByRole("button", { name: /^Sunday, 4 October 2026/ })
    .click();
  await menu
    .locator(".calendar-grid")
    .getByRole("button", { name: /^Saturday, 3 October 2026/ })
    .click();
  await menu
    .locator("summary")
    .filter({ hasText: /^Cinema/ })
    .click();
  await menu.getByRole("checkbox", { name: /BFI Southbank/ }).check();
  await closeFilters(page);
  await expect(page).toHaveURL(/day=2026-10-04&day=2026-10-03&venue=/);
  await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(page.locator(".showtime-day")).toHaveCount(1);
  await expect(page.locator(".showtime-day")).toContainText("4 October");
  await expect(page.locator(".showtime-day a")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove day filter: Sun 4 Oct", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fixture Classic A", exact: true })).toHaveCount(0);
  const menu2 = await openFilters(page);
  await menu2.getByRole("button", { name: "Reset all filters" }).click();
  await closeFilters(page);
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(page.locator(".active-filters button")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("filter options toggle normally and exclusions use an explicit mode with shareable state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  const menu = await openFilters(page);
  await menu
    .locator("summary")
    .filter({ hasText: /^Original language/ })
    .click();
  const french = menu.getByRole("checkbox", { name: /French/ });
  await french.click();
  await expect(french).toBeChecked();
  await expect(page.locator(".film-row")).toHaveCount(1);
  await french.press("Space");
  await expect(french).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".film-row")).toHaveCount(6);
  await menu.getByRole("button", { name: "Exclude options", exact: true }).click();
  await french.press("Space");
  await expect(french).toHaveAttribute("aria-checked", "mixed");
  await expect(page.locator(".film-row")).toHaveCount(5);
  await expect(page).toHaveURL(/not_language=fr/);
  await closeFilters(page);
  await expect(
    page.getByRole("button", { name: "Remove excluded original language filter: French" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".film-row")).toHaveCount(5);
  const secondMenu = await openFilters(page);
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
  await closeFilters(page);
});

test("Today and Tomorrow shortcuts replace day filters while preserving other choices", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.goto("/?day=beyond&not_day=today&language=fr");
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: /^Quick filters/ }).click();
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

test("filter controls stay stationary through selection, clearing and changing counts", async ({
  page,
}) => {
  await page.route("**/meta.*.json", async (route) => {
    const response = await route.fetch();
    const meta = await response.json();
    meta.facets.venue.push(
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `extra-venue-${i}`,
        label: `Extra cinema ${i}`,
        count: 0,
      })),
    );
    for (const option of meta.facets.venue)
      option.label = "A deliberately long cinema name with several words " + option.label;
    await route.fulfill({ response, json: meta });
  });
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  const summary = page.locator(".filter-summary");
  const baselineHeight = (await summary.boundingBox())!.height;
  const quick =
    page.viewportSize()!.width < 800
      ? page.getByRole("button", { name: /^Quick filters/ })
      : page.locator(".quick-days").getByRole("button", { name: /^Tomorrow/ });
  const quickX = (await quick.boundingBox())!.x;
  const menu = await openFilters(page);
  for (const name of [
    "Day",
    "Time",
    "Cinema",
    "Borough",
    "Membership",
    "Accessibility",
    "Format",
    "Genre",
    "Original language",
    "Year",
  ]) {
    const picker = menu
      .locator(".filter-picker")
      .filter({ has: page.locator("summary>span").filter({ hasText: new RegExp(`^${name}$`) }) });
    await picker.locator("summary").click();
    const option =
      name === "Day"
        ? picker.locator(".calendar-grid").getByRole("button").first()
        : picker.getByRole("checkbox").first();
    await option.scrollIntoViewIfNeeded();
    const frame = await picker.boundingBox();
    const control = await option.boundingBox();
    const clear = picker.getByRole("button", { name: `Clear ${name.toLowerCase()}`, exact: true });
    await expect(clear).toBeDisabled();
    for (let cycle = 0; cycle < 2; cycle++) {
      await option.press("Space");
      await expect(option).toHaveAttribute(
        name === "Day" ? "aria-pressed" : "aria-checked",
        cycle % 2 === 0 ? "true" : "false",
      );
      const changed = await option.boundingBox();
      const changedFrame = await picker.boundingBox();
      expect(Math.abs(changed!.y - control!.y), name + " option vertical position").toBeLessThan(1);
      expect(Math.abs(changed!.x - control!.x), name + " option horizontal position").toBeLessThan(
        1,
      );
      expect(Math.abs(changedFrame!.height - frame!.height), name + " picker height").toBeLessThan(
        1,
      );
      expect(
        (await summary.boundingBox())!.height - baselineHeight,
        "active chips occupy only their compact row",
      ).toBeLessThan(60);
      expect(
        Math.abs((await quick.boundingBox())!.x - quickX),
        "Tomorrow button position",
      ).toBeLessThan(1);
    }
    await expect(clear).toBeDisabled();
  }
  const cinema = menu
    .locator(".filter-picker")
    .filter({ has: page.locator("summary>span").filter({ hasText: /^Cinema$/ }) });
  await cinema.locator("summary").click();
  const search = menu.getByLabel("Find cinema", { exact: true });
  await search.scrollIntoViewIfNeeded();
  const searchY = (await search.boundingBox())!.y;
  await search.fill("no matching cinema");
  await expect(cinema.getByText(/No options match/)).toBeVisible();
  expect(Math.abs((await search.boundingBox())!.y - searchY)).toBeLessThan(1);
  await search.fill("");
  const time = menu
    .locator(".filter-picker")
    .filter({ has: page.locator("summary>span").filter({ hasText: /^Time$/ }) });
  await time.locator("summary").click();
  await menu.getByLabel("From", { exact: true }).scrollIntoViewIfNeeded();
  const timeHeight = (await time.boundingBox())!.height;
  await menu.getByLabel("From", { exact: true }).fill("23:00");
  await menu.getByLabel("Until", { exact: true }).fill("02:00");
  expect(Math.abs((await time.boundingBox())!.height - timeHeight)).toBeLessThan(1);
  await closeFilters(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
