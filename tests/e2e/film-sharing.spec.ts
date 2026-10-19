import { expect, test, type Page } from "@playwright/test";
import { screeningId, shareUrl } from "../../src/lib/sharing";
import type { Showtime } from "../../src/shared/data";

const film = { id: "classic-a", ti: "Fixture Classic A" };
const cinema = "princecharlescinema.com";
// 40 screenings over three days, two cinemas, three screens; sorted by time they keep this order.
const rows: Showtime[] = Array.from({ length: 40 }, (_, index) => ({
  venue: index % 2 ? "picturehouses.com-central" : cinema,
  time:
    Date.parse("2026-10-04T10:00:00Z") + Math.floor(index / 16) * 86400000 + (index % 16) * 1800000,
  localTime: `${String(11 + Math.floor((index % 16) / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
  bookingUrl: `https://example.com/book/${index}`,
  bookingFallback: false,
  screen: String((index % 3) + 1),
  notes: null,
  category: "movie",
  formats: ["standard"],
  accessibility: [],
  soldOut: index === 31,
}));
// The address a reader opens, relative so it follows the test server's origin.
function shared(row?: Pick<Showtime, "venue" | "time" | "screen">) {
  const url = new URL(shareUrl(film, "http://localhost", row));
  return url.pathname + url.search;
}
async function busyProgramme(page: Page) {
  await page.route(/\/showtimes[^/]*\/classic-a\.json$/, (route) =>
    route.fulfill({
      json: {
        id: film.id,
        details: { actors: [], overview: null },
        days: Object.fromEntries(
          [4, 5, 6].map((day) => [
            `2026-10-0${day}`,
            rows.filter((row) => new Date(row.time).getUTCDate() === day),
          ]),
        ),
      },
    }),
  );
}
async function copied(page: Page) {
  return page.evaluate(() => (window as unknown as { copied: string }).copied);
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/image.tmdb.org/**", (route) => route.fulfill({ status: 404 }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
    });
  });
});

test("film share names the film, drops filters and opens the film", async ({ page }) => {
  await page.goto("/retrospectives?day=2026-10-03");
  await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await page.getByRole("button", { name: "Share film", exact: true }).click();
  const url = new URL(await copied(page));
  expect(url.pathname).toBe("/film/classic-a/fixture-classic-a/");
  expect(url.search).toBe("");
  await page.goto(url.pathname);
  await expect(page.locator(".film-expanded")).toBeVisible();
  await expect(page).toHaveTitle("Fixture Classic A — London Ciné Info");
  await expect(
    page.getByRole("button", { name: "Fixture Classic A", exact: true }),
  ).toBeInViewport();
  await expect(page.getByRole("link", { name: "Open on Letterboxd", exact: true })).toBeVisible();
  // Closing the film returns to the ordinary catalogue address.
  await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle(/^(?!Fixture)/);
  // A link whose trailing slash was trimmed still opens the film.
  await page.goto("/film/classic-a/fixture-classic-a");
  await expect(page.locator(".film-expanded")).toBeVisible();
});

test("built film pages carry crawler-readable preview metadata", async ({ request }) => {
  const html = await (await request.get("/film/classic-a/fixture-classic-a/")).text();
  expect(html).toContain("<title>Fixture Classic A (1977) — London Ciné Info</title>");
  expect(html).toContain(
    'property="og:title" content="Fixture Classic A (1977) — London Ciné Info"',
  );
  expect(html).toMatch(/property="og:image" content="https:\/\/[^"]+"/);
  // Portrait posters: the small card, which does not crop them.
  expect(html).toContain('name="twitter:card" content="summary"');
  expect(html).toContain(
    '<link rel="canonical" href="https://london-cine.info/film/classic-a/fixture-classic-a/" />',
  );
  expect(html).toContain(
    'property="og:url" content="https://london-cine.info/film/classic-a/fixture-classic-a/"',
  );
  expect(html).toContain('property="og:image:alt" content="Fixture Classic A poster"');
  expect(html).toContain('<div id="app">');
  // No poster: a text card and no image tag.
  const plain = await (await request.get("/film/classic-c/fixture-classic-c/")).text();
  expect(plain).toContain('name="twitter:card" content="summary"');
  expect(plain).not.toContain("og:image");
  // A film that has left the catalogue gets the app itself, which explains.
  const missing = await (await request.get("/film/gone/old-film/")).text();
  expect(missing).not.toContain("og:title");
  expect(missing).toContain('<div id="app">');
});

test("a shared screening on page 3 opens highlighted, focused and stays there", async ({
  page,
}) => {
  await busyProgramme(page);
  await page.goto(shared(rows[31]));
  const target = page.locator(".shared-screening");
  await expect(target).toBeVisible();
  // Focus lands on the visible label, so the row's own content is still read after it.
  await expect(target.locator(".shared-screening-label")).toBeFocused();
  await expect(target).toBeInViewport();
  await expect(target).toContainText("Shared screening · Fixture Classic A");
  await expect(target).toContainText("Picturehouse Central");
  await expect(target).toContainText("Sold out");
  await expect(target.getByRole("link", { name: /^Screening details/ })).toHaveAttribute(
    "href",
    rows[31]!.bookingUrl,
  );
  await expect(page.locator(".programme-count")).toHaveText("25–36 of 40 screenings");
  await expect(page.getByRole("navigation", { name: "Screening pages" })).toContainText(
    "Page 3 of 4",
  );
  await expect(page.locator(".showtime-day li")).toHaveCount(12);
  // Nothing resets the reader away from the shared page once it settles.
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".programme-count")).toHaveText("25–36 of 40 screenings");
  // Turning pages works from there, and the highlight is back on its page.
  await page.getByRole("button", { name: "Previous screenings", exact: true }).click();
  await expect(page.locator(".programme-count")).toHaveText("13–24 of 40 screenings");
  await expect(page.locator(".shared-screening")).toHaveCount(0);
  await page.getByRole("button", { name: "Next screenings", exact: true }).click();
  await expect(page.locator(".shared-screening")).toBeVisible();
  // Its own Share copies the same screening.
  await target.getByRole("button", { name: /^Share screening:/ }).click();
  expect(new URL(await copied(page)).searchParams.get("screening")).toBe(screeningId(rows[31]!));
  await page.screenshot({ path: test.info().outputPath("shared-screening.png") });
});

test("a shared screening hidden by the date choice says so and can be shown", async ({ page }) => {
  await busyProgramme(page);
  await page.goto(shared(rows[31]));
  await expect(page.locator(".shared-screening-label")).toBeFocused();
  await page
    .getByRole("group", { name: "Find a screening" })
    .getByRole("combobox", { name: "Date" })
    .selectOption("2026-10-06");
  await expect(page.getByRole("heading", { name: "Shared screening is hidden" })).toBeVisible();
  await page.getByRole("button", { name: "Show all dates and cinemas", exact: true }).click();
  await expect(page.locator(".shared-screening")).toBeVisible();
  await expect(page.locator(".programme-count")).toHaveText("25–36 of 40 screenings");
});

test("expired screening and film links explain what happened", async ({ page }) => {
  await busyProgramme(page);
  await page.goto(shared({ ...rows[0]!, time: 1 }));
  await expect(
    page.getByRole("heading", { name: "Shared screening is no longer listed" }),
  ).toBeVisible();
  await expect(page.locator(".programme-count")).toHaveText("1–12 of 40 screenings");
  await expect(page.locator(".shared-screening")).toHaveCount(0);
  // A malformed screening value is treated the same way, not as an error.
  await page.goto(`${shared()}?screening=%5Bnot-json`);
  await expect(
    page.getByRole("heading", { name: "Shared screening is no longer listed" }),
  ).toBeVisible();

  await page.goto("/film/no-longer-listed/old-film/?screening=%5B%5D");
  await expect(page.getByRole("heading", { name: "This film is no longer listed" })).toBeVisible();
  await page.getByRole("button", { name: "Browse current films", exact: true }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await expect(page.getByRole("heading", { name: "This film is no longer listed" })).toHaveCount(0);
});

test("a named film link finds its film beyond the first catalogue page", async ({ page }) => {
  await page.route("**/films.*.json", async (route) => {
    const response = await route.fetch();
    const films = await response.json();
    const original = films.find((entry: { id: string }) => entry.id === film.id);
    await route.fulfill({
      response,
      json: [
        ...Array.from({ length: 205 }, (_, index) => ({
          ...original,
          id: `before-${index}`,
          ti: `A ${index}`,
          ra: { ...original.ra, lb: { ...original.ra.lb, value: 5 } },
        })),
        { ...original, ra: { ...original.ra, lb: { ...original.ra.lb, value: 1 } } },
      ],
    });
  });
  await page.route("**/meta.*.json", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.counts.films = 206;
    await route.fulfill({ response, json: data });
  });
  await page.goto(shared());
  await expect(page.locator(".film-expanded")).toBeVisible();
  await expect(page).toHaveURL(/\/film\/classic-a\/fixture-classic-a\/\?page=2$/);
  await expect(
    page.getByRole("button", { name: "Fixture Classic A", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
});

test("an event screening shares a link that opens it highlighted", async ({ page }) => {
  await page.goto("/events");
  const share = page.getByRole("button", { name: /^Share screening: Fixture Classic A at/ });
  await share.first().click();
  const url = new URL(await copied(page));
  expect(url.pathname).toBe("/film/classic-a/fixture-classic-a/");
  await page.goto(url.pathname + url.search);
  await expect(page.locator(".shared-screening-label")).toBeFocused();
  await expect(page.locator(".shared-screening")).toContainText("Prince Charles");
});

test("screening share feedback re-announces and moves nothing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await busyProgramme(page);
  await page.goto("/?film=classic-a");
  const row = page.locator(".showtime-day li").first();
  const actions = row.locator(".screening-actions");
  await actions.scrollIntoViewIfNeeded();
  const parts = [".booking-action", ".share-screening", ".add-calendar"];
  const boxes = () => Promise.all(parts.map((part) => row.locator(part).boundingBox()));
  const initial = await boxes();
  // Book, Share and the calendar action never overflow the row.
  const rowBox = (await row.boundingBox())!;
  for (const box of initial)
    expect(box!.x + box!.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 0.5);
  const status = row.locator(".share-screening-control [role=status]");
  await page.evaluate(() => {
    const node = document.querySelector(".showtime-day li .share-screening-control [role=status]")!;
    const log: string[] = [];
    (window as unknown as { log: string[] }).log = log;
    new MutationObserver(() => log.push(node.textContent ?? "")).observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  const share = row.getByRole("button", { name: /^Share screening:/ });
  await share.click();
  // The share glyph swaps for a check at the same size.
  await expect(row.locator(".share-screening .share-icon path")).toHaveAttribute("d", /^M4 10\.5/);
  await expect(status).toHaveText("Screening link copied");
  await share.click();
  await expect(status).toHaveText("Screening link copied");
  const log = await page.evaluate(() => (window as unknown as { log: string[] }).log);
  // Cleared and set again, so a screen reader hears the second copy too.
  expect(log.filter((text) => text === "Screening link copied").length).toBe(2);
  await row.locator(".booking-action").hover();
  await share.focus();
  expect(await boxes()).toEqual(initial);
  await expect(row.locator(".booking-action svg")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("clipboard failure offers the link selected, across the row, until it is not needed", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { refuse: boolean }).refuse = true;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          if ((window as unknown as { refuse: boolean }).refuse) throw new Error("denied");
        },
      },
    });
  });
  await page.goto("/?film=classic-a");
  await page.getByRole("button", { name: "Share film", exact: true }).click();
  const filmLink = page.getByRole("textbox", { name: "Film link", exact: true });
  await expect(filmLink).toHaveValue(/\/film\/classic-a\/fixture-classic-a\/$/);
  await expect(filmLink).toBeFocused();
  const selected = () =>
    page.evaluate(() => {
      const field = document.activeElement as HTMLInputElement;
      return field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
    });
  expect(await selected()).toBe(await filmLink.inputValue());

  // Done puts it away and returns focus to Share film.
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(filmLink).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share film", exact: true })).toBeFocused();

  const row = page.locator(".showtime-day li").first();
  await row.getByRole("button", { name: /^Share screening:/ }).click();
  const link = row.getByRole("textbox", { name: "Screening link", exact: true });
  await expect(link).toHaveValue(/screening=princecharlescinema\.com~\d{8}T\d{4}Z~/);
  await expect(link).toBeFocused();
  expect(await selected()).toBe(await link.inputValue());
  // The field spans the screening row, not the narrow actions column.
  const field = (await link.boundingBox())!;
  const actions = (await row.locator(".screening-actions").boundingBox())!;
  const venue = (await row.locator(".screening-venue").boundingBox())!;
  expect(field.width).toBeGreaterThan(actions.width);
  expect(field.x).toBeLessThanOrEqual(venue.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // A later copy that works clears it.
  await page.evaluate(() => ((window as unknown as { refuse: boolean }).refuse = false));
  await row.getByRole("button", { name: /^Share screening:/ }).click();
  await expect(link).toHaveCount(0);
  // Escape puts it away too, back on the screening's Share.
  await page.evaluate(() => ((window as unknown as { refuse: boolean }).refuse = true));
  await row.getByRole("button", { name: /^Share screening:/ }).click();
  await expect(link).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(link).toHaveCount(0);
  await expect(row.getByRole("button", { name: /^Share screening:/ })).toBeFocused();
});

