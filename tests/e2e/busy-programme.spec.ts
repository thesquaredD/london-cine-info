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
  const pages = showtimes.getByRole("navigation", { name: "Screening pages", exact: true });
  const bottom = showtimes.getByRole("navigation", { name: "Screening pages, bottom" });
  await expect(count).toHaveText("1–12 of 30 screenings");
  await expect(pages).toContainText("Page 1 of 3");
  await expect(bottom).toContainText("Page 1 of 3");
  // Visible labels are short; the accessible names say what turns.
  await expect(pages.getByRole("button", { name: "Next screenings" })).toHaveText("Next ›");
  await expect(pages.getByRole("button", { name: "Previous screenings" })).toHaveText("‹ Previous");
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
  await expect(bottom.getByRole("button", { name: "Next screenings" })).toBeDisabled();
  await expect(bottom.getByRole("button", { name: "Previous screenings" })).toBeEnabled();
});

test("Previous and Next sit above the first row and below the last, and scroll nothing", async ({
  page,
}) => {
  const showtimes = await openBusyFilm(page);
  const count = showtimes.locator(".programme-count");
  const top = showtimes.getByRole("navigation", { name: "Screening pages", exact: true });
  const bottom = showtimes.getByRole("navigation", { name: "Screening pages, bottom" });
  const rows = showtimes.locator(".showtime-day li");
  const box = async (locator: typeof top) => (await locator.boundingBox())!;
  expect((await box(top)).y + (await box(top)).height).toBeLessThanOrEqual(
    (await box(rows.first())).y,
  );
  expect((await box(bottom)).y).toBeGreaterThanOrEqual(
    (await box(rows.last())).y + (await box(rows.last())).height,
  );
  // The bottom pair: the page stays exactly where it is and focus moves to the count.
  const next = bottom.getByRole("button", { name: "Next screenings" });
  await next.scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => scrollY);
  await next.click();
  await expect(count).toHaveText("13–24 of 30 screenings");
  await expect(count).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(scrolled);
  // The top pair, likewise.
  const previous = top.getByRole("button", { name: "Previous screenings" });
  await previous.scrollIntoViewIfNeeded();
  const above = await page.evaluate(() => scrollY);
  await previous.click();
  await expect(count).toHaveText("1–12 of 30 screenings");
  await expect(count).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(above);
  // Every pager target is at least 44px tall.
  for (const button of await showtimes.locator(".programme-pager button").all())
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("a busy programme filters by cinema and date, then resets", async ({ page }, testInfo) => {
  // Phones have Reset as a link on the count line, shown only while a choice is active.
  const phone = testInfo.project.name === "mobile";
  const showtimes = await openBusyFilm(page);
  const finder = showtimes.getByRole("group", { name: "Find a screening" });
  const count = finder.getByRole("status");
  const reset = finder.getByRole("button", { name: "Reset" });
  const cinema = finder.getByRole("button", { name: /^Cinema/ });
  const date = finder.getByRole("button", { name: /^Date/ });
  if (phone) await expect(reset).toHaveCount(0);
  else await expect(reset).toBeDisabled();
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
  await showtimes
    .getByRole("navigation", { name: "Screening pages", exact: true })
    .getByRole("button", { name: "Next screenings" })
    .click();
  await cinema.click();
  await cinemas.getByRole("option", { name: /^BFI Southbank/ }).click();
  await expect(cinemas).toHaveCount(0);
  await expect(cinema).toBeFocused();
  await expect(cinema).toContainText("BFI Southbank");
  await expect(count).toHaveText("1–9 of 9 screenings");
  await expect(reset).toBeEnabled();
  await expect(showtimes.locator(".showtime-day li")).toHaveCount(9);
  await expect(showtimes.locator(".showtime-day li", { hasText: "BFI Southbank" })).toHaveCount(9);
  // One page: neither pager is shown.
  await expect(showtimes.getByRole("navigation", { name: /^Screening pages/ })).toHaveCount(0);
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
  if (phone) await expect(reset).toHaveCount(0);
  else await expect(reset).toBeDisabled();
});

test("on a phone Date and Cinema share a line and Reset is a link on the count line", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Phone layout");
  const showtimes = await openBusyFilm(page);
  const finder = showtimes.getByRole("group", { name: "Find a screening" });
  const date = (await finder.getByRole("button", { name: /^Date/ }).boundingBox())!;
  const cinema = (await finder.getByRole("button", { name: /^Cinema/ }).boundingBox())!;
  expect(Math.abs(date.y - cinema.y)).toBeLessThan(1);
  expect(cinema.x).toBeGreaterThanOrEqual(date.x + date.width);
  expect(Math.abs(date.width - cinema.width)).toBeLessThan(2);
  // The pager takes its own line above the count, with a short page number.
  const top = finder.getByRole("navigation", { name: "Screening pages", exact: true });
  await expect(top.locator(".programme-page-short")).toHaveText("1 / 3");
  await expect(top.locator(".programme-page")).toBeHidden();
  const count = finder.getByRole("status");
  expect((await top.boundingBox())!.y + (await top.boundingBox())!.height).toBeLessThanOrEqual(
    (await count.boundingBox())!.y,
  );
  await expect(finder.getByRole("button", { name: "Reset" })).toHaveCount(0);
  await finder.getByRole("button", { name: /^Cinema/ }).click();
  await finder.getByRole("option", { name: /^BFI Southbank/ }).click();
  const reset = finder.getByRole("button", { name: "Reset" });
  await expect(reset).toHaveClass(/programme-reset-link/);
  await expect(reset).toHaveCSS("text-decoration-line", "underline");
  // On the count line, at its right end, with a 44px target.
  const resetBox = (await reset.boundingBox())!;
  const countBox = (await count.boundingBox())!;
  const finderBox = (await finder.boundingBox())!;
  expect(resetBox.y).toBeLessThan(countBox.y + countBox.height);
  expect(resetBox.y + resetBox.height).toBeGreaterThan(countBox.y);
  expect(finderBox.x + finderBox.width - (resetBox.x + resetBox.width)).toBeLessThan(16);
  expect(resetBox.height).toBeGreaterThanOrEqual(44);
  await reset.click();
  await expect(count).toHaveText("1–12 of 30 screenings");
  await expect(reset).toHaveCount(0);
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
  // The count and the top pager share one line; phones give the pager its own line above.
  const countBox = (await finder.getByRole("status").boundingBox())!;
  const pager = finder.getByRole("navigation", { name: "Screening pages", exact: true });
  const pagerBox = (await pager.boundingBox())!;
  if (test.info().project.name === "mobile") {
    await expect(pager.locator(".programme-page-short")).toHaveText("1 / 3");
    expect(pagerBox.y + pagerBox.height).toBeLessThanOrEqual(countBox.y);
  } else {
    await expect(pager.locator(".programme-page")).toHaveText("Page 1 of 3");
    const middle = (box: { y: number; height: number }) => box.y + box.height / 2;
    expect(Math.abs(middle(countBox) - middle(pagerBox))).toBeLessThan(2);
    expect(pagerBox.x).toBeGreaterThan(countBox.x + countBox.width);
  }
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

const DETAILS = {
  overview:
    "A writer takes the job of finishing another author's series and, in the author's house, finds a manuscript that was never meant to be read. ".repeat(
      4,
    ),
  actors: ["Ava One", "Ben Two", "Cleo Three", "Dan Four", "Eve Five", "Finn Six"].map((name) => ({
    name,
  })),
};
async function openPosterFilm(page: Page, days: Record<string, unknown[]>) {
  await page.addInitScript(() => localStorage.setItem("london-cine.film-view.v1", "posters"));
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route(/\/showtimes[^/]*\/classic-a\.json$/, (route) =>
    route.fulfill({ json: { id: "classic-a", details: DETAILS, days } }),
  );
  await page.goto("/?film=classic-a");
  const dialog = page.getByRole("dialog", { name: "Fixture Classic A" });
  await expect(dialog.locator(".showtime-day").first()).toBeVisible();
  return dialog;
}

test("the desktop film column shows the synopsis and cast; phones keep More details", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route(/\/showtimes[^/]*\/classic-a\.json$/, (route) =>
    route.fulfill({ json: { id: "classic-a", details: DETAILS, days: programme } }),
  );
  await page.goto("/");
  await page.locator(".film-row .film-title", { hasText: "Fixture Classic A" }).click();
  const expanded = page.locator(".film-expanded");
  await expect(expanded.locator(".showtime-day").first()).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await expect(expanded.locator(".film-about > summary")).toHaveText("More details");
    await expect(expanded.locator(".film-cast-line")).toHaveCount(0);
    return;
  }
  const info = expanded.locator(".film-info");
  await expect(expanded.locator(".film-about")).toHaveCount(0);
  await expect(expanded.getByText("More details", { exact: true })).toHaveCount(0);
  const synopsis = info.locator(".film-synopsis");
  await expect(synopsis).toBeVisible();
  // Six lines, then Read more opens the rest.
  const lines = await synopsis.evaluate(
    (node) => node.clientHeight / parseFloat(getComputedStyle(node).lineHeight),
  );
  expect(Math.round(lines)).toBe(6);
  await info.getByRole("button", { name: "Read more" }).click();
  await expect(info.getByRole("button", { name: "Less" })).toBeVisible();
  // The first five names, then the Report link last.
  await expect(info.locator(".film-cast-line")).toHaveText(
    "Cast · Ava One, Ben Two, Cleo Three, Dan Four, Eve Five",
  );
  const castBox = (await info.locator(".film-cast-line").boundingBox())!;
  const report = (await info
    .getByRole("button", { name: "Report a listing problem" })
    .boundingBox())!;
  expect(report.y).toBeGreaterThan(castBox.y);
});

