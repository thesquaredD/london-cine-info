import { test, expect, type Page } from "@playwright/test";
import type { Film } from "@lci/core/data";

test.use({ video: "on" });
test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/films.*.json", async (route) => {
    const response = await route.fetch();
    const films: Film[] = await response.json();
    const rich = films.find((film) => film.id === "classic-a")!;
    const original = films.find((film) => film.id === "classic-b")!;
    original.ra = rich.ra;
    await route.fulfill({ response, json: films });
  });
});
async function sidebar(page: Page) {
  if (page.viewportSize()!.width < 800) {
    await page.getByRole("button", { name: /^Toggle pages/ }).click();
    return page.getByRole("dialog", { name: "Pages", exact: true });
  }
  return page.locator(".desktop-sidebar");
}

test("sidebar preferences are pages; preview follows title mode and rating order without interaction", async ({
  page,
}) => {
  const errors: string[] = [];
  const details: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/showtimes.*\.json/.test(request.url())) details.push(request.url());
  });
  await page.goto("/");
  const nav = await sidebar(page);
  await nav.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL("/settings");
  const settings = page.getByRole("article", { name: "Settings", exact: true });
  await expect(settings.getByRole("heading", { name: "Settings", exact: true })).toBeFocused();
  await expect(page).toHaveTitle("Settings — London Ciné Info");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(
    await settings
      .locator(":scope > section")
      .evaluateAll((sections) => sections.map((section) => section.id)),
  ).toEqual(["display", "ratings", "preview"]);
  const preview = settings.locator(".pref-preview");
  await expect(preview).toHaveAttribute("inert", "");
  await expect(preview.locator(".film-row")).toHaveCount(1);
  await expect(preview.locator(".film-title")).toHaveText(/Fixture Classic B.*Titre B/);
  await settings.getByLabel("Film titles").selectOption("title");
  await expect(preview.locator(".film-title")).toHaveText(/Fixture Classic B/);
  await expect(preview.locator(".film-title i")).toHaveCount(0);
  await settings.getByLabel("Film titles").selectOption("original");
  await expect(preview.locator(".film-title")).toHaveText(/Titre B/);
  await expect(preview.locator(".film-title")).not.toContainText("Fixture Classic B");
  await settings.getByRole("button", { name: "Move IMDb rating up" }).click();
  await expect(preview.locator("th").nth(2)).toContainText("IMDb");
  await expect(preview.locator(".rating-column").first()).toContainText("8");
  if (page.viewportSize()!.width >= 800) {
    for (const selector of ['th.im-column span[title="IMDb"]', "td.year-column"]) {
      expect(
        await preview.locator(selector).evaluate((node) => {
          const text = document.createRange();
          text.selectNodeContents(node);
          return text.getClientRects().length;
        }),
      ).toBe(1);
    }
  }
  await expect(settings.getByRole("status")).toHaveText("IMDb is rating column 1 of 4.");
  await preview.scrollIntoViewIfNeeded();
  const bounds = (await preview.locator(".film-title").boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.locator(".expanded-row")).toHaveCount(0);
  await expect(page).toHaveURL("/settings");
  expect(details).toEqual([]);
  await preview.locator(".film-title").evaluate((node: HTMLElement) => node.focus());
  expect(await preview.evaluate((node) => node.contains(document.activeElement))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("preview-changed.png"), fullPage: true });
  for (const name of ["Friends", "Sign in", "Settings"]) {
    const current = await sidebar(page);
    const link = current.getByRole("link", { name, exact: true });
    await expect(link).not.toHaveAttribute("aria-haspopup", "dialog");
    await link.click();
    await expect(
      page.locator(`.desktop-sidebar a[href="${new URL(page.url()).pathname}"]`),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("reload remembers hide ratings and resets title mode and rating order", async ({ page }) => {
  await page.goto("/settings");
  const settings = page.getByRole("article", { name: "Settings", exact: true });
  await settings.getByLabel("Film titles").selectOption("original");
  await settings.getByRole("button", { name: "Move IMDb rating up" }).click();
  await settings.getByLabel("Hide ratings in my watchlist").check();
  await page.locator(".masthead h1 a").click();
  const nav = await sidebar(page);
  await nav.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(settings.getByLabel("Film titles")).toHaveValue("original");
  await expect(settings.getByRole("listitem").first()).toContainText("IMDb");
  await page.reload();
  await expect(settings.getByLabel("Hide ratings in my watchlist")).toBeChecked();
  await expect(settings.getByLabel("Film titles")).toHaveValue("both");
  await expect(settings.getByRole("listitem").first()).toContainText("Letterboxd");
  expect(
    await page.evaluate(() => localStorage.getItem("london-cine.hide-watchlist-ratings.v1")),
  ).toBe("true");
});

test("preview anchors wait for data and an ordinary first row remains the fallback", async ({
  page,
}) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/films.*.json", async (route) => {
    await ready;
    await route.fallback();
  });
  await page.goto("/settings#preview");
  const settings = page.getByRole("article", { name: "Settings", exact: true });
  await expect(settings.getByRole("heading", { name: "Settings", exact: true })).toBeFocused();
  await expect(settings.locator("#preview")).toHaveCount(0);
  release();
  await expect(settings.locator("#preview")).toBeFocused();
  await page.unroute("**/films.*.json");
  await page.reload();
  await expect(settings.locator(".pref-preview .film-title")).toContainText("Fixture Classic A");
});

test("storage failure keeps display changes usable with a visible status", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "london-cine.hide-watchlist-ratings.v1") throw new Error("Storage blocked");
      original.call(this, key, value);
    };
  });
  await page.goto("/settings");
  const settings = page.getByRole("article", { name: "Settings", exact: true });
  await settings.getByLabel("Hide ratings in my watchlist").check();
  await expect(
    settings.getByRole("status").filter({ hasText: "Browser storage is unavailable" }),
  ).toBeVisible();
  await settings.getByLabel("Film titles").selectOption("original");
  await expect(settings.locator(".pref-preview .film-title")).toContainText("Titre B");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("signed-out and signed-in Settings fit desktop and phone", async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === "mobile" ? 390 : 1280, height: 900 });
  for (const state of ["out", "in"]) {
    if (state === "in") {
      await page.route("**/api/me", (route) =>
        route.fulfill({
          json: {
            user: {
              id: "settings-demo",
              email: "preview@example.com",
              username: null,
              pending: false,
              fetchedAt: null,
              digestWeekday: null,
            },
          },
        }),
      );
      await page.route("**/api/cinemas", (route) =>
        route.fulfill({ json: { venues: [], version: 0 } }),
      );
      await page.route("**/api/friends", (route) =>
        route.fulfill({ json: { appUsername: "alex_films", friendsDigest: true, friends: [] } }),
      );
      await page.route("**/api/friends/matches", (route) =>
        route.fulfill({ json: { matches: [] } }),
      );
      await page.route("**/api/calendar", (route) => route.fulfill({ json: { screenings: [] } }));
    }
    await page.goto("/settings");
    await expect(page.locator(".pref-preview .film-row")).toHaveCount(1);
    await expect(
      page.locator(
        state === "in" ? ".desktop-sidebar .preferences-nav" : ".desktop-sidebar .sidebar-auth",
      ),
    ).toContainText(state === "in" ? "Account" : "Sign in");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`settings-signed-${state}-${info.project.name}.png`),
      fullPage: true,
    });
  }
});
