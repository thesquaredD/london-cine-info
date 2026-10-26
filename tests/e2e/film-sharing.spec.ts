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
  await expect(page).toHaveTitle("Fixture Classic A (1977) — London Ciné Info");
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
  // A film that has left the catalogue gets the app shell, which explains on load.
  // The shell now has site-wide previews, but must never claim to be this film.
  const missing = await (await request.get("/film/gone/old-film/")).text();
  expect(missing).toContain(
    'property="og:title" content="London cinema listings and showtimes — London Ciné Info"',
  );
  expect(missing).not.toContain('"@type":"Movie"');
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
  const pages = page.getByRole("navigation", { name: "Screening pages", exact: true });
  await expect(pages).toContainText("Page 3 of 4");
  await expect(page.locator(".showtime-day li")).toHaveCount(12);
  // Nothing resets the reader away from the shared page once it settles.
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".programme-count")).toHaveText("25–36 of 40 screenings");
  // Turning pages works from there, and the highlight is back on its page.
  await pages.getByRole("button", { name: "Previous screenings", exact: true }).click();
  await expect(page.locator(".programme-count")).toHaveText("13–24 of 40 screenings");
  await expect(page.locator(".shared-screening")).toHaveCount(0);
  await pages.getByRole("button", { name: "Next screenings", exact: true }).click();
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
  const finder = page.getByRole("group", { name: "Find a screening" });
  await finder.getByRole("button", { name: /^Date/ }).click();
  await finder.getByRole("button", { name: /^Tuesday, 6 October 2026/ }).click();
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

test("screening share keeps its link icon, confirms with a toast and moves nothing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await busyProgramme(page);
  await page.goto("/?film=classic-a");
  const row = page.locator(".showtime-day li").first();
  const actions = row.locator(".screening-actions");
  await actions.scrollIntoViewIfNeeded();
  const parts = [".booking-action", ".share-screening", ".add-calendar"];
  // Measured from the row, so a scroll (the toast may cover a button on a phone) cancels out.
  const boxes = async () => {
    const origin = (await row.boundingBox())!;
    return Promise.all(
      parts.map(async (part) => {
        const box = (await row.locator(part).boundingBox())!;
        return { ...box, x: box.x - origin.x, y: box.y - origin.y };
      }),
    );
  };
  const initial = await boxes();
  // Book, Share and the calendar action never overflow the row.
  const rowBox = (await row.boundingBox())!;
  for (const box of initial) expect(box.x + box.width).toBeLessThanOrEqual(rowBox.width + 0.5);
  const share = row.getByRole("button", { name: /^Share screening:/ });
  await expect(share.locator(".link-icon")).toHaveCount(1);
  const toast = page.locator(".toast");
  await page.evaluate(() => {
    const node = document.querySelector(".toast")!;
    const log: string[] = [];
    (window as unknown as { log: string[] }).log = log;
    new MutationObserver(() => log.push(node.textContent ?? "")).observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await share.click();
  await expect(toast).toHaveText("Screening link copied");
  await expect(toast).toHaveAttribute("role", "status");
  await expect(toast).toBeInViewport();
  // The chain link stays; there is no check swap and no per-button status any more.
  await expect(share.locator(".link-icon")).toHaveCount(1);
  await expect(share.locator(".check-icon")).toHaveCount(0);
  await expect(row.locator("[role=status]")).toHaveCount(0);
  await share.click();
  await expect(toast).toHaveText("Screening link copied");
  // Cleared and set again, so a screen reader hears the second copy too.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { log: string[] }).log.filter(
            (text) => text === "Screening link copied",
          ).length,
      ),
    )
    .toBe(2);
  await row.locator(".booking-action").hover();
  await share.focus();
  expect(await boxes()).toEqual(initial);
  await expect(row.locator(".booking-action svg")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // It goes away by itself.
  await expect(toast).toBeEmpty({ timeout: 6000 });
  expect(errors).toEqual([]);
});