test("the poster sheet has no title bar, pages from top and bottom, and scrolls nothing", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Width is set here");
  await page.setViewportSize({ width: 1280, height: 900 });
  const dialog = await openPosterFilm(page, programme);
  await expect(dialog.locator(".sheet-heading")).toHaveCount(0);
  const close = dialog.getByRole("button", { name: "Close Fixture Classic A" });
  await expect(close).toBeVisible();
  const closeBox = (await close.boundingBox())!;
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);
  // The film names itself in the sheet, and its column carries the synopsis.
  await expect(dialog.locator(".film-detail-title")).toBeVisible();
  await expect(dialog.locator(".film-info .film-synopsis")).toBeVisible();
  await expect(dialog.locator(".film-about")).toHaveCount(0);
  // Twelve rows are taller than the window, so the sheet stops at 85% and scrolls.
  const box = (await dialog.boundingBox())!;
  expect(Math.abs(box.height - 900 * 0.85)).toBeLessThan(2);
  const count = dialog.locator(".programme-count");
  const top = dialog.getByRole("navigation", { name: "Screening pages", exact: true });
  const bottom = dialog.getByRole("navigation", { name: "Screening pages, bottom" });
  await expect(top).toBeInViewport();
  const scrollTop = () => dialog.evaluate((node) => node.scrollTop);
  const pageY = await page.evaluate(() => scrollY);
  // Top Next: no scroll in the sheet or the page.
  await top.getByRole("button", { name: "Next screenings" }).click();
  await expect(count).toHaveText("13–24 of 30 screenings");
  expect(await scrollTop()).toBe(0);
  // Bottom Next, from the end of the sheet: the sheet stays where it was.
  const next = bottom.getByRole("button", { name: "Next screenings" });
  await next.scrollIntoViewIfNeeded();
  const scrolled = await scrollTop();
  expect(scrolled).toBeGreaterThan(0);
  // The close button floats in the corner while the sheet scrolls.
  await expect(close).toBeInViewport();
  expect(Math.abs((await close.boundingBox())!.y - closeBox.y)).toBeLessThan(1);
  // To the shorter last page and back: the list keeps its height, so nothing moves.
  await next.click();
  await expect(count).toHaveText("25–30 of 30 screenings");
  expect(await scrollTop()).toBe(scrolled);
  await expect(next).toBeInViewport();
  await bottom.getByRole("button", { name: "Previous screenings" }).click();
  await expect(count).toHaveText("13–24 of 30 screenings");
  await expect(count).toBeFocused();
  expect(await scrollTop()).toBe(scrolled);
  expect(await page.evaluate(() => scrollY)).toBe(pageY);
  await close.click();
  await expect(dialog).toHaveCount(0);
});

