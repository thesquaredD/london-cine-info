import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
});
async function enable(page: Page) {
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: /^Quick filters/ }).click();
  await page
    .locator(page.viewportSize()!.width < 800 ? ".quick-filter-dialog" : ".quick-filters-desktop")
    .getByRole("button", { name: "My cinemas", exact: true })
    .click();
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: /^Show \d/ }).click();
  await page.getByRole("button", { name: "Edit cinemas", exact: true }).click();
  return page.getByRole("dialog", { name: "Manage my cinemas", exact: true });
}
async function login(page: Page, email: string) {
  const response = await page.request.post("/api/auth/request", {
    data: { email },
    headers: { Origin: "http://localhost:4174" },
  });
  const { link } = await response.json();
  await page.request.post("/api/auth/verify", {
    data: { token: new URL(link).searchParams.get("token") },
    headers: { Origin: "http://localhost:4174" },
  });
}
test("guest search, distance, dismissal and contextual editing preserve selections", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Edit cinemas", exact: true })).toBeHidden();
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: /^Quick filters/ }).click();
  const quick = page.locator(
    page.viewportSize()!.width < 800 ? ".quick-filter-dialog" : ".quick-filters-desktop",
  );
  await quick.getByRole("button", { name: /^Tomorrow/ }).click();
  await quick.getByRole("button", { name: /^Evening/ }).click();
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: /^Show \d/ }).click();
  const prior = new URL(page.url()).searchParams;
  const dialog = await enable(page);
  await expect(dialog.getByRole("button", { name: "Done", exact: true })).toBeInViewport();
  const searchBox = await dialog.getByLabel("Find cinemas", { exact: true }).boundingBox();
  const firstResult = await dialog.locator(".favourite-options label").first().boundingBox();
  expect(firstResult!.y - (searchBox!.y + searchBox!.height)).toBeLessThan(110);
  await dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }).check();
  await dialog.getByLabel("Find cinemas", { exact: true }).fill("Prince");
  await expect(
    dialog.getByRole("button", { name: "Remove BFI Southbank", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }).check();
  await dialog.getByLabel("Find cinemas", { exact: true }).fill("");
  await page.route("https://api.postcodes.io/**", (route) =>
    route.fulfill({ json: { result: { latitude: 51.5074, longitude: -0.1278 } } }),
  );
  await dialog.getByRole("button", { name: /^Near me/ }).click();
  await dialog.getByLabel("Your postcode").fill("SW1A 2AA");
  await dialog.getByRole("button", { name: "Find location", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /^Near SW1A/ })).toBeVisible();
  await dialog.getByLabel("Radius", { exact: true }).selectOption("1");
  await expect(dialog.getByRole("heading", { name: "Selected cinemas · 2" })).toBeVisible();
  await dialog.getByLabel("Find cinemas", { exact: true }).fill("no-such-cinema");
  await expect(dialog.getByText("No listed cinemas match these filters.")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Selected cinemas · 2" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(new URL(page.url()).searchParams.getAll("day")).toEqual(prior.getAll("day"));
  expect(new URL(page.url()).searchParams.getAll("time")).toEqual(prior.getAll("time"));
  await expect(page.getByRole("button", { name: "Edit cinemas", exact: true })).toBeFocused();
  await page.reload();
  await enable(page);
  await expect(dialog.getByRole("heading", { name: "Selected cinemas · 2" })).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
test("serialized rapid edits survive dismissal, failure, background focus and conflict", async ({
  page,
}, info) => {
  await login(page, `rapid-${info.project.name}-${Date.now()}@example.com`);
  await page.goto("/");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route("**/api/cinemas", async (route) => {
    if (route.request().method() === "PUT" && ++writes === 1) await held;
    await route.continue();
  });
  const dialog = await enable(page);
  const bfi = dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true });
  await bfi.check();
  await bfi.uncheck();
  await bfi.check();
  await dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }).check();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".cinema-context")).toContainText("Saving…");
  release();
  await expect(page.locator(".cinema-context")).toContainText("Saved");
  expect(writes).toBe(2);
  await page.unroute("**/api/cinemas");
  await page.getByRole("button", { name: "Edit cinemas", exact: true }).click();
  await page.route("**/api/cinemas", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 503, json: { error: "Offline test" } })
      : route.continue(),
  );
  await bfi.uncheck();
  await expect(dialog.getByRole("alert")).toContainText("Offline test");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(bfi).not.toBeChecked();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit cinemas", exact: true }).click();
  await expect(bfi).not.toBeChecked();
  await page.unroute("**/api/cinemas");
  await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(dialog.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  await page.route("**/api/cinemas", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 409, json: { error: "Another device changed cinemas" } })
      : route.continue(),
  );
  await bfi.check();
  await expect(
    dialog.getByRole("button", { name: "Use saved choices", exact: true }),
  ).toBeVisible();
  await expect(bfi).toBeChecked();
  await page.unroute("**/api/cinemas");
  await dialog.getByRole("button", { name: "Use saved choices", exact: true }).click();
  await expect(bfi).not.toBeChecked();
});
test("blocked guest storage retains choices and never reports Saved", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Blocked");
    };
  });
  await page.goto("/");
  const dialog = await enable(page);
  await dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }).check();
  await expect(dialog.getByRole("alert")).toContainText("Browser storage is unavailable");
  await expect(dialog.getByRole("status").filter({ hasText: /^Saved$/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit cinemas", exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true })).toBeChecked();
});

test("an old pending response cannot expose account favourites after sign-out", async ({
  page,
}, info) => {
  await login(page, `identity-${info.project.name}-${Date.now()}@example.com`);
  await page.goto("/");
  const dialog = await enable(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/api/cinemas", async (route) => {
    if (route.request().method() === "PUT") {
      requested();
      await held;
    }
    await route.continue();
  });
  await dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }).check();
  await requestStarted;
  await page.request.post("/api/auth/logout", {
    data: {},
    headers: { Origin: "http://localhost:4174" },
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(dialog).toBeHidden();
  const response = page.waitForResponse(
    (response) => response.url().endsWith("/api/cinemas") && response.request().method() === "PUT",
  );
  release();
  await response;
  await enable(page);
  await expect(
    dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }),
  ).not.toBeChecked();
  await page.unroute("**/api/cinemas");
  await dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }).check();
  await expect(dialog.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }),
  ).not.toBeChecked();
});