test("the toast shows over the open poster dialog for both share buttons", async ({ page }) => {
  await busyProgramme(page);
  await page.addInitScript(() => localStorage.setItem("london-cine.film-view.v1", "posters"));
  await page.goto("/?film=classic-a");
  const dialog = page.getByRole("dialog", { name: "Fixture Classic A" });
  await expect(dialog.locator(".showtime-day li").first()).toBeVisible();
  await dialog
    .getByRole("button", { name: /^Share screening:/ })
    .first()
    .click();
  const toast = page.locator(".toast");
  await expect(toast).toHaveText("Screening link copied");
  await expect(toast).toBeVisible();
  await expect(toast).toBeInViewport();
  // Rendered inside the modal dialog, so it is above it and not made inert by it.
  expect(await toast.evaluate((node) => !!node.closest("dialog[open]"))).toBe(true);
  const box = (await toast.boundingBox())!;
  const hit = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".toast"),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(hit).toBe(true);
  await dialog.getByRole("button", { name: "Share film", exact: true }).click();
  await expect(toast).toHaveText("Film link copied");
  await expect(dialog).toBeVisible();
  expect(await copied(page)).toMatch(/\/film\/classic-a\/fixture-classic-a\/$/);
});

test("a screening row has the same shape in the list and the poster dialog", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Sets its own viewport");
  await page.setViewportSize({ width: 1280, height: 900 });
  await busyProgramme(page);
  const shape = () =>
    page.locator(".showtime-day li").evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        const share = node.querySelector(".share-screening")!;
        return {
          areas: style.gridTemplateAreas,
          height: Math.round(node.getBoundingClientRect().height),
          shareStatic: getComputedStyle(share).position === "static",
          calendarLabel: getComputedStyle(node.querySelector(".add-calendar .action-label")!)
            .position,
        };
      }),
    );
  await page.goto("/?film=classic-a");
  await expect(page.locator(".showtime-day li").first()).toBeVisible();
  const list = await shape();
  await page.evaluate(() => localStorage.setItem("london-cine.film-view.v1", "posters"));
  await page.goto("/?film=classic-a");
  const dialog = page.getByRole("dialog", { name: "Fixture Classic A" });
  await expect(dialog.locator(".showtime-day li").first()).toBeVisible();
  const poster = await shape();
  expect(list[0]!.areas).toBe('"time dot details actions"');
  expect(poster).toEqual(list);
  expect(list.every((row) => row.shareStatic)).toBe(true);
  // Rows with and without tags or notes are one height (the last row of a day has no rule).
  const heights = list.map((row) => row.height);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
  // Book lines up down the page.
  const books = await dialog
    .locator(".booking-action")
    .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().left)));
  expect(new Set(books).size).toBe(1);
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
  await expect(page.locator(".toast")).toHaveText("Copy the film link from the selected field.");
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
  await expect(page.locator(".toast")).toHaveText(
    "Copy the screening link from the selected field.",
  );
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

// Every row of a list is one height whatever it carries, and Share sits inside it, at every
// width. Rows are compared with each other within one run, so the machine's fonts and
// scrollbars cancel out.
for (const width of [1280, 1024, 900, 768, 390, 320]) {
  test(`screening rows keep one height with Share at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Sets its own viewport");
    await page.setViewportSize({ width, height: 900 });
    const measure = (selector: string) =>
      page.locator(selector).evaluateAll((nodes) =>
        nodes.map((node) => {
          const row = node.getBoundingClientRect();
          const share = node.querySelector(".share-screening")!.getBoundingClientRect();
          // The last row of a day has no rule under it.
          const rule = parseFloat(getComputedStyle(node).borderBottomWidth) || 0;
          return {
            height: Math.round(row.height - rule),
            inside:
              share.top >= row.top - 0.5 &&
              share.bottom <= row.bottom + 0.5 &&
              share.left >= row.left - 0.5 &&
              share.right <= row.right + 0.5,
            square: Math.round(share.width) === 44 && Math.round(share.height) === 44,
          };
        }),
      );
    const check = async (path: string, selector: string) => {
      await page.goto(path);
      await expect(page.locator(`${selector} .share-screening`).first()).toBeVisible();
      const rows = await measure(selector);
      expect(rows.length).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(rows.map((row) => row.inside)).not.toContain(false);
      expect(rows.map((row) => row.square)).not.toContain(false);
      expect(new Set(rows.map((row) => row.height)).size, path).toBe(1);
    };
    await check("/?film=classic-a", ".showtime-day li");
    await check("/how-to-use", ".guide-example .showtime-day li");
  });
}
