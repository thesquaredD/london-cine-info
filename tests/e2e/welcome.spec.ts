import { test, expect, type Page } from "@playwright/test";

// Fresh browser: no remembered dismissal, unlike the other specs.
test.use({ storageState: { cookies: [], origins: [] } });

const welcomeHeading = (page: Page) => page.getByRole("heading", { name: /London’s cinemas/ });

async function openPages(page: Page) {
  if ((page.viewportSize()?.width ?? 1200) < 800)
    await page.getByRole("button", { name: /^Toggle pages/ }).click();
}

test("a first unfiltered visit shows the welcome page and dismissal is remembered", async ({
  page,
}) => {
  await page.goto("/");
  await expect(welcomeHeading(page)).toBeVisible();
  await expect(page.locator(".film-row")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText(
      "London Ciné Info is independent and not affiliated with any cinema, Letterboxd, IMDb or YouTube.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Browse all films" }).click();
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem("london-cine.welcome-dismissed.v1"))).toBe(
    "true",
  );
  await page.reload();
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(welcomeHeading(page)).toHaveCount(0);
});

test("filtered, shared and other links bypass the welcome page", async ({ page }) => {
  for (const path of [
    "/?venue=princecharlescinema.com",
    "/?q=Titre",
    "/?cinemas=mine",
    "/events",
    "/about",
  ]) {
    await page.goto(path);
    await expect(page.locator("#page-title")).toBeAttached();
    await expect(welcomeHeading(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, "\\?")}$`));
  }
  // Visiting shared links does not count as a dismissal; the root still welcomes.
  await page.goto("/");
  await expect(welcomeHeading(page)).toBeVisible();
});

test("a cinema logo opens that cinema's programme", async ({ page }) => {
  await page.goto("/");
  const venues = page.getByRole("list", { name: "Start with a cinema" });
  await expect(venues.getByRole("link")).toHaveCount(3);
  await venues.getByRole("link", { name: /Prince Charles/ }).click();
  await expect(page).toHaveURL(/[?&]venue=princecharlescinema\.com/);
  await expect(welcomeHeading(page)).toHaveCount(0);
  await expect(page.locator(".film-row").first()).toBeVisible();
  await page.goto("/");
  await expect(welcomeHeading(page)).toHaveCount(0);
});

test("find cinemas near me opens the nearby search", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Find cinemas near me" }).click();
  await expect(page.getByRole("dialog", { name: "Find nearby cinemas" })).toBeVisible();
  await expect(welcomeHeading(page)).toHaveCount(0);
});

// The fixture lists three featured venues; the full set of eight scrolls.
async function allFeaturedVenues(page: Page) {
  await page.route("**/data/meta.*.json", async (route) => {
    const meta = await (await route.fetch()).json();
    const base = meta.venues[0];
    for (const id of [
      "closeupfilmcentre.com",
      "riocinema.org.uk",
      "genesiscinema.co.uk",
      "everymancinema.com-screen-on-the-green",
      "barbican.org.uk",
    ])
      meta.venues.push({ ...base, id, name: id });
    await route.fulfill({ json: meta });
  });
}

test("the welcome page stays reachable and its logos can be paused", async ({ page }) => {
  await allFeaturedVenues(page);
  await page.goto("/about");
  await page.getByRole("link", { name: "Welcome page" }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(welcomeHeading(page)).toBeVisible();
  const pause = page.getByRole("button", { name: "Pause logos" });
  await pause.click();
  await expect(page.getByRole("button", { name: "Play logos" })).toBeVisible();
  await expect(page.locator(".welcome-strip")).toHaveClass(/is-paused/);
  await expect(
    page.getByRole("list", { name: "Start with a cinema" }).getByRole("link"),
  ).toHaveCount(8);
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page).toHaveURL(/\/how-to-use$/);
  await page.goBack();
  await page.getByRole("link", { name: "Browse all films" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".film-row")).toHaveCount(6);
});

test("reduced motion shows the cinemas as a still grid", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(welcomeHeading(page)).toBeVisible();
  await expect(page.locator(".welcome-strip")).toHaveClass(/is-static/);
  await expect(page.getByRole("button", { name: "Pause logos" })).toHaveCount(0);
  await expect(page.locator(".welcome-venue")).toHaveCount(3);
});

test("How to use renders the guide and links to each real action", async ({ page }) => {
  await page.goto("/events");
  await openPages(page);
  await page
    .getByRole("link", { name: "How to use", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/how-to-use$/);
  const guide = page.getByRole("article", { name: "How to use London Ciné Info" });
  await expect(guide.getByRole("complementary", { name: "In short" })).toBeVisible();
  for (const name of [
    "Find a screening and book it",
    "Set up your watchlist",
    "Choose something together",
    "Set up My cinemas",
  ])
    await expect(guide.getByRole("heading", { name })).toBeVisible();
  const together = guide.getByRole("figure", { name: "Two watchlists compared" });
  await expect(together.getByRole("status")).toHaveText("2 films: Perfect Days, Past Lives");
  await together.getByRole("button", { name: "On any list" }).click();
  await expect(together.getByRole("status")).toContainText("4 films");
  const noScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(noScroll).toBe(true);

  for (const [name, url] of [
    ["Find a film together", /\/friends$/],
    ["Choose my cinemas", /\/\?cinemas=mine$/],
    ["Open Watchlist", /\/watchlist$/],
    ["See what’s on tonight", /[?&]tonight=1(&|$)/],
  ] as const) {
    await guide.getByRole("link", { name }).click();
    await expect(page).toHaveURL(url);
    // With nothing saved, Choose my cinemas goes straight to the chooser.
    if (name === "Choose my cinemas")
      await expect(page.getByRole("dialog", { name: "Manage my cinemas" })).toBeVisible();
    await page.goto("/how-to-use");
  }
  await page.route("https://api.postcodes.io/**", (route) =>
    route.fulfill({
      json: { result: { latitude: 51.5074, longitude: -0.1278, postcode: "WC2N 5DU" } },
    }),
  );
  await guide.getByRole("button", { name: "Find cinemas near me" }).click();
  const nearby = page.getByRole("dialog", { name: "Find nearby cinemas" });
  await expect(nearby).toBeVisible();
  await nearby.getByRole("textbox", { name: "Postcode" }).fill("WC2N 5DU");
  await nearby.getByRole("button", { name: "Find", exact: true }).click();
  await nearby.getByRole("button", { name: "Show films", exact: true }).click();
  // Showing films leaves the guide for the programme, filtered to the nearby cinemas.
  await expect(nearby).toBeHidden();
  await expect(page).toHaveURL(/^[^?]*\/\?(.*&)?venue=/);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.locator(".film-row").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Change nearby cinemas" })).toBeVisible();
});

test("closing Near me opened from the welcome page returns to the Near me shortcut", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Find cinemas near me" }).click();
  const nearby = page.getByRole("dialog", { name: "Find nearby cinemas" });
  await expect(nearby).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nearby).toBeHidden();
  const nearMe = page.getByRole("button", { name: "Near me", exact: true });
  await expect(nearMe).toBeFocused();
  await expect(nearMe).toHaveAttribute("aria-haspopup", "dialog");
  await expect(nearMe).not.toHaveAttribute("aria-pressed", /.*/);
});

test("the welcome page skip link focuses the content and no film page is current", async ({
  page,
}) => {
  await page.goto("/");
  await expect(welcomeHeading(page)).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Film pages", includeHidden: true })
      .first()
      .locator("[aria-current]"),
  ).toHaveCount(0);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to films" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  // Browsing films makes All movies current again.
  await page.getByRole("link", { name: "Browse all films" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Film pages", includeHidden: true })
      .first()
      .getByRole("link", { name: "All movies", includeHidden: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("the guide's example screenings use the real row layout", async ({ page }) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/how-to-use");
    const example = page.getByRole("figure", { name: "A film’s screenings" });
    await expect(example.locator(".showtimes .screening-details")).toHaveCount(2);
    const rows = await example.locator(".showtime-day li").evaluateAll((items) =>
      items.map((item) => {
        const box = (selector: string) => item.querySelector(selector)!.getBoundingClientRect();
        const venue = box(".screening-venue");
        const book = box(".booking-action");
        const overlap =
          venue.left < book.right &&
          book.left < venue.right &&
          venue.top < book.bottom &&
          book.top < venue.bottom;
        return { venue: venue.width, row: item.getBoundingClientRect().width, overlap };
      }),
    );
    for (const row of rows) {
      expect(row.overlap, `${width}px`).toBe(false);
      // The venue keeps a good share of the row instead of collapsing beside the actions.
      expect(row.venue, `${width}px`).toBeGreaterThan(row.row * 0.35);
      expect(row.venue, `${width}px`).toBeGreaterThan(160);
    }
  }
});

test("a keyboard-focused logo is always inside the strip", async ({ page }) => {
  if ((page.viewportSize()?.width ?? 1200) >= 800)
    await page.setViewportSize({ width: 1440, height: 900 });
  await allFeaturedVenues(page);
  await page.goto("/");
  const strip = page.locator(".welcome-strip");
  await expect(strip).toHaveClass(/is-moving/);
  // Wait until the strip has carried the first logo well off its starting point.
  await expect
    .poll(
      () =>
        page.locator(".welcome-track").evaluate((node) => {
          const transform = getComputedStyle(node).transform;
          return transform === "none" ? 0 : new DOMMatrix(transform).m41;
        }),
      { timeout: 20000 },
    )
    .toBeLessThan(-60);
  const venues = page.getByRole("list", { name: "Start with a cinema" }).getByRole("link");
  await expect(venues).toHaveCount(8);
  await page.getByRole("button", { name: "Pause logos" }).focus();
  await page.keyboard.press("Tab");
  await expect(venues.first()).toBeFocused();
  for (const venue of [venues.first(), venues.last()]) {
    await venue.focus();
    await expect(strip).toHaveClass(/is-static/);
    const [box, bounds] = await Promise.all([venue.boundingBox(), strip.boundingBox()]);
    expect(box && bounds).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(bounds!.x - 1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(bounds!.y - 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
  }
  // Leaving the strip resumes the motion.
  await page.getByRole("link", { name: "See how it works" }).focus();
  await expect(strip).toHaveClass(/is-moving/);
});

test("guide links without a query keep the current view, like the sidebar", async ({ page }) => {
  await page.goto("/?venue=princecharlescinema.com");
  await expect(page.locator(".film-row").first()).toBeVisible();
  await openPages(page);
  await page
    .getByRole("link", { name: "How to use", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/how-to-use\?venue=princecharlescinema\.com$/);
  const sidebarHref = await page
    .getByRole("navigation", { name: "Film pages", includeHidden: true })
    .first()
    .getByRole("link", { name: "Watchlist", exact: true, includeHidden: true })
    .getAttribute("href");
  await page
    .getByRole("article", { name: "How to use London Ciné Info" })
    .getByRole("link", { name: "Open Watchlist" })
    .click();
  await expect(page).toHaveURL(/\/watchlist\?venue=princecharlescinema\.com$/);
  expect(sidebarHref).toBe("/watchlist?venue=princecharlescinema.com");
});

test("back and forward from the welcome page do not bring it back", async ({ page }) => {
  await page.goto("/");
  await expect(welcomeHeading(page)).toBeVisible();
  await page
    .getByRole("list", { name: "Start with a cinema" })
    .getByRole("link", { name: /Prince Charles/ })
    .click();
  await expect(page).toHaveURL(/venue=princecharlescinema\.com/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(welcomeHeading(page)).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(/venue=princecharlescinema\.com/);
  await expect(welcomeHeading(page)).toHaveCount(0);
});

test("a search leaves the welcome page and clearing it does not restore it", async ({ page }) => {
  await page.goto("/");
  await expect(welcomeHeading(page)).toBeVisible();
  // A search arriving through history (e.g. a shared search link opened in place).
  await page.evaluate(() => {
    history.pushState(null, "", "/?q=Titre");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(welcomeHeading(page)).toHaveCount(0);
  await expect(page.locator(".film-row").first()).toBeVisible();
  await page.getByRole("button", { name: "Remove search filter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(welcomeHeading(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(welcomeHeading(page)).toHaveCount(0);
});

test("the sidebar opens the welcome page again after it has been dismissed", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("london-cine.welcome-dismissed.v1", "true"));
  await page.goto("/");
  await expect(page.locator(".film-row").first()).toBeVisible();
  await openPages(page);
  const link = page.getByRole("link", { name: "Welcome", exact: true }).filter({ visible: true });
  await expect(link).not.toHaveAttribute("aria-current");
  await link.click();
  await expect(welcomeHeading(page)).toBeVisible();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(
    page.getByRole("link", { name: "Welcome", exact: true, includeHidden: true }).first(),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Browse all films" }).click();
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect(page).toHaveURL(/\/$/);
});
