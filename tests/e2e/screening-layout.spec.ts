import { test, expect, type Page } from "@playwright/test";

const LONG_VENUE = "The Cinema in the Power Station (and the Arches), Battersea Riverside";

function showtimes(id: string) {
  const time = Date.parse("2026-10-04T19:30:00Z");
  const row = {
    time,
    localTime: "20:30",
    bookingUrl: "https://example.com/book",
    bookingFallback: false,
    screen: "Screen 1",
    notes: "Introduced by the director, followed by a long conversation with the audience",
    category: null,
    eventTitle: null,
  };
  return {
    id,
    details: { actors: [], overview: null },
    days: {
      "2026-10-04": [
        {
          ...row,
          venue: LONG_VENUE,
          formats: ["35mm", "imax", "4k", "dolby-atmos", "subtitled"],
          accessibility: ["audio-description", "captioned", "relaxed", "wheelchair"],
          soldOut: true,
        },
        { ...row, venue: "Short", formats: ["standard"], accessibility: [], soldOut: false },
      ],
    },
  };
}

async function openStubbedFilm(page: Page, delay = 0) {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route(/\/showtimes[^/]*\/([^/]+)\.json$/, async (route) => {
    const id = route
      .request()
      .url()
      .match(/\/([^/]+)\.json$/)![1]!;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    await route.fulfill({ json: showtimes(id) });
  });
  await page.goto("/");
  await page.locator(".film-row .film-title").first().click();
}

async function layout(page: Page) {
  return page.locator(".showtime-day li").evaluateAll((items) =>
    items.map((item) => {
      const rect = (selector: string) => item.querySelector(selector)!.getBoundingClientRect();
      const book = rect(".booking-action");
      const venue = rect(".screening-venue");
      const time = rect("time");
      const overlaps = [...item.querySelectorAll(".screening-tags .badge, small")].some((tag) => {
        const r = tag.getBoundingClientRect();
        return (
          r.left < book.right && r.right > book.left && r.top < book.bottom && r.bottom > book.top
        );
      });
      const lineHeight = parseFloat(
        getComputedStyle(item.querySelector(".screening-venue")!).lineHeight,
      );
      return {
        overlaps,
        bookSize: [book.width, book.height],
        // Book shares a line with the venue name, or with the time when the list is very narrow.
        level:
          (book.top <= venue.top + lineHeight && book.bottom >= venue.top) ||
          (book.top <= time.bottom && book.bottom >= time.top),
        venueWidth: venue.width,
        listWidth: item.getBoundingClientRect().width,
      };
    }),
  );
}

for (const width of [320, 390, 768, 1440]) {
  test(`Book keeps its own column beside the venue at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStubbedFilm(page);
    await expect(page.locator(".showtime-day li")).toHaveCount(2);
    await expect(page.getByText(LONG_VENUE)).toBeVisible();
    for (const row of await layout(page)) {
      expect(row.overlaps).toBe(false);
      expect(row.level).toBe(true);
      expect(row.bookSize[0]).toBeGreaterThanOrEqual(44);
      expect(row.bookSize[1]).toBeGreaterThanOrEqual(44);
      // The venue name keeps at least half of the row rather than being squeezed by actions.
      expect(row.venueWidth).toBeGreaterThanOrEqual(row.listWidth / 2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}

test("the screenings area keeps its space while screenings load", async ({ page }) => {
  await openStubbedFilm(page, 800);
  const status = page.locator(".details-status[role=status]");
  await expect(status).toBeVisible();
  const loading = await page.locator(".showtimes").boundingBox();
  await expect(page.locator(".showtime-day li")).toHaveCount(2);
  const loaded = await page.locator(".showtimes").boundingBox();
  expect(loading!.height).toBeGreaterThanOrEqual(200);
  expect(loaded!.y).toBe(loading!.y);
  expect(loaded!.height).toBeGreaterThanOrEqual(loading!.height);
});
