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
      ? page.locator(".mobile-filters").getByRole("button", { name: /^Cinema/ })
      : page.locator(".desktop-filters summary").filter({ hasText: /^Cinema/ });
    await cinema.click();
    const picker = mobile
      ? page.getByRole("dialog", { name: "Filters", exact: true })
      : page.locator('.desktop-filters [data-filter="venue"]');
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
      await page.locator(".mobile-filters").getByRole("button", { name: /^When/ }).click();
      await expect(page.locator('.filter-sheet [data-filter="day"]')).toHaveAttribute("open", "");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
      await expect(page.locator(".rating-cards")).toBeVisible();
      await expect(page.locator(".poster figcaption")).toContainText("1977");
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
    if (width >= 800) {
      await page.locator(".when-picker > summary").click();
      await expect(page.locator('.when-picker [data-filter="day"]')).toHaveAttribute("open", "");
      const box = await page.locator(".when-content").boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
      const cinema = page.locator('.desktop-filters [data-filter="venue"]');
      await cinema.locator("summary").click();
      const cinemaBox = await cinema.locator(".picker-content").boundingBox();
      expect(cinemaBox!.x).toBeGreaterThanOrEqual(0);
      expect(cinemaBox!.x + cinemaBox!.width).toBeLessThanOrEqual(width);
      await page.getByRole("heading", { name: "LONDON CINÉ INFO" }).click();
      await expect(cinema).not.toHaveAttribute("open", "");
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
