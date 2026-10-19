import { test, expect, type Page } from "@playwright/test";

const LONG_VENUE = "The Cinema in the Power Station (and the Arches), Battersea Riverside";

type Row = Record<string, unknown>;
const base = {
  time: Date.parse("2026-10-04T19:30:00Z"),
  localTime: "20:30",
  bookingUrl: "https://example.com/book",
  bookingFallback: false,
  screen: "Screen 1",
  notes: "Introduced by the director, followed by a long conversation with the audience",
  category: null,
  eventTitle: null,
};
const BUSY: Row[] = [
  {
    ...base,
    venue: LONG_VENUE,
    formats: ["35mm", "imax", "4k", "dolby-atmos", "subtitled"],
    accessibility: ["audio-description", "captioned", "relaxed", "wheelchair"],
    soldOut: true,
  },
  { ...base, venue: "Short", formats: ["standard"], accessibility: [], soldOut: false },
];
const SINGLE: Row[] = [
  {
    ...base,
    venue: "Short",
    notes: null,
    screen: null,
    formats: ["standard"],
    accessibility: [],
    soldOut: false,
  },
];

async function openStubbedFilm(page: Page, rows: Row[], delay = 0) {
  // Each test sets its own viewport, so one project covers every width.
  test.skip(test.info().project.name !== "desktop", "Widths are set per test");
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route(/\/showtimes[^/]*\/([^/]+)\.json$/, async (route) => {
    const id = route
      .request()
      .url()
      .match(/\/([^/]+)\.json$/)![1]!;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    await route.fulfill({
      json: { id, details: { actors: [], overview: null }, days: { "2026-10-04": rows } },
    });
  });
  await page.goto("/");
  await page.locator(".film-row .film-title").first().click();
}

async function layout(page: Page) {
  return page.locator(".showtime-day li").evaluateAll((items) =>
    items.map((item) => {
      const rect = (node: Element) => node.getBoundingClientRect();
      const intersects = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const venueNode = item.querySelector(".screening-venue")!;
      const venue = rect(venueNode);
      const time = rect(item.querySelector("time")!);
      const row = rect(item);
      const actions = [...item.querySelectorAll(".booking-action, .add-calendar")].map(rect);
      const book = rect(item.querySelector(".booking-action")!);
      const content = [venueNode, ...item.querySelectorAll(".screening-tags .badge, small")].map(
        rect,
      );
      const firstLine = parseFloat(getComputedStyle(venueNode).lineHeight);
      // Book in its own column, level with the first line of the venue name.
      const besideVenue = book.left >= venue.right && book.top <= venue.top + firstLine;
      // Narrow lists: Book on the time line, the venue name below it at full width.
      const onTimeLine =
        book.bottom <= venue.top &&
        book.top < time.bottom &&
        book.bottom > time.top &&
        venue.width >= (row.width - 40) * 0.9;
      return {
        layout: besideVenue ? "beside venue" : onTimeLine ? "time line" : "broken",
        overlaps: actions.some((action) => content.some((part) => intersects(action, part))),
        smallestTarget: Math.min(...actions.flatMap((action) => [action.width, action.height])),
        venueShare: venue.width / row.width,
      };
    }),
  );
}

const widths: [number, number, "beside venue" | "time line"][] = [
  [320, 800, "time line"],
  [390, 844, "time line"],
  [768, 900, "beside venue"],
  [844, 390, "time line"],
  [900, 900, "time line"],
  [1024, 900, "beside venue"],
  [1440, 900, "beside venue"],
];
for (const [width, height, expected] of widths) {
  test(`screening actions keep their own space at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openStubbedFilm(page, BUSY);
    await expect(page.locator(".showtime-day li")).toHaveCount(2);
    await expect(page.getByText(LONG_VENUE)).toBeVisible();
    for (const row of await layout(page)) {
      expect(row.layout).toBe(expected);
      expect(row.overlaps).toBe(false);
      expect(row.smallestTarget).toBeGreaterThanOrEqual(44);
      expect(row.venueShare).toBeGreaterThanOrEqual(0.5);
    }
    const showtimes = page.locator(".showtimes");
    expect(await showtimes.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  });
}

test("details below the screenings stay put while a short list loads on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStubbedFilm(page, SINGLE, 800);
  await expect(page.locator(".details-status[role=status]")).toBeVisible();
  const below = page.locator(".film-about > summary");
  const before = await below.boundingBox();
  await expect(page.locator(".showtime-day li")).toHaveCount(1);
  const after = await below.boundingBox();
  expect(after!.y).toBe(before!.y);
});
