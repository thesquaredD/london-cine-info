import { test, expect } from "@playwright/test";
test.use({ video: "on" });

test.describe("filter bar and mobile sheet", () => {
  test("primary cinema control toggles selections and closes accessibly", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await expect(page.locator(".film-row")).toHaveCount(6);
    const mobile = (page.viewportSize()?.width ?? 1200) < 800;
    const cinema = mobile
      ? page.getByRole("button", { name: /^Filters(?:[\s,]|$)/ })
      : page.locator(".desktop-filters summary").filter({ hasText: /^Cinema/ });
    await cinema.click();
    const picker = mobile
      ? page.getByRole("dialog", { name: "Filters", exact: true })
      : page.locator('.desktop-filters [data-filter="venue"]');
    if (mobile) await picker.locator('[data-filter="venue"] > summary').click();
    const choice = picker.getByRole("checkbox", { name: /BFI Southbank/ });
    await choice.click();
    await expect(choice).toBeChecked();
    await expect(page).toHaveURL(/venue=bfi\.org\.uk/);
    await choice.press("Space");
    await expect(choice).not.toBeChecked();
    await expect(page.locator(".film-row")).toHaveCount(6);
    await page.screenshot({ path: testInfo.outputPath("cinema-picker.png") });
    if (mobile) {
      expect(
        await picker
          .locator(".filter-options")
          .filter({ visible: true })
          .evaluate((element) => getComputedStyle(element).overflowY),
      ).toBe("visible");
      const done = picker.getByRole("button", { name: /Show 6 films/ });
      await expect(done).toBeInViewport();
      await done.click();
      await expect(picker).not.toBeVisible();
      await expect(cinema).toBeFocused();
      await page.getByRole("button", { name: /^Filters(?:[\s,]|$)/ }).click();
      await page.locator('.filter-sheet [data-filter="day"] > summary').click();
      await expect(page.locator('.filter-sheet [data-filter="day"]')).toHaveAttribute("open", "");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
      await expect(page.locator(".rating-cards")).toBeVisible();
      await expect(page.locator(".film-facts")).toContainText("1977");
    } else {
      await page.keyboard.press("Escape");
      await expect(picker).not.toHaveAttribute("open", "");
      await expect(page.locator("th:visible")).toHaveCount(7);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath("results.png") });
  });
});

test("filter bar and choosers fit phone, tablet and desktop widths", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  for (const width of [320, 390, 799, 800, 1000, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("th:visible")).toHaveCount(width < 800 ? 2 : 7);
    if (width >= 1100) {
      const cinema = page.locator('.desktop-filters [data-filter="venue"]');
      await cinema.locator("summary").click();
      const cinemaBox = await cinema.locator(".picker-content").boundingBox();
      expect(cinemaBox!.x).toBeGreaterThanOrEqual(0);
      expect(cinemaBox!.x + cinemaBox!.width).toBeLessThanOrEqual(width);
      await page.getByRole("heading", { name: "READOGRAPH LONDON" }).click();
      await expect(cinema).not.toHaveAttribute("open", "");
    }
    if (width < 1100) {
      await page.getByRole("button", { name: /^Filters(?:[\s,]|$)/ }).click();
      const sheet = page.getByRole("dialog", { name: "Filters", exact: true });
      await sheet.locator('[data-filter="venue"] > summary').click();
      await expect(sheet.getByRole("checkbox", { name: /BFI Southbank/ })).toBeVisible();
      await page.keyboard.press("Escape");
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Overflow at ${width}px`,
    ).toBe(true);
  }
});

test("page navigation keeps filters and marks the active page", async ({ page }, testInfo) => {
  await page.goto("/?q=Fixture");
  await expect(page.locator(".film-row")).toHaveCount(6);
  const mobile = (page.viewportSize()?.width ?? 1200) < 800;
  if (mobile) {
    const opener = page.getByRole("button", { name: "Toggle pages" });
    await opener.click();
    await expect(page.getByRole("dialog", { name: "Pages", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    await opener.click();
  }
  const navigation = page.getByRole("navigation", { name: "Film pages" }).filter({ visible: true });
  await navigation.getByRole("link", { name: "Retrospectives", exact: true }).click();
  await expect(page).toHaveURL(/retrospectives\?q=Fixture/);
  await expect(page.getByRole("dialog", { name: "Pages", exact: true })).not.toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue("Fixture");
  await expect(page.locator(".film-row")).toHaveCount(3);
  if (mobile) await page.getByRole("button", { name: "Toggle pages" }).click();
  await expect(
    navigation.getByRole("link", { name: "Retrospectives", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: testInfo.outputPath("page-navigation.png") });
});

test("Filters sheet groups every filter under When, Where and What with a pinned footer", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  await page.getByRole("button", { name: /^Filters(?:[\s,]|$)/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters", exact: true });
  for (const [group, filters] of [
    ["When", ["day", "time"]],
    ["Where", ["venue", "borough", "membership"]],
    ["What", ["genre", "format", "language", "year", "accessibility"]],
  ] as const) {
    const section = sheet.getByRole("region", { name: group, exact: true });
    await expect(section).toBeVisible();
    for (const key of filters)
      await expect(section.locator(`[data-filter="${key}"]`)).toHaveCount(1);
  }
  await expect(
    sheet.getByRole("region", { name: "What" }).getByRole("button", { name: /^Watchlists/ }),
  ).toBeVisible();
  await expect(sheet.getByRole("group", { name: "Only show" })).toBeVisible();
  await expect(sheet.getByRole("searchbox", { name: "Search", exact: true })).toBeVisible();
  for (const name of ["Hide sold-out screenings", "Under 2 hours"])
    await expect(sheet.getByRole("checkbox", { name, exact: true })).toBeVisible();
  const footer = sheet.locator(".sheet-footer");
  await expect(footer.getByRole("button", { name: "Reset all", exact: true })).toBeVisible();
  await expect(footer.getByRole("button", { name: /^Show 6 films$/ })).toBeVisible();
  if (info.project.name === "mobile") {
    await page.setViewportSize({ width: 390, height: 844 });
    await sheet.locator('[data-filter="venue"] > summary').click();
    const body = sheet.locator(".sheet-body");
    const before = (await footer.boundingBox())!;
    await body.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const after = (await footer.boundingBox())!;
    expect(after.y).toBe(before.y);
    expect(after.y + after.height).toBeLessThanOrEqual(844);
  } else {
    await page.setViewportSize({ width: 1280, height: 900 });
    const body = sheet.locator(".sheet-body");
    expect(await body.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(
      true,
    );
    const day = (await sheet.locator('[data-filter="day"]').boundingBox())!;
    const time = (await sheet.locator('[data-filter="time"]').boundingBox())!;
    expect(time.y).toBe(day.y);
    expect(time.x).toBeGreaterThan(day.x + day.width);
  }
});

test("desktop Filters button keeps its caret at the right edge when filters are active", async ({
  page,
}, info) => {
  test.skip(info.project.name === "mobile", "desktop control");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?short=1");
  const button = page.getByRole("button", { name: "Filters, 1 active", exact: true });
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  const caret = (await button.locator(".control-caret").boundingBox())!;
  const label = (await button.locator(".all-filters-label").boundingBox())!;
  const count = (await button.locator(".shortcut-count").boundingBox())!;
  expect(box.x + box.width - (caret.x + caret.width)).toBeLessThanOrEqual(16);
  expect(label.x - box.x).toBeLessThanOrEqual(16);
  expect(count.x).toBeGreaterThan(label.x + label.width);
  expect(caret.x).toBeGreaterThan(count.x + count.width - 1);
});
