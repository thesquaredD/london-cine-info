import { test, expect, type Page } from "@playwright/test";

// A busy programme: 30 screenings over three days at three fixture cinemas. Each day runs
// 10:00–19:00 London time, cycling Prince Charles, BFI Southbank, Picturehouse Central, so
// Prince Charles has 12 screenings and the other two 9 each.
const VENUES = ["princecharlescinema.com", "bfi.org.uk-southbank", "picturehouses.com-central"];
const DAYS = ["2026-10-04", "2026-10-05", "2026-10-06"];
const programme = Object.fromEntries(
  DAYS.map((date) => [
    date,
    Array.from({ length: 10 }, (_, hour) => {
      const time = Date.parse(`${date}T${String(hour + 9).padStart(2, "0")}:00:00Z`);
      return {
        venue: VENUES[hour % 3],
        time,
        localTime: `${String(hour + 10).padStart(2, "0")}:00`,
        bookingUrl: `https://example.com/book/${time}`,
        bookingFallback: false,
        screen: null,
        notes: null,
        category: "movie",
        formats: ["standard"],
        accessibility: [],
        soldOut: false,
      };
    }),
  ]),
);

async function openBusyFilm(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route(/\/showtimes[^/]*\/classic-a\.json$/, (route) =>
    route.fulfill({
      json: { id: "classic-a", details: { actors: [], overview: null }, days: programme },
    }),
  );
  await page.goto("/");
  await page.locator(".film-row .film-title", { hasText: "Fixture Classic A" }).click();
  const showtimes = page.locator(".showtimes");
  await expect(showtimes.locator(".showtime-day").first()).toBeVisible();
  return showtimes;
}

test("a busy programme pages through 12 screenings at a time", async ({ page }) => {
  const showtimes = await openBusyFilm(page);
  const finder = showtimes.getByRole("group", { name: "Find a screening" });
  const count = finder.getByRole("status");
  const pages = showtimes.getByRole("navigation", { name: "Screening pages" });
  await expect(count).toHaveText("1–12 of 30 screenings");
  await expect(pages).toContainText("Page 1 of 3");
  await expect(showtimes.locator(".showtime-day li")).toHaveCount(12);
  // Rows keep their London day: page 1 is all of Sunday and the first two on Monday.
  await expect(showtimes.locator(".showtime-day h3")).toHaveText([
    "Sunday, 4 October 2026",
    "Monday, 5 October 2026",
  ]);
  await expect(pages.getByRole("button", { name: "Previous screenings" })).toBeDisabled();
  await pages.getByRole("button", { name: "Next screenings" }).click();
  await expect(count).toHaveText("13–24 of 30 screenings");
  await pages.getByRole("button", { name: "Next screenings" }).click();
  await expect(count).toHaveText("25–30 of 30 screenings");
  await expect(showtimes.locator(".showtime-day li")).toHaveCount(6);
  await expect(pages.getByRole("button", { name: "Next screenings" })).toBeDisabled();
  // Page turns bring the top of the programme back into view.
  await expect(finder).toBeInViewport();
});

test("a busy programme filters by cinema and date, then resets", async ({ page }) => {
  const showtimes = await openBusyFilm(page);
  const finder = showtimes.getByRole("group", { name: "Find a screening" });
  const count = finder.getByRole("status");
  const reset = finder.getByRole("button", { name: "Reset" });
  const cinema = finder.getByRole("combobox", { name: "Screening cinema" });
  const date = finder.getByRole("combobox", { name: "Screening date" });
  await expect(reset).toBeDisabled();
  await expect(cinema.locator("option")).toHaveText([
    "All cinemas",
    "BFI Southbank · 9",
    "Picturehouse Central · 9",
    "Prince Charles Cinema · 12",
  ]);

  // Choosing a cinema from a later page starts again at its first page.
  await showtimes.getByRole("button", { name: "Next screenings" }).click();
  await cinema.selectOption("bfi.org.uk-southbank");
  await expect(count).toHaveText("1–9 of 9 screenings");
  await expect(showtimes.locator(".showtime-day li")).toHaveCount(9);
  await expect(showtimes.locator(".showtime-day li", { hasText: "BFI Southbank" })).toHaveCount(9);
  await expect(showtimes.getByRole("navigation", { name: "Screening pages" })).toHaveCount(0);
  // Date counts follow the chosen cinema.
  await expect(date.locator("option").nth(1)).toHaveText("4 October 2026 · 3");

  await date.selectOption("2026-10-05");
  await expect(count).toHaveText("1–3 of 3 screenings");
  await expect(showtimes.locator(".showtime-day h3")).toHaveText(["Monday, 5 October 2026"]);

  await reset.click();
  await expect(count).toHaveText("1–12 of 30 screenings");
  await expect(cinema).toHaveValue("");
  await expect(date).toHaveValue("");
  await expect(reset).toBeDisabled();
});

test("a local cinema choice drops out when the global filters exclude it", async ({ page }) => {
  const showtimes = await openBusyFilm(page);
  const finder = showtimes.getByRole("group", { name: "Find a screening" });
  await finder
    .getByRole("combobox", { name: "Screening cinema" })
    .selectOption("bfi.org.uk-southbank");
  await expect(finder.getByRole("status")).toHaveText("1–9 of 9 screenings");
  await page.evaluate(() => {
    // The open film lives in the address, so it stays open as the filter changes.
    const url = new URL(location.href);
    url.searchParams.append("not_venue", "bfi.org.uk-southbank");
    history.pushState(null, "", url);
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(finder.getByRole("status")).toHaveText("1–12 of 21 screenings");
  await expect(finder.getByRole("combobox", { name: "Screening cinema" })).toHaveValue("");
  await expect(showtimes.locator(".showtime-day li", { hasText: "BFI Southbank" })).toHaveCount(0);
});
