import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/image.tmdb.org/**", (route) => route.fulfill({ status: 404 }));
});
function strip(page: Page) {
  return page.getByRole("group", { name: "Shortcuts" });
}

test("film links survive refresh and Back; compact details remain visible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await expect(page).toHaveURL(/film=classic-a/);
  const filmUrl = page.url();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share film", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(filmUrl);
  await page.reload();
  await expect(page.locator(".poster")).toBeVisible();
  await expect(page.locator(".film-facts")).toContainText("1977");
  await expect(page.locator(".booking-action").first()).toBeVisible();
  await expect(page.locator(".film-about")).not.toHaveAttribute("open", "");
  await page.getByText("More details", { exact: true }).click();
  await expect(page.locator(".film-synopsis")).toBeVisible();
  await strip(page)
    .getByRole("button", { name: /^Tomorrow/ })
    .click();
  await page.goBack();
  await expect(page).toHaveURL(filmUrl);
  await expect(page.locator(".expanded-row")).toHaveCount(1);
});

test("Nearby applies temporary cinemas without replacing saved choices", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "london-cine.cinemas.v1",
      JSON.stringify({
        browserId: "00000000-0000-4000-8000-000000000000",
        venues: ["bfi.org.uk"],
      }),
    ),
  );
  await page.route("https://api.postcodes.io/postcodes/**", (route) =>
    route.fulfill({
      json: { result: { latitude: 51.5074, longitude: -0.1278 } },
    }),
  );
  await page.goto("/");
  await strip(page).getByRole("button", { name: "My cinemas", exact: true }).click();
  await page.reload();
  await expect(
    strip(page).getByRole("button", { name: "My cinemas", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const saved = await page.evaluate(() => localStorage.getItem("london-cine.cinemas.v1"));
  await page.getByRole("button", { name: "Near me", exact: true }).click();
  const nearby = page.getByRole("dialog", { name: "Find nearby cinemas", exact: true });
  await nearby.getByPlaceholder("e.g. SW1A 2AA").fill("SW1A 2AA");
  await nearby.getByRole("button", { name: "Find location", exact: true }).click();
  const apply = nearby.getByRole("button", { name: "Show films at these cinemas", exact: true });
  await expect(apply).toBeEnabled();
  await apply.click();
  expect(new URL(page.url()).searchParams.getAll("venue").length).toBeGreaterThan(0);
  expect(new URL(page.url()).searchParams.has("cinemas")).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("london-cine.cinemas.v1"))).toBe(saved);
});

test("guest planning intersects two public lists without an account or friend request", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route("**/api/watchlists/public", (route) => {
    const { username } = route.request().postDataJSON();
    requests.push(username);
    return route.fulfill({
      json: { username, page: 1, pages: 1, count: 1, slugs: ["fixture"] },
    });
  });
  await page.goto("/");
  if (page.viewportSize()!.width < 800) await page.locator(".menu-button").click();
  await page
    .getByRole("button", { name: /^Friends/ })
    .filter({ visible: true })
    .click();
  const plan = page.getByRole("dialog", { name: "Find a film together", exact: true });
  await plan.getByPlaceholder("e.g. alex_films").fill("alex_films");
  await plan.getByPlaceholder("e.g. zoe_films").fill("zoe_films");
  await plan.getByRole("button", { name: "Find films in common", exact: true }).click();
  await expect(plan).toBeHidden();
  expect(requests).toEqual(["alex_films", "zoe_films"]);
  await expect(page.locator(".film-row")).toHaveCount(1);
  await expect(page.locator(".film-row")).toContainText("Fixture Classic A");
});