test("a short programme makes a short poster sheet, a bottom sheet with a grip on phones", async ({
  page,
}, testInfo) => {
  const days = { "2026-10-04": programme["2026-10-04"]!.slice(0, 2) };
  const dialog = await openPosterFilm(page, days);
  await dialog.evaluate((node) =>
    Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  const viewport = page.viewportSize()!;
  await expect(dialog.locator(".showtime-day li")).toHaveCount(2);
  await expect(dialog.getByRole("navigation", { name: /^Screening pages/ })).toHaveCount(0);
  await expect(dialog.locator(".sheet-heading")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Close Fixture Classic A" })).toBeVisible();
  const box = (await dialog.boundingBox())!;
  // As tall as its content: nothing to scroll and well short of the cap.
  const fits = await dialog.evaluate((node) => node.scrollHeight <= node.clientHeight + 1);
  expect(fits).toBe(true);
  const grip = dialog.locator(".sheet-grip");
  if (testInfo.project.name === "mobile") {
    expect(box.height).toBeLessThan(viewport.height * 0.92);
    // A bottom sheet: full width, on the bottom edge, with a grip at the top.
    expect(Math.abs(box.y + box.height - viewport.height)).toBeLessThan(2);
    await expect(grip).toBeVisible();
    const gripBox = (await grip.boundingBox())!;
    expect(gripBox.width).toBe(36);
    expect(Math.abs(gripBox.x + gripBox.width / 2 - (box.x + box.width / 2))).toBeLessThan(2);
    // The close button stays clear of the film title.
    const close = (await dialog.getByRole("button", { name: /^Close/ }).boundingBox())!;
    const title = (await dialog.locator(".film-detail-title").boundingBox())!;
    expect(title.x + title.width).toBeLessThanOrEqual(close.x);
  } else {
    expect(box.height).toBeLessThan(viewport.height * 0.85 - 40);
    await expect(grip).toBeHidden();
  }
});
