import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
const evidence = join(homedir(), ".Codex/london-cine-info/events-radar/verification");
test.use({ video: "on" });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/image.tmdb.org/**", (route) =>
    route.fulfill({ status: 200, body: "", contentType: "image/png" }),
  );
});
test("Radar preserves full lists and collapse controls independently restore on return", async ({
  page,
}, info) => {
  await page.route("**/films.*.json", async (route) => {
    const films = await (await route.fetch()).json();
    const base = films.find((film: { id: string }) => film.id === "classic-a");
    await route.fulfill({
      json: Array.from({ length: 12 }, (_, index) => ({
        ...base,
        id: `full-${index}`,
        ti: `Full list ${index}`,
        sc: base.sc.slice(0, 2),
      })),
    });
  });
  await page.route("**/meta.*.json", async (route) => {
    const meta = await (await route.fetch()).json();
    meta.counts.films = 12;
    await route.fulfill({ json: meta });
  });
  await page.goto("/radar");
  const film = page.getByRole("region", { name: "On film", exact: true });
  const imax = page.getByRole("region", { name: "IMAX", exact: true });
  const limited = page.getByRole("region", { name: "Limited opportunity", exact: true });
  await expect(film.locator(".film-row")).toHaveCount(12);
  await expect(limited.locator(".film-row")).toHaveCount(12);
  const toggle = film.getByRole("button", { name: /On film.*12 films/ });
  await toggle.focus();
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#radar-film")).toBeHidden();
  await mkdir(evidence, { recursive: true });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement)?.blur();
  });
  await page.screenshot({
    path: join(evidence, `collapsed-radar-${info.project.name}.png`),
    fullPage: true,
  });
  await expect(limited.locator(".film-row").first()).toBeVisible();
  await expect(imax.getByRole("button", { name: /IMAX.*0 films/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await toggle.press("Space");
  await expect(page.locator("#radar-film")).toBeVisible();
  await expect(film.locator(".film-row")).toHaveCount(12);
  await film.getByLabel("Film format").selectOption("70mm");
  await expect(film.locator(".film-row")).toHaveCount(0);
  await expect(limited.locator(".film-row")).toHaveCount(12);
  await film.getByLabel("Film format").selectOption("");
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir(evidence, { recursive: true });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement)?.blur();
  });
  await page.screenshot({
    path: join(evidence, `full-radar-${info.project.name}.png`),
    fullPage: true,
  });
});
test("Events agenda has immediate booking, date/type filters and calendar actions", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  let showtimeRequests = 0;
  await page.route("**/showtimes.*/*.json", async (route) => {
    showtimeRequests++;
    await route.continue();
  });
  await page.goto("/events");
  await expect(page.locator(".event-row")).toHaveCount(2);
  await expect(page.locator(".filter-summary > [role=status]")).toContainText("2 events");
  await expect(page.locator(".event-row").first()).toContainText("14:00");
  await expect(page.locator(".event-row").first()).toContainText("Prince Charles Cinema");
  await expect(page.getByRole("link", { name: /^Book/ }).first()).toBeVisible();
  expect(showtimeRequests).toBe(0);
  await page.getByLabel("Event type", { exact: true }).selectOption("score");
  await expect(page.locator(".event-row")).toHaveCount(1);
  await expect(page.locator(".filter-summary > [role=status]")).toContainText("1 event");
  await page.reload();
  await expect(page.getByLabel("Event type", { exact: true })).toHaveValue("score");
  await page.getByRole("button", { name: "Add to calendar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add to calendar", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Film details", exact: true }).click();
  await expect(page.locator(".film-expanded")).toBeVisible();
  await expect(page.locator(".showtime-day")).toHaveCount(1);
  expect(showtimeRequests).toBe(1);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({
    path: join(evidence, `events-details-${info.project.name}.png`),
    fullPage: true,
  });
  await page.goto("/events?day=2026-10-04&eventType=score");
  await expect(
    page.getByRole("heading", { name: "No events match these filters", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: join(evidence, `events-empty-${info.project.name}.png`),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.locator(".event-row")).toHaveCount(2);
  await page.route("**/events.*.json", async (route) => {
    const rows = await (await route.fetch()).json();
    rows[0].title = rows[0].eventTitle =
      "A long cinema programme title with a special introduction and questions from the audience ".repeat(
        4,
      );
    rows[0].filmId = "unmatched-programme";
    await route.fulfill({ json: rows });
  });
  await page.reload();
  await expect(page.locator(".event-row")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: join(evidence, `events-long-title-${info.project.name}.png`),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("event index failures show a retryable error instead of an empty agenda", async ({ page }) => {
  let fail = true;
  await page.route("**/events.*.json", (route) =>
    fail ? route.fulfill({ status: 503, body: "Unavailable" }) : route.continue(),
  );
  await page.goto("/events");
  await expect(
    page.getByRole("heading", { name: "The programme could not be loaded" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "No events match these filters" })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".event-row")).toHaveCount(2);
});

test("format sections overlap legitimately and expanded bookings stay screening-specific", async ({
  page,
}) => {
  await page.route("**/meta.*.json", async (route) => {
    const meta = await (await route.fetch()).json();
    meta.counts.films = 3;
    meta.facets.format = ["standard", "35mm", "70mm", "imax", "imax-70mm"].map((id) => ({
      id,
      label: id,
      count: 3,
    }));
    await route.fulfill({ json: meta });
  });
  await page.route("**/films.*.json", async (route) => {
    const films = await (await route.fetch()).json();
    const base = films.find((film: { id: string }) => film.id === "classic-a");
    await route.fulfill({
      json: [
        { ...base, id: "digital", ti: "Generic IMAX", sc: [[0, 840, 0, 8, 0, 0, 0, 780, null]] },
        {
          ...base,
          id: "combined",
          ti: "IMAX 70mm overlap",
          sc: [[0, 840, 0, 16, 0, 0, 0, 780, null]],
        },
        {
          ...base,
          sc: [
            [0, 840, 0, 2, 0, 0, 0, 780, null],
            [1, 840, 0, 8, 0, 0, 0, 2220, null],
          ],
        },
      ],
    });
  });
  await page.route("**/showtimes.*/classic-a.json", async (route) => {
    const data = await (await route.fetch()).json();
    const base = data.days["2026-10-03"][0];
    data.days = {
      "2026-10-03": [
        {
          ...base,
          time: Date.parse("2026-10-03T13:00:00Z"),
          localTime: "14:00",
          formats: ["35mm"],
        },
      ],
      "2026-10-04": [
        {
          ...base,
          time: Date.parse("2026-10-04T13:00:00Z"),
          localTime: "14:00",
          formats: ["imax"],
        },
      ],
    };
    await route.fulfill({ json: data });
  });
  await page.goto("/radar");
  const film = page.getByRole("region", { name: "On film", exact: true });
  const imax = page.getByRole("region", { name: "IMAX", exact: true });
  await expect(film.locator(".film-row")).toHaveCount(2);
  await expect(imax.locator(".film-row")).toHaveCount(3);
  await expect(film.locator(".film-row").filter({ hasText: "Generic IMAX" })).toHaveCount(0);
  await film.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(film.locator(".showtime-day")).toHaveCount(1);
  await expect(film.locator(".showtime-day")).toContainText("35mm");
  await imax.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(imax.locator(".showtime-day")).toHaveCount(1);
  await expect(imax.locator(".showtime-day")).toContainText("imax");
  await expect(imax.locator(".showtime-day")).not.toContainText("35mm");
  await film.getByLabel("Film format").selectOption("70mm");
  await expect(film.locator(".film-row")).toHaveCount(1);
  await expect(imax.locator(".film-row")).toHaveCount(3);
  await page.goto("/radar?day=2026-10-04");
  await expect(film.locator(".film-row")).toHaveCount(0);
  await expect(imax.locator(".film-row")).toHaveCount(1);
});

test("Radar tolerates corrupt and unavailable local storage", async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      return key === "radar-collapsed" ? '{"invalid":true}' : get.call(this, key);
    };
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "radar-collapsed") throw new Error("Storage unavailable");
      set.call(this, key, value);
    };
  });
  await page.goto("/radar");
  const toggle = page
    .getByRole("region", { name: "On film", exact: true })
    .getByRole("button", { name: /On film.*1 film/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#radar-film .film-row")).toHaveCount(1);
});
