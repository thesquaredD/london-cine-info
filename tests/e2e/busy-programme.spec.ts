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
});

test("a page turn from far down brings the programme top back and focuses the count", async ({
  page,
}) => {
  const showtimes = await openBusyFilm(page);
  const count = showtimes.locator(".programme-count");
  const next = showtimes.getByRole("button", { name: "Next screenings" });
  await next.scrollIntoViewIfNeeded();
  // The Next button sits below the fold, so the programme top starts out of view.
  expect((await showtimes.boundingBox())!.y).toBeLessThan(0);
  await next.click();
  await expect(count).toHaveText("13–24 of 30 screenings");
  await expect(count).toBeFocused();
  // The programme top lands at its scroll margin, just below the sticky header.
  const margin = await showtimes.evaluate((node) =>
    parseFloat(getComputedStyle(node).scrollMarginTop),
  );
  expect(Math.abs((await showtimes.boundingBox())!.y - margin)).toBeLessThanOrEqual(2);
});

test("a busy programme filters by cinema and date, then resets", async ({ page }) => {
  const showtimes = await openBusyFilm(page);
  const finder = showtimes.getByRole("group", { name: "Find a screening" });
  const count = finder.getByRole("status");
  const reset = finder.getByRole("button", { name: "Reset" });
  const cinema = finder.getByRole("button", { name: /^Cinema/ });
  const date = finder.getByRole("button", { name: /^Date/ });
  await expect(reset).toBeDisabled();
  await expect(cinema).toContainText("All cinemas");
  await expect(date).toContainText("All dates");
  await cinema.click();
  const cinemas = finder.getByRole("dialog", { name: "Cinema" });
  // All cinemas first, then the cinemas grouped by borough, each with its count.
  await expect(cinemas.getByRole("option")).toHaveText([
    "All cinemas 30",
    "BFI Southbank 9",
    "Picturehouse Central 9",
    "Prince Charles Cinema 12",
  ]);
  await expect(cinemas.getByRole("group")).toHaveText([/^Lambeth/, /^Westminster/]);
  await page.keyboard.press("Escape");

  // Choosing a cinema from a later page starts again at its first page.
  await showtimes.getByRole("button", { name: "Next screenings" }).click();
  await cinema.click();
  await cinemas.getByRole("option", { name: /^BFI Southbank/ }).click();
  await expect(cinemas).toHaveCount(0);
  await expect(cinema).toBeFocused();
  await expect(cinema).toContainText("BFI Southbank");
  await expect(count).toHaveText("1–9 of 9 screenings");
  await expect(reset).toBeEnabled();
  await expect(showtimes.locator(".showtime-day li")).toHaveCount(9);
  await expect(showtimes.locator(".showtime-day li", { hasText: "BFI Southbank" })).toHaveCount(9);
  await expect(showtimes.getByRole("navigation", { name: "Screening pages" })).toHaveCount(0);
  await expect(showtimes.locator(".programme-page")).toHaveCount(0);

  // Date counts follow the chosen cinema; days without screenings cannot be chosen.
  await date.click();
  const dates = finder.getByRole("dialog", { name: "Date" });
  await expect(dates.getByRole("button", { name: /^Sunday, 4 October 2026/ })).toHaveAccessibleName(
    "Sunday, 4 October 2026 · 3 screenings",
  );
  await expect(dates.getByRole("button", { name: /^Wednesday, 7 October 2026/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await dates.getByRole("button", { name: /^Monday, 5 October 2026/ }).click();
  await expect(dates).toHaveCount(0);
  await expect(date).toContainText("Mon 5 Oct");
  await expect(count).toHaveText("1–3 of 3 screenings");
  await expect(showtimes.locator(".showtime-day h3")).toHaveText(["Monday, 5 October 2026"]);

  // Cinema counts follow the chosen date.
  await cinema.click();
  await expect(cinemas.getByRole("option", { name: /^Prince Charles Cinema/ })).toHaveText(
    "Prince Charles Cinema 4",
  );
  await page.keyboard.press("Escape");

  await reset.click();
  await expect(count).toHaveText("1–12 of 30 screenings");
  await expect(cinema).toContainText("All cinemas");
  await expect(date).toContainText("All dates");
  await expect(reset).toBeDisabled();
});

test("the date shortcuts choose a day or the weekend", async ({ page }) => {
  // Saturday 3 October: tomorrow is Sunday 4, and this weekend is Saturday and Sunday.
  const showtimes = await openBusyFilm(page);
  const finder = showtimes.getByRole("group", { name: "Find a screening" });
  const date = finder.getByRole("button", { name: /^Date/ });
  await date.click();
  const dates = finder.getByRole("dialog", { name: "Date" });
  // Today has no screenings here, so it is not offered.
  await expect(dates.locator(".date-shortcuts button")).toHaveText([
    "All dates 30",
    "Tomorrow 10",
    "This weekend 10",
  ]);
  await dates.getByRole("button", { name: /^This weekend/ }).click();
  await expect(date).toContainText("This weekend");
  await expect(finder.getByRole("status")).toHaveText("1–10 of 10 screenings");
  await expect(showtimes.locator(".showtime-day h3")).toHaveText(["Sunday, 4 October 2026"]);
});

test("the Date and Cinema panels float over the list and close on Escape", async ({ page }) => {
  const showtimes = await openBusyFilm(page);
  const finder = showtimes.getByRole("group", { name: "Find a screening" });
  const firstRow = showtimes.locator(".showtime-day li").first();
  const top = () => firstRow.evaluate((node) => (node as HTMLElement).offsetTop);
  const before = await top();
  for (const name of ["Date", "Cinema"]) {
    const field = finder.getByRole("button", { name: new RegExp(`^${name}`) });
    // A 48px field with a 16px value.
    expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await expect(field.locator(".choice-value")).toHaveCSS("font-size", "16px");
    await expect(field).toHaveAttribute("aria-expanded", "false");
    await field.click();
    await expect(field).toHaveAttribute("aria-expanded", "true");
    const panel = finder.getByRole("dialog", { name });
    await expect(panel).toBeVisible();
    // Focus moves into the panel, and the list below has not moved.
    expect(await panel.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    expect(await top()).toBe(before);
    // The panel covers the first row rather than pushing it down.
    const panelBox = (await panel.boundingBox())!;
    const rowBox = (await firstRow.boundingBox())!;
    expect(panelBox.y + panelBox.height).toBeGreaterThan(rowBox.y);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-expanded", "false");
  }
  // A press outside closes it too, without choosing.
  const cinema = finder.getByRole("button", { name: /^Cinema/ });
  await cinema.click();
  await page.locator(".film-expanded .film-facts").click();
  await expect(finder.getByRole("dialog", { name: "Cinema" })).toHaveCount(0);
  await expect(finder.getByRole("status")).toHaveText("1–12 of 30 screenings");
  // The count and page share one line.
  const countBox = (await finder.getByRole("status").boundingBox())!;
  const pageBox = (await finder.locator(".programme-page").boundingBox())!;
  await expect(finder.locator(".programme-page")).toHaveText("Page 1 of 3");
  expect(Math.abs(countBox.y + countBox.height - (pageBox.y + pageBox.height))).toBeLessThan(2);
});

test("the Cinema panel works from the keyboard", async ({ page }) => {
  const showtimes = await openBusyFilm(page);
  const finder = showtimes.getByRole("group", { name: "Find a screening" });
  const cinema = finder.getByRole("button", { name: /^Cinema/ });
  await cinema.focus();
  await page.keyboard.press("Enter");
  const options = finder.getByRole("dialog", { name: "Cinema" }).getByRole("option");
  await expect(options.first()).toBeFocused();
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(2)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(cinema).toBeFocused();
  await expect(cinema).toContainText("Picturehouse Central");
  await expect(finder.getByRole("status")).toHaveText("1–9 of 9 screenings");
});

test("local choices drop when the global filters change and stay dropped on Back", async ({
  page,
}) => {
  const showtimes = await openBusyFilm(page);
  const finder = showtimes.getByRole("group", { name: "Find a screening" });
  const cinema = finder.getByRole("button", { name: /^Cinema/ });
  await cinema.click();
  await finder.getByRole("option", { name: /^BFI Southbank/ }).click();
  await expect(finder.getByRole("status")).toHaveText("1–9 of 9 screenings");
  await page.evaluate(() => {
    // The open film lives in the address, so it stays open as the filter changes.
    const url = new URL(location.href);
    url.searchParams.append("not_venue", "bfi.org.uk-southbank");
    history.pushState(null, "", url);
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(finder.getByRole("status")).toHaveText("1–12 of 21 screenings");
  await expect(cinema).toContainText("All cinemas");
  await expect(showtimes.locator(".showtime-day li", { hasText: "BFI Southbank" })).toHaveCount(0);
  // Going back to the earlier filters keeps the programme unfiltered rather than silently
  // restoring the old cinema choice.
  await page.evaluate(() => {
    history.back();
  });
  await expect(finder.getByRole("status")).toHaveText("1–12 of 30 screenings");
  await expect(cinema).toContainText("All cinemas");
});

test("in the poster dialog, Escape closes a choice panel and leaves the film open", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("london-cine.film-view.v1", "posters"));
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route(/\/showtimes[^/]*\/classic-a\.json$/, (route) =>
    route.fulfill({
      json: { id: "classic-a", details: { actors: [], overview: null }, days: programme },
    }),
  );
  await page.goto("/?film=classic-a");
  const dialog = page.getByRole("dialog", { name: "Fixture Classic A" });
  const finder = dialog.getByRole("group", { name: "Find a screening" });
  const cinema = finder.getByRole("button", { name: /^Cinema/ });
  await cinema.click();
  await expect(finder.getByRole("dialog", { name: "Cinema" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(finder.getByRole("dialog", { name: "Cinema" })).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(cinema).toBeFocused();
  await cinema.click();
  await finder.getByRole("option", { name: /^Prince Charles Cinema/ }).click();
  await expect(finder.getByRole("status")).toHaveText("1–12 of 12 screenings");
  // A second Escape, with no panel open, closes the film as before.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
