import { test, expect } from "@playwright/test";

test.use({ video: "on" });
test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
});
test("Privacy identifies the operator, explains current data practices and keeps Account links", async ({
  page,
}, info) => {
  await page.goto("/privacy");
  const policy = page.getByRole("article", { name: "Privacy", exact: true });
  await expect(policy.getByRole("heading", { name: "Privacy", exact: true })).toBeFocused();
  await expect(policy.locator("#operator")).toContainText("Diogo Diogo");
  await expect(policy.locator("#operator a")).toHaveAttribute(
    "href",
    "mailto:diogo.seabra.diogo@gmail.com",
  );
  for (const id of [
    "information",
    "purposes",
    "storage",
    "analytics",
    "sharing",
    "retention",
    "security",
    "rights",
    "changes",
  ])
    await expect(policy.locator(`#${id}`)).toHaveCount(1);
  await expect(policy).toContainText("15 minutes");
  await expect(policy).toContainText("90 days");
  await expect(policy).toContainText("up to one hour");
  await expect(policy).toContainText(
    "does not automatically delete separately collected analytics",
  );
  await expect(
    policy.getByRole("link", { name: "Information Commissioner’s Office", exact: true }),
  ).toHaveAttribute("href", "https://ico.org.uk/make-a-complaint/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`privacy-top-${info.project.name}.png`) });
  await page.screenshot({
    path: info.outputPath(`privacy-${info.project.name}.png`),
    fullPage: true,
  });
  await policy.getByRole("link", { name: "username", exact: true }).click();
  await expect(page).toHaveURL("/account#profile");
  await expect(page.getByRole("article", { name: "Sign in", exact: true })).toBeVisible();
  await page.goto("/privacy");
  if (page.viewportSize()!.width < 700)
    await policy.getByText("On this page", { exact: true }).click();
  await policy
    .getByRole("navigation", { name: "Privacy policy sections", exact: true })
    .getByRole("link", { name: "Your rights", exact: true })
    .click();
  await expect(page).toHaveURL("/privacy#rights");
  await expect(policy.locator("#rights")).toBeFocused();
  await policy.getByRole("link", { name: "email preferences", exact: true }).click();
  await expect(page).toHaveURL("/account#emails");
});
test("privacy choice persists and blocked storage reports a visit-only choice", async ({
  page,
}) => {
  await page.goto("/privacy#analytics");
  const choice = page.getByRole("checkbox", {
    name: "Allow site analytics in this browser",
    exact: true,
  });
  await expect(choice).toBeChecked();
  await choice.uncheck();
  await expect(page.getByRole("status").filter({ hasText: "Site analytics is off" })).toBeVisible();
  await page.reload();
  await expect(choice).not.toBeChecked();
  await choice.check();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "london-cine.analytics-disabled.v1") throw new Error("Storage blocked");
      original.call(this, key, value);
    };
  });
  await choice.uncheck();
  await expect(
    page.getByRole("status").filter({ hasText: "This analytics choice lasts only for this visit" }),
  ).toBeVisible();
  await expect(choice).not.toBeChecked();
});

test("Privacy summary, current section and storage table work at phone width", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/privacy");
  const summary = page.getByRole("complementary", { name: "In short" });
  await expect(summary.getByRole("listitem")).toHaveCount(4);
  await summary.getByRole("link", { name: "site analytics" }).click();
  await expect(page.locator("#analytics")).toBeFocused();
  await page.locator("#retention").evaluate((node) => node.scrollIntoView({ block: "start" }));
  await expect(page.locator('.prose-map a[href="#retention"]')).toHaveAttribute(
    "aria-current",
    "location",
  );
  if (page.viewportSize()!.width < 700) {
    const map = page.locator(".prose-map details");
    await expect(map.locator("summary")).toHaveText("On this page");
    await expect(map).not.toHaveAttribute("open", "");
    const scroll = page.getByRole("region", { name: "Browser storage", exact: true });
    expect(await scroll.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth)).toBe(true);
  await page.goto("/privacy");
  await page.screenshot({ path: info.outputPath("privacy-structured.png"), fullPage: true });
  await summary.getByRole("link", { name: "remove your account" }).click();
  await expect(page).toHaveURL("/account#delete");
  expect(errors).toEqual([]);
});