test("postcode failures, denied location and borough filters keep selected cinemas", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (_ok: unknown, failure: (value: unknown) => void) =>
          failure({ code: 1 }),
      },
    });
  });
  await page.goto("/");
  const dialog = await enable(page);
  await dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }).check();
  await dialog.getByRole("button", { name: /^Near me/ }).click();
  await dialog.getByRole("button", { name: "Use my location", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Location permission was denied");
  await page.route("https://api.postcodes.io/**", (route) =>
    route.fulfill({ status: 404, json: { error: "Invalid postcode" } }),
  );
  await dialog.getByLabel("Your postcode").fill("INVALID");
  await dialog.getByRole("button", { name: "Find location", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Enter a valid UK postcode");
  await dialog.getByText("Borough · All", { exact: true }).click();
  await dialog.locator(".borough-options input").last().check();
  await expect(
    dialog.getByRole("button", { name: "Remove BFI Southbank", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Selected cinemas · 1" })).toBeVisible();
});

test("compact cinema tools dismiss without closing the chooser", async ({ page }) => {
  await page.goto("/");
  const dialog = await enable(page);
  const near = dialog.getByRole("button", { name: /^Near me/ });
  await near.click();
  await expect(dialog.getByLabel("Your postcode")).toBeVisible();
  const triggerBox = await near.boundingBox();
  const panelBox = await dialog.locator("#cinema-location-panel").boundingBox();
  expect(panelBox!.y - (triggerBox!.y + triggerBox!.height)).toBeLessThanOrEqual(8);
  expect(panelBox!.x).toBeGreaterThanOrEqual((await dialog.boundingBox())!.x);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(near).toBeFocused();
  await expect(dialog.getByLabel("Your postcode")).toBeHidden();
  await dialog.getByText("Borough · All", { exact: true }).click();
  await expect(dialog.locator(".borough-options")).toBeVisible();
  await dialog.getByLabel("Find cinemas", { exact: true }).click();
  await expect(dialog.locator(".borough-options")).toBeHidden();
  await expect(dialog.getByRole("button", { name: "Done", exact: true })).toBeInViewport();
});

test("dropdowns stay attached to their buttons when the toolbar wraps", async ({ page }) => {
  await page.goto("/");
  const dialog = await enable(page);
  await page.route("https://api.postcodes.io/**", (route) =>
    route.fulfill({ json: { result: { latitude: 51.5074, longitude: -0.1278 } } }),
  );
  await dialog.getByRole("button", { name: /^Near me/ }).click();
  await dialog.getByLabel("Your postcode").fill("SW1A 2AA");
  await dialog.getByRole("button", { name: "Find location", exact: true }).click();
  const near = dialog.getByRole("button", { name: /^Near SW1A/ });
  await expect(near).toBeVisible();
  for (const width of [320, 390, 1200]) {
    await page.setViewportSize({ width, height: 900 });
    await near.click();
    const trigger = await near.boundingBox();
    const panel = await dialog.locator("#cinema-location-panel").boundingBox();
    expect(panel!.y - trigger!.y - trigger!.height).toBeCloseTo(4, 0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(
      (await dialog.boundingBox())!.x + (await dialog.boundingBox())!.width,
    );
    await page.keyboard.press("Escape");
    const borough = dialog.locator(".cinema-borough-control summary");
    await borough.click();
    const boroughButton = await borough.boundingBox();
    const boroughPanel = await dialog
      .locator(".cinema-borough-control .cinema-tool-panel")
      .boundingBox();
    expect(boroughPanel!.y - boroughButton!.y - boroughButton!.height).toBeCloseTo(4, 0);
    await page.keyboard.press("Escape");
  }
});
