import { test, expect } from "@playwright/test";

test("film row space toggles details without changing the title layout; links stay independent", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.goto("/");
  const title = page.getByRole("button", { name: "Fixture Classic A", exact: true });
  const row = page.locator(".film-row").filter({ has: title });
  await expect(title).toBeVisible();
  const before = await title.boundingBox();
  await row.locator(".title-column").click({ position: { x: 2, y: 2 } });
  await expect(title).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("region", { name: "Screenings for Fixture Classic A" }),
  ).toBeVisible();
  const after = await title.boundingBox();
  expect(after).toEqual(before);
  await row.locator(".title-column").click({ position: { x: 2, y: 2 } });
  await expect(title).toHaveAttribute("aria-expanded", "false");
  await title.focus();
  await title.press("Enter");
  await expect(title).toHaveAttribute("aria-expanded", "true");
  await title.press("Space");
  await expect(title).toHaveAttribute("aria-expanded", "false");
  await row.locator(".director-column a").first().click();
  await expect(page).toHaveURL(/director=director-a/);
  await expect(page.locator(".film-row.is-expanded")).toHaveCount(0);
});

test("filter selection keeps trigger dimensions and table position, with red active states", async ({
  page,
}, info) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.goto("/");
  const mobile = info.project.name === "mobile";
  const trigger = mobile
    ? page.locator(".mobile-filters button").filter({ hasText: /^When/ })
    : page.locator(".when-picker > summary");
  const before = await trigger.boundingBox();
  const tableBefore = await page.locator(".film-table").boundingBox();
  await trigger.click();
  const picker = mobile
    ? page.getByRole("dialog", { name: "Filters", exact: true })
    : page.locator(".when-content");
  const selected = picker.getByRole("button", { name: /^Today / });
  await selected.click();
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  expect(await selected.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    "rgb(139, 36, 52)",
  );
  if (mobile) await picker.getByRole("button", { name: "Close filters", exact: true }).click();
  else await page.keyboard.press("Escape");
  expect(await trigger.boundingBox()).toEqual(before);
  const tableAfter = await page.locator(".film-table").boundingBox();
  expect(tableAfter?.y).toBe(tableBefore?.y);
  const controls = mobile
    ? page.locator(".mobile-filters button, .watchlists-trigger, .all-filters")
    : page.locator(
        ".desktop-filters > .when-picker > summary, .desktop-filters > .filter-controls > .filter-fields > .filter-picker > summary, .watchlists-trigger, .all-filters",
      );
  const sizes = await controls.evaluateAll((elements) =>
    elements.map((e) => ({
      height: e.getBoundingClientRect().height,
      font: getComputedStyle(e).fontSize,
    })),
  );
  expect(new Set(sizes.map((s) => s.height)).size).toBe(1);
  expect(new Set(sizes.map((s) => s.font)).size).toBe(1);
  await expect(page.getByRole("button", { name: "Tonight", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
