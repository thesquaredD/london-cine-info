import { test, expect } from "@playwright/test";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
test.use({ video: "on" });
const evidenceDirectory = process.env.CI
  ? "test-results/discovery-screenshots"
  : join(homedir(), ".Codex/london-cine-info/discovery/verification");
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/image.tmdb.org/**", (route) =>
    route.fulfill({ status: 404, body: "No fixture image" }),
  );
});
async function when(page: import("@playwright/test").Page) {
  if (page.viewportSize()!.width < 800) {
    await page.locator(".mobile-filters").getByRole("button", { name: /^When/ }).click();
    return page.locator('.filter-sheet [data-filter="day"]');
  }
  await page.locator(".when-picker > summary").click();
  return page.locator('.when-picker [data-filter="day"]');
}
test("calendar keyboard, separate dates and exclusion preserve shared URLs", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const picker = await when(page);
  const day = picker.locator('.calendar-grid [data-date="2026-10-03"]');
  await day.focus();
  await day.press("ArrowRight");
  const next = picker.locator('.calendar-grid [data-date="2026-10-04"]');
  await expect(next).toBeFocused();
  await next.press("Space");
  await day.click();
  expect(new URL(page.url()).searchParams.getAll("day")).toEqual(["2026-10-04", "2026-10-03"]);
  await picker.getByRole("button", { name: "Exclude options", exact: true }).click();
  await picker.locator('.calendar-grid [data-date="2026-10-05"]').click();
  expect(new URL(page.url()).searchParams.getAll("not_day")).toEqual(["2026-10-05"]);
  await picker.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(picker.locator(".calendar-heading")).toContainText("November 2026");
  await picker.getByRole("button", { name: "Previous month", exact: true }).click();
  const evidence = evidenceDirectory;
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: join(evidence, `calendar-${testInfo.project.name}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
test("Tonight leaves no hidden time constraint, runtime recovery has an accurate count", async ({
  page,
}) => {
  await page.goto("/?genre=drama");
  const quick = page.locator(".quick-days");
  await quick.getByRole("button", { name: "Tonight", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("from")).toBe("18:00");
  await quick.getByRole("button", { name: /^Tomorrow/ }).click();
  expect(new URL(page.url()).searchParams.get("from")).toBeNull();
  expect(new URL(page.url()).searchParams.get("tonight")).toBeNull();
  expect(new URL(page.url()).searchParams.getAll("genre")).toEqual(["drama"]);
  await page.goto("/?q=Fixture%20Classic%20A&short=1");
  const recovery = page.getByRole("button", {
    name: "Remove the runtime limit · 3 films",
    exact: true,
  });
  await expect(recovery).toBeVisible();
  await recovery.click();
  await expect(page.locator(".film-row")).toHaveCount(3);
  expect(new URL(page.url()).searchParams.get("q")).toBe("Fixture Classic A");
});
test("guest favourites survive reload, filter concrete venues and stay separate from filtering", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  const quick = page.locator(".quick-days");
  await quick.getByRole("button", { name: "My cinemas", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Manage my cinemas", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }).check();
  await dialog.getByRole("button", { name: "Save my cinemas", exact: true }).click();
  await expect(page.locator(".film-row")).toHaveCount(6);
  await quick.getByRole("button", { name: "My cinemas", exact: true }).click();
  expect(new URL(page.url()).searchParams.getAll("venue")).toEqual(["bfi.org.uk-southbank"]);
  await expect(page.locator(".film-row")).toHaveCount(2);
  await page.reload();
  await quick.getByRole("button", { name: "Manage my cinemas", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true })).toBeChecked();
  await dialog.getByRole("button", { name: "Close manage my cinemas", exact: true }).click();
  await expect(quick.getByRole("button", { name: "Manage my cinemas", exact: true })).toBeFocused();
});
test("Radar shows explicit formats and global counts, themes fit 390px", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/radar");
  await expect(
    page.getByRole("heading", { name: "Limited opportunity", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Special formats", exact: true })).toBeVisible();
  const special = page.getByRole("region", { name: "Special formats", exact: true });
  await expect(special.locator(".film-row")).toHaveCount(1);
  await special.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(special.locator(".showtime-day")).toHaveCount(1);
  await expect(special.locator(".showtime-day")).toContainText("35mm");
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme as "light" | "dark" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    const directory = evidenceDirectory;
    await mkdir(directory, { recursive: true });
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      (document.activeElement as HTMLElement)?.blur();
    });
    await page.screenshot({
      path: join(directory, `radar-${testInfo.project.name}-${theme}.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("Radar expires screenings and relative Today moves at London midnight without reload", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-03T22:58:50Z") });
  const baseline = Date.parse("2026-10-03T00:00:00Z");
  await page.route("**/films.*.json", async (route) => {
    const data = await (await route.fetch()).json();
    const film = {
      ...data[0],
      sc: [
        [0, 1439, 0, 0, 0, 0, 0, (Date.parse("2026-10-03T22:59:00Z") - baseline) / 60000],
        [1, 1, 0, 0, 0, 0, 0, (Date.parse("2026-10-03T23:01:00Z") - baseline) / 60000],
      ],
    };
    await route.fulfill({ json: [film] });
  });
  await page.route("**/meta.*.json", async (route) => {
    const meta = await (await route.fetch()).json();
    meta.counts.films = 1;
    meta.screeningEpoch = baseline;
    meta.facets.day = ["2026-10-03", "2026-10-04"].map((id) => ({ id, label: id, count: 1 }));
    await route.fulfill({ json: meta });
  });
  await page.goto("/radar?day=today");
  const limited = page.getByRole("region", { name: "Limited opportunity", exact: true });
  await expect(limited.locator(".radar-label")).toContainText("Only 2 screenings listed");
  await page.clock.fastForward(15001);
  await expect(limited.locator(".film-row")).toHaveCount(0);
  await page.clock.fastForward(105000);
  await expect(limited.locator(".radar-label")).toContainText(
    "Only 1 screening listed · 2026-10-04",
  );
  await expect(page).toHaveURL(/radar\?day=today/);
});
