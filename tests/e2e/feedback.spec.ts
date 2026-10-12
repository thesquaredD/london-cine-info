import { test, expect, type Page } from "@playwright/test";

// The preview build has no analytics, so the form offers email instead of sending.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
});
async function revealContext(page: Page) {
  const summary = page.locator(".feedback-dialog summary");
  if (await summary.isVisible()) await summary.click();
}
async function openFromMenu(page: Page) {
  if (page.viewportSize()!.width < 800) {
    await page.getByRole("button", { name: /^Toggle pages/ }).click();
    await page
      .getByRole("dialog", { name: "Pages", exact: true })
      .getByRole("button", { name: "Feedback" })
      .click();
  } else await page.locator(".desktop-sidebar").getByRole("button", { name: "Feedback" }).click();
  return page.getByRole("dialog", { name: "Share feedback" });
}

test("the menu opens one form that keeps its draft and offers email when it cannot send", async ({
  page,
}) => {
  const posthog: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("works.london-cine.info")) posthog.push(request.url());
  });
  await page.goto("/?q=private-search");
  await expect(page.locator(".empty-state")).toBeVisible();
  const dialog = await openFromMenu(page);
  await expect(dialog.getByRole("textbox", { name: "Your feedback" })).toBeFocused();
  await expect(page.getByRole("dialog", { name: "Pages", exact: true })).toBeHidden();
  await dialog
    .getByRole("textbox", { name: "Your feedback" })
    .fill("The Prince Charles is missing.");
  await expect(dialog.getByRole("status")).toHaveText(/isn’t available here/);
  await expect(dialog.getByRole("button", { name: "Send" })).toHaveCount(0);
  const mail = await dialog.getByRole("link", { name: "Email feedback" }).getAttribute("href");
  expect(decodeURIComponent(mail!)).toContain("The Prince Charles is missing.");
  expect(decodeURIComponent(mail!)).not.toContain("private-search");

  // Closing keeps the text for this visit; nothing is stored or sent.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }).includes("Prince Charles"),
    ),
  ).toBe(false);
  if (page.viewportSize()!.width < 800)
    await expect(page.getByRole("button", { name: /^Toggle pages/ })).toBeFocused();
  else await expect(page.locator(".desktop-sidebar .feedback-entry")).toBeFocused();
  await page.locator(".feedback-entry:visible").first().click();
  await expect(dialog.getByRole("textbox", { name: "Your feedback" })).toHaveValue(
    "The Prince Charles is missing.",
  );
  await revealContext(page);
  await expect(dialog.locator(".feedback-context")).toContainText(/Page\s*\//);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(posthog).toEqual([]);
});

test("film details report a listing problem with the film attached", async ({ page }) => {
  await page.goto("/");
  await page.locator(".film-title").first().click();
  await page.getByRole("button", { name: "Report a listing problem" }).click();
  const dialog = page.getByRole("dialog", { name: "Share feedback" });
  await expect(
    dialog.getByRole("button", { name: "Listing correction", pressed: true }),
  ).toBeVisible();
  await revealContext(page);
  await expect(dialog.locator(".feedback-context")).toContainText(/Film\s*classic-a/);
});

test("empty results and What’s new entries open feedback with their context", async ({ page }) => {
  await page.goto("/?q=zzzz-nothing");
  await page.getByRole("button", { name: "Missing something? Tell us" }).click();
  const dialog = page.getByRole("dialog", { name: "Share feedback" });
  await revealContext(page);
  await expect(dialog.locator(".feedback-context")).toContainText(/Results shown\s*0/);
  await page.keyboard.press("Escape");

  await page.goto("/changelog");
  await page.locator("#whats-new").getByRole("button", { name: "Feedback on this change" }).click();
  await revealContext(page);
  await expect(dialog.locator(".feedback-context")).toContainText(/Change\s*whats-new/);
});

test("a programme load failure can be reported next to the retry", async ({ page }) => {
  await page.route("**/data/films.*.json", (route) => route.fulfill({ status: 503 }));
  await page.goto("/");
  const status = page.locator(".catalogue-status[role=alert]");
  await expect(status.getByRole("button", { name: "Try again" })).toBeVisible();
  await status.getByRole("button", { name: "Report this problem" }).click();
  const dialog = page.getByRole("dialog", { name: "Share feedback" });
  await revealContext(page);
  await expect(dialog.locator(".feedback-context")).toContainText(/Error\s*catalogue_load/);
});

test("a collapsed desktop sidebar keeps Feedback reachable in the footer", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 800, "desktop only");
  await page.goto("/");
  await page.getByRole("button", { name: /^Toggle pages/ }).click();
  await page.locator(".source-footer").getByRole("button", { name: "Feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Share feedback" })).toBeVisible();
});

test("phones get a Feedback action under the masthead", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 800, "phone only");
  await page.goto("/");
  const entry = page.locator(".feedback-phone-row").getByRole("button", { name: "Feedback" });
  expect((await entry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await entry.click();
  await expect(page.getByRole("dialog", { name: "Share feedback" })).toBeVisible();
});

test("feedback begins with the message and optional topics toggle off", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const dialog = await openFromMenu(page);
  await expect(dialog.getByRole("textbox", { name: "Your feedback" })).toBeFocused();
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Idea", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Idea", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog.getByRole("button", { name: "Idea", exact: true }).click();
  await expect(dialog.locator('.feedback-topics [aria-pressed="true"]')).toHaveCount(0);
  await revealContext(page);
  for (const label of ["Page", "App version", "Screen", "Screening data"])
    await expect(dialog.locator(".feedback-context")).toContainText(label);
  if (page.viewportSize()!.width < 800)
    expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height * 0.9,
    );
  await page.screenshot({ path: info.outputPath("feedback-form.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
