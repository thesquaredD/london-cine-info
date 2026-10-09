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
    const picker = page.locator('.filter-sheet [data-filter="day"]');
    await expect(picker.locator(":scope > summary")).toBeFocused();
    return picker;
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
  const excluded = picker.locator('.calendar-grid [data-date="2026-10-05"]');
  await expect(excluded).toHaveText("5");
  const colours = await next.evaluate((node) => {
    const selected = getComputedStyle(node);
    return {
      background: selected.backgroundColor,
      foreground: selected.color,
    };
  });
  expect(colours.background).toBe("rgb(139, 36, 52)");
  expect(colours.background).not.toBe(colours.foreground);
  await picker.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(picker.locator(".calendar-heading")).toContainText("November 2026");
  await picker.getByRole("button", { name: "Previous month", exact: true }).click();
  const evidence = evidenceDirectory;
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: join(evidence, `calendar-${testInfo.project.name}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
test("Legacy Tonight links leave no hidden time constraint, runtime recovery has an accurate count", async ({
  page,
}) => {
  await page.goto("/?genre=drama&tonight=1&from=18%3A00");
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: /^Quick filters/ }).click();
  const quick = page.locator(".quick-days");
  await expect(page.getByRole("button", { name: "Tonight", exact: true })).toHaveCount(0);
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
test("guest favourites use Account management and missing cinemas offer setup", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  const mobile = page.viewportSize()!.width < 800;
  if (mobile) await page.getByRole("button", { name: /^Quick filters/ }).click();
  const quick = page.locator(".quick-days");
  await expect(quick.getByRole("button", { name: "Manage my cinemas", exact: true })).toHaveCount(
    0,
  );
  await quick.getByRole("button", { name: "My cinemas", exact: true }).click();
  if (mobile)
    await page
      .getByRole("dialog", { name: "Quick filters", exact: true })
      .getByRole("button", { name: /^Show/ })
      .click();
  await expect(page.getByRole("heading", { name: "Set up my cinemas", exact: true })).toBeVisible();
  await expect(page.locator(".film-row")).toHaveCount(0);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.getByRole("button", { name: "Set up my cinemas", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Manage my cinemas", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }).check();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".film-row")).toHaveCount(2);
  expect(new URL(page.url()).searchParams.getAll("venue")).toEqual(["bfi.org.uk-southbank"]);
  await page.reload();
  if (mobile) {
    await page.getByRole("button", { name: "Toggle pages" }).click();
    await page
      .getByRole("dialog", { name: "Pages", exact: true })
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
  } else await page.locator(".desktop-sidebar .account-panel button").click();
  const account = page.locator(".account-dialog");
  await account.getByRole("button", { name: "Manage my cinemas", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true })).toBeChecked();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Close manage my cinemas", exact: true }).click();
  await expect(account).toBeVisible();
});
test("Radar shows explicit formats and global counts, themes fit 390px", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/radar");
  await expect(page.getByRole("heading", { name: /Limited opportunity/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /On film/ })).toBeVisible();
  const special = page.getByRole("region", { name: "On film", exact: true });
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
    "Only 1 screening listed · 4 October 2026",
  );
  await expect(page).toHaveURL(/radar\?day=today/);
});

test("mobile quick filters collapse into one button and sheet restores keyboard focus", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.goto("/");
  const opener = page.getByRole("button", { name: /^Quick filters/ });
  await expect(opener).toBeVisible();
  await expect(page.getByRole("button", { name: "Tonight", exact: true })).toHaveCount(0);
  await opener.click();
  const sheet = page.getByRole("dialog", { name: "Quick filters", exact: true });
  await expect(sheet).toBeVisible();
  expect(await page.locator("dialog[open]").count()).toBe(1);
  await page.screenshot({ path: join(evidenceDirectory, "quick-filters-mobile-sheet.png") });
  await sheet.getByRole("button", { name: /^Tomorrow/ }).click();
  await sheet.getByRole("button", { name: /^Show/ }).click();
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: join(evidenceDirectory, "quick-filters-mobile-collapsed.png") });
});

test("This week and Next week choose adjacent rolling seven-day windows", async ({ page }) => {
  const baseline = Date.parse("2026-10-03T00:00:00Z");
  await page.route("**/films.*.json", async (route) => {
    const films = await (await route.fetch()).json();
    await route.fulfill({
      json: [0, 6, 7, 13, 14].map((offset) => ({
        ...films[0],
        id: `window-${offset}`,
        ti: `Window day ${offset}`,
        sc: [[offset, 840, 0, 0, 0, 0, 0, offset * 1440 + 780]],
      })),
    });
  });
  await page.route("**/meta.*.json", async (route) => {
    const meta = await (await route.fetch()).json();
    meta.screeningEpoch = baseline;
    meta.counts.films = 5;
    meta.facets.day = Array.from({ length: 15 }, (_, offset) => {
      const id = new Date(baseline + offset * 86400000).toISOString().slice(0, 10);
      return { id, label: id, count: 1 };
    });
    await route.fulfill({ json: meta });
  });
  await page.goto("/");
  const mobile = page.viewportSize()!.width < 800;
  if (mobile) await page.getByRole("button", { name: /^Quick filters/ }).click();
  const quick = page.locator(".quick-days");
  await quick.getByRole("button", { name: /^This week(?:\s|$)/ }).click();
  if (mobile)
    await page
      .getByRole("dialog", { name: "Quick filters", exact: true })
      .getByRole("button", { name: /^Show/ })
      .click();
  await expect(page.locator(".film-row")).toHaveCount(2);
  await expect(page.locator(".film-row").filter({ hasText: "Window day 0" })).toHaveCount(1);
  await expect(page.locator(".film-row").filter({ hasText: "Window day 6" })).toHaveCount(1);
  if (mobile) await page.getByRole("button", { name: /^Quick filters/ }).click();
  await quick.getByRole("button", { name: /^Next week/ }).click();
  if (mobile)
    await page
      .getByRole("dialog", { name: "Quick filters", exact: true })
      .getByRole("button", { name: /^Show/ })
      .click();
  await expect(page.locator(".film-row")).toHaveCount(2);
  await expect(page.locator(".film-row").filter({ hasText: "Window day 7" })).toHaveCount(1);
  await expect(page.locator(".film-row").filter({ hasText: "Window day 13" })).toHaveCount(1);
});

test("opening motion preserves reduced-motion preference and never blocks film interaction", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(page.locator(".film-expanded")).toBeVisible();
  await expect(page.locator(".film-expanded")).toHaveCSS("animation-name", "none");
  await page
    .getByRole("button", { name: /^Add to calendar:/ })
    .first()
    .click();
  const calendar = page.getByRole("dialog", { name: "Add to calendar", exact: true });
  await expect(calendar).toBeVisible();
  await expect(calendar).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
  await expect(calendar).toBeHidden();
  if (page.viewportSize()!.width < 800) {
    await page.getByRole("button", { name: "Toggle pages" }).click();
    const drawer = page.getByRole("dialog", { name: "Pages", exact: true });
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS("animation-name", "none");
    await drawer.getByRole("link", { name: "Classics", exact: true }).click();
  } else
    await page
      .locator(".desktop-sidebar")
      .getByRole("link", { name: "Classics", exact: true })
      .click();
  await expect(page).toHaveURL(/\/classics/);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("Evening quick filter preserves dates, shares its URL, and toggles off", async ({ page }) => {
  await page.goto("/?day=2026-10-04&genre=drama&from=09:00&to=12:00");
  const mobile = page.viewportSize()!.width < 800;
  if (mobile) await page.getByRole("button", { name: /^Quick filters/ }).click();
  const button = page
    .locator(".quick-days")
    .filter({ visible: true })
    .getByRole("button", { name: /^Evening/ });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  let url = new URL(page.url());
  expect(url.searchParams.getAll("time")).toEqual(["evening"]);
  expect(url.searchParams.getAll("day")).toEqual(["2026-10-04"]);
  expect(url.searchParams.getAll("genre")).toEqual(["drama"]);
  expect(url.searchParams.has("from")).toBe(false);
  expect(url.searchParams.has("to")).toBe(false);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  url = new URL(page.url());
  expect(url.searchParams.getAll("time")).toEqual([]);
  expect(url.searchParams.getAll("day")).toEqual(["2026-10-04"]);
  await button.click();
  await page.reload();
  if (mobile) await page.getByRole("button", { name: /^Quick filters/ }).click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  if (mobile)
    await page
      .getByRole("dialog", { name: "Quick filters", exact: true })
      .getByRole("button", { name: /^Show/ })
      .click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("mobile My cinemas keeps Clear all and the cinema context inside the results toolbar", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "london-cine.cinemas.v1",
      JSON.stringify({
        browserId: "12345678-1234-1234-1234-123456789abc",
        venues: ["bfi.org.uk-southbank"],
      }),
    );
  });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 390, 799]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.getByRole("button", { name: /^Quick filters/ }).click();
      const dialog = page.getByRole("dialog", { name: "Quick filters", exact: true });
      await dialog.getByRole("button", { name: "My cinemas", exact: true }).click();
      await dialog.getByRole("button", { name: /^Show/ }).click();
      await expect(page.locator(".cinema-context")).toContainText("My cinemas · 1 selected");
      const chips = page.locator(".active-filters");
      const clear = chips.getByRole("button", { name: "Clear all", exact: true });
      await expect(clear).toBeVisible();
      const clipping = await chips.boundingBox();
      const bounds = await clear.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(clipping!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(clipping!.x + clipping!.width);
      for (const control of [
        page.locator(".quick-filters-mobile"),
        page.locator(".result-status"),
        page.locator(".cinema-context"),
      ]) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      await clear.click();
      await expect(page.locator(".cinema-context")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Edit cinemas", exact: true })).toHaveCount(0);
    }
  }
});