test("stale, missing or mistyped slugs correct themselves to the film's title", async ({
  page,
}) => {
  for (const path of [
    "/film/classic-a/an-old-title/",
    "/film/classic-a/",
    "/film/classic-a/Fixture-Classic-A",
  ]) {
    await page.goto(path);
    await expect(page.locator(".film-expanded")).toBeVisible();
    await expect(page).toHaveURL(/\/film\/classic-a\/fixture-classic-a\/$/);
  }
  // The screening survives the correction.
  await page.goto(`/film/classic-a/old/?screening=${encodeURIComponent(screeningId(rows[0]!))}`);
  await expect(page).toHaveURL(/\/film\/classic-a\/fixture-classic-a\/\?screening=/);
});

test("a showing moved within the hour still opens, labelled as changed", async ({ page }) => {
  await busyProgramme(page);
  // 25 minutes after the day's last Picturehouse showing: it is the only one within the hour.
  await page.goto(shared({ ...rows[31]!, time: rows[31]!.time + 25 * 60000 }));
  await expect(page.locator(".shared-screening-label")).toHaveText(
    /^Shared screening \(time changed\) · Fixture Classic A/,
  );
  await expect(page.locator(".shared-screening")).toContainText("Picturehouse Central");
});

// Each page is measured twice in the same run: as served, then with every Share removed
// (as before Share existed), so fonts and scrollbars of the machine cancel out.
for (const width of [1280, 1024, 900, 768, 390, 320]) {
  test(`Share adds no height to screening rows at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Sets its own viewport");
    await page.setViewportSize({ width, height: 900 });
    const measure = (selector: string) =>
      page.locator(selector).evaluateAll((nodes) =>
        nodes.map((node) => {
          const row = node.getBoundingClientRect();
          const share = node.querySelector(".share-screening")?.getBoundingClientRect();
          return {
            height: Math.round(row.height),
            // Share stays inside its row.
            inside:
              !share ||
              (share.top >= row.top - 0.5 &&
                share.bottom <= row.bottom + 0.5 &&
                share.left >= row.left - 0.5 &&
                share.right <= row.right + 0.5),
          };
        }),
      );
    const compare = async (path: string, selector: string) => {
      await page.goto(path);
      await expect(page.locator(`${selector} .share-screening`).first()).toBeVisible();
      const shown = await measure(selector);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.evaluate(() =>
        document
          .querySelectorAll(".share-screening-control, .guide-example .share-screening")
          .forEach((node) => node.remove()),
      );
      const without = await measure(selector);
      expect(shown.map((row) => row.inside)).not.toContain(false);
      // Never taller; at 320px rows are even shorter, as the calendar label may take two lines.
      expect(shown).toHaveLength(without.length);
      shown.forEach((row, index) => expect(row.height).toBeLessThanOrEqual(without[index]!.height));
      if (width >= 390)
        expect(shown.map((row) => row.height)).toEqual(without.map((row) => row.height));
    };
    await compare("/?film=classic-a", ".showtime-day li");
    await compare("/events", ".event-row");
    await compare("/how-to-use", ".guide-example .showtime-day li");
  });
}
