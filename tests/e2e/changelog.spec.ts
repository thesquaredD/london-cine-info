import { test, expect, type Page } from "@playwright/test";
import type { ChangelogBundle } from "../../src/shared/changelog";

const bundle: ChangelogBundle = {
  revision: "f".repeat(40),
  entries: [
    ...Array.from({ length: 21 }, (_, index) => ({
      id: `change-${index + 1}`,
      type: "improved" as const,
      title: `Change ${index + 1}`,
      body: "A short note about what changed.",
      changeDate: index < 2 ? "2026-10-12" : "2026-10-01",
    })),
  ],
};
bundle.entries[0] = {
  ...bundle.entries[0]!,
  type: "added",
  href: "/settings",
  linkLabel: "Open Settings",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
});
async function sidebar(page: Page) {
  if (page.viewportSize()!.width < 800) {
    await page.getByRole("button", { name: /^Toggle pages/ }).click();
    return page.getByRole("dialog", { name: "Pages", exact: true });
  }
  return page.locator(".desktop-sidebar");
}

test("the built changelog is reachable from the menu and its links work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await (await sidebar(page)).getByRole("link", { name: "What’s new" }).click();
  await expect(page).toHaveURL("/changelog");
  await expect(page).toHaveTitle("What’s new — London Ciné Info");
  const article = page.getByRole("article", { name: "What’s new" });
  await expect(article.getByRole("heading", { name: "What’s new" })).toBeFocused();
  await expect(article.getByText("Preview · these notes are not necessarily live.")).toBeVisible();
  // The real build output: committed fragments, served beside the app.
  await expect(article.locator("#whats-new")).toContainText("See what has changed");
  await article.getByRole("link", { name: "Open Account →" }).click();
  await expect(page).toHaveURL("/account");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test("notes are grouped by change date, paginated and deep-linkable", async ({ page }) => {
  await page.route("**/changelog.json", (route) => route.fulfill({ json: bundle }));
  await page.goto("/changelog");
  const article = page.getByRole("article", { name: "What’s new" });
  await expect(article.getByRole("heading", { level: 3 })).toHaveText([
    "Change date: 12 October 2026",
    "Change date: 1 October 2026",
  ]);
  await expect(article.locator("#change-1")).toContainText("Added");
  await expect(article.locator(".changelog-entry")).toHaveCount(20);
  await article.getByRole("button", { name: "Show older changes" }).click();
  await expect(article.locator(".changelog-entry")).toHaveCount(21);
  await expect(article.getByRole("button", { name: "Show older changes" })).toHaveCount(0);

  await page.goto("/changelog#change-21");
  await expect(page.locator("#change-21")).toBeFocused();
  await expect(page.locator("#change-21")).toBeInViewport();
});

test("a failed load offers a retry", async ({ page }) => {
  let calls = 0;
  await page.route("**/changelog.json", (route) =>
    ++calls === 1 ? route.fulfill({ status: 503 }) : route.fulfill({ json: bundle }),
  );
  await page.goto("/changelog");
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#change-1")).toBeVisible();
});
