import { test, expect, type Page } from "@playwright/test";

// The preview build has no analytics, so the form offers email instead of sending.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
});
async function revealContext(page: Page) {
  const summary = page.locator(".feedback-dialog summary");
  if (await summary.isVisible()) await summary.click();
}
async function openFromHeader(page: Page) {
  await page.locator(".masthead").getByRole("button", { name: "Share feedback" }).click();
  return page.getByRole("dialog", { name: "Share feedback" });
}

test("the header opens one form that keeps its draft and offers email when it cannot send", async ({
  page,
}) => {
  const posthog: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("works.london-cine.info")) posthog.push(request.url());
  });
  await page.goto("/?q=private-search");
  await expect(page.locator(".empty-state")).toBeVisible();
  const dialog = await openFromHeader(page);
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
  await expect(page.locator(".masthead .feedback-entry")).toBeFocused();
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

  // Linked by its anchor so newer entries cannot push it past the first page.
  await page.goto("/changelog#whats-new");
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

test("a collapsed desktop sidebar keeps Feedback reachable in the header", async ({ page }) => {
  test.skip(page.viewportSize()!.width < 800, "desktop only");
  await page.goto("/");
  await page.getByRole("button", { name: /^Toggle pages/ }).click();
  await openFromHeader(page);
  await expect(page.getByRole("dialog", { name: "Share feedback" })).toBeVisible();
});

test("phones keep Feedback in the masthead without an extra row", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 800, "phone only");
  await page.goto("/");
  const entry = page.locator(".masthead").getByRole("button", { name: "Share feedback" });
  expect((await entry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await entry.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".feedback-entry")).toHaveCount(1);
  const header = await page.locator(".masthead").boundingBox();
  const filters = await page.locator(".filter-bar").boundingBox();
  expect(filters!.y).toBeLessThanOrEqual(header!.y + header!.height + 1);
  await entry.click();
  await expect(page.getByRole("dialog", { name: "Share feedback" })).toBeVisible();
});

test("feedback begins with the message and optional topics toggle off", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const dialog = await openFromHeader(page);
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

test("empty results can clear one group while keeping the other filters", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?day=2026-10-20&venue=bfi.org.uk-southbank&genre=drama");
  const empty = page.locator(".empty-state");
  await expect(empty).toHaveCount(1);
  await expect(empty.getByRole("heading")).toContainText("BFI Southbank");
  await expect(empty.getByRole("button", { name: "Any day", exact: true })).toBeVisible();
  await expect(empty.getByRole("button", { name: "Any cinema", exact: true })).toBeVisible();
  if (page.viewportSize()!.width < 800)
    for (const button of await empty.getByRole("button").all())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: info.outputPath("empty-results.png") });
  await empty.getByRole("button", { name: "Any day", exact: true }).click();
  const url = new URL(page.url());
  expect(url.searchParams.getAll("day")).toEqual([]);
  expect(url.searchParams.getAll("venue")).toEqual(["bfi.org.uk-southbank"]);
  expect(url.searchParams.getAll("genre")).toEqual(["drama"]);
  await expect(page.locator(".film-row").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("sign-in benefits read as a list", async ({ page }, info) => {
  await page.goto("/account");
  const benefits = page.getByRole("region", { name: "With an account" });
  await expect(benefits.getByRole("listitem")).toHaveCount(3);
  await expect(benefits).toContainText("No password, no account needed to browse.");
  await page.screenshot({ path: info.outputPath("sign-in-benefits.png"), fullPage: true });
});

test("empty-result labels use director names and Any time clears the whole time group", async ({
  page,
}) => {
  await page.goto("/?director=director-a&day=2026-10-20");
  await expect(page.locator(".empty-state p").first()).toContainText("Director: director a");
  await expect(page.locator(".empty-state p").first()).not.toContainText("director-a");
  await page.goto("/?time=morning&from=18%3A00&to=19%3A00&venue=bfi.org.uk-southbank");
  await page.getByRole("button", { name: "Any time", exact: true }).click();
  const url = new URL(page.url());
  expect(url.searchParams.getAll("time")).toEqual([]);
  expect(url.searchParams.has("from")).toBe(false);
  expect(url.searchParams.has("to")).toBe(false);
  expect(url.searchParams.getAll("venue")).toEqual(["bfi.org.uk-southbank"]);
  await expect(page.locator(".film-row").first()).toBeVisible();
});
