import { test, expect, type Page } from "@playwright/test";
import { IMPORT_ERRORS, type Account, type SyncStatus } from "../../src/shared/account";
const phone = (page: Page) => (page.viewportSize()?.width ?? 1200) < 800;
async function openAccount(page: Page) {
  if (phone(page)) {
    await page.getByRole("button", { name: "Toggle pages" }).click();
    await page
      .getByRole("dialog", { name: "Pages", exact: true })
      .getByRole("button", { name: /^(Sign in|Account)$/ })
      .click();
  } else await page.locator(".desktop-sidebar .account-panel button").click();
  const dialog = page.locator(".account-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}
const now = () => Math.floor(Date.now() / 1000);
function sync(state: SyncStatus["state"], extra: Partial<SyncStatus> = {}): SyncStatus {
  return {
    state,
    requestedAt: null,
    startedAt: null,
    completedAt: null,
    retryAt: null,
    error: null,
    ...extra,
  };
}
function user(overrides: Partial<Account> = {}): Account {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    email: "synthetic@example.com",
    username: "synthetic-user",
    digestWeekday: null,
    fetchedAt: null,
    count: 0,
    stale: false,
    pending: false,
    sync: sync("idle"),
    ...overrides,
  };
}
/** Controlled account API: no real sign-in, email, GitHub dispatch or Letterboxd request. */
async function mockAccount(page: Page, account: Account | null, slugs: string[] = []) {
  await page.unroute("**/api/me");
  await page.unroute("**/api/watchlist");
  await page.route("**/api/me", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { user: account } })
      : route.fallback(),
  );
  await page.route("**/api/watchlist", (route) =>
    route.fulfill({
      json: {
        slugs,
        fetchedAt: account?.fetchedAt ?? null,
        count: account?.count ?? 0,
        stale: account?.stale ?? false,
        username: account?.username ?? null,
        sync: account?.sync,
      },
    }),
  );
}
test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});
test("an expired or used sign-in link explains how to recover", async ({ page }) => {
  await page.goto(`/auth/verify?token=${"0".repeat(64)}`);
  await page.getByRole("button", { name: "Confirm sign-in" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "expired or was already used",
  );
  await expect(page).toHaveURL("/auth/verify");
  await page.goto("/auth/verify");
  await expect(page.getByRole("main").getByRole("status")).toContainText("This link is incomplete");
});
test("account service failures stay out of the way of browsing and can be retried", async ({
  page,
}) => {
  let failing = true;
  await page.route("**/api/me", (route) =>
    failing
      ? route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Bad gateway</h1>" })
      : route.fallback(),
  );
  await page.goto("/");
  await expect(page.locator(".film-row").first()).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.goto("/watchlist");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("unexpected response");
  await expect(alert).not.toContainText("Bad gateway");
  failing = false;
  await alert.getByRole("button", { name: "Try loading account again" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Sign in to import your public Letterboxd watchlist.")).toBeVisible();
});
test("import lifecycle states are honest on the watchlist page and in the dialog", async ({
  page,
}) => {
  const stamp = now() - 3600;
  await mockAccount(
    page,
    user({ pending: true, sync: sync("queued", { requestedAt: now(), retryAt: now() + 3600 }) }),
  );
  await page.goto("/watchlist");
  const status = page.locator(".watchlist-intro .import-status");
  await expect(status.getByRole("status")).toContainText("Import queued");
  await expect(status).not.toContainText("%");
  await expect(page.getByRole("button", { name: "Import in progress" })).toBeDisabled();
  // The compact sidebar entry point also announces a running import.
  if (phone(page)) {
    await page.getByRole("button", { name: "Toggle pages" }).click();
    const drawer = page.getByRole("dialog", { name: "Pages", exact: true });
    await expect(drawer.locator(".account-panel").getByRole("status")).toContainText(
      "Import queued",
    );
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  } else {
    await expect(page.locator(".desktop-sidebar .account-panel").getByRole("status")).toContainText(
      "Import queued",
    );
  }
  await mockAccount(
    page,
    user({ pending: true, sync: sync("importing", { requestedAt: now(), startedAt: now() }) }),
  );
  await page.reload();
  await expect(status.getByRole("status")).toContainText(
    "Importing your public Letterboxd watchlist",
  );
  // Failure keeps the last good list, names a safe cause and shows when retry opens.
  await mockAccount(
    page,
    user({
      fetchedAt: stamp,
      count: 2,
      stale: true,
      sync: sync("failed", {
        requestedAt: now(),
        retryAt: now() + 1800,
        error: IMPORT_ERRORS.not_found,
      }),
    }),
    ["invented-a", "invented-b"],
  );
  await page.reload();
  await expect(status.getByRole("alert")).toContainText(IMPORT_ERRORS.not_found);
  await expect(status).toContainText("Showing your last good watchlist");
  await expect(
    page.locator(".watchlist-intro").getByText(/Next import available after/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh now" })).toBeDisabled();
  let dialog = await openAccount(page);
  await expect(dialog.getByRole("alert")).toContainText(IMPORT_ERRORS.not_found);
  await expect(dialog.getByLabel("Letterboxd username")).toHaveValue("synthetic-user");
  await page.keyboard.press("Escape");
  // A stalled job is reported as failed, never as an endless refresh.
  await mockAccount(
    page,
    user({
      sync: sync("failed", { requestedAt: stamp, startedAt: stamp, error: IMPORT_ERRORS.stalled }),
    }),
  );
  await page.reload();
  await expect(status.getByRole("alert")).toContainText(IMPORT_ERRORS.stalled);
  await expect(page.getByRole("button", { name: "Import watchlist" })).toBeEnabled();
  // A genuinely empty public list is not an error.
  await mockAccount(
    page,
    user({ fetchedAt: stamp, count: 0, sync: sync("completed", { completedAt: stamp }) }),
  );
  await page.reload();
  await expect(status.getByRole("status")).toContainText(
    "0 of your 0 watchlist films are screening in London.",
  );
  await expect(status).toContainText("Your public watchlist is empty.");
  // A full list with no current London screenings is distinguished from an empty one.
  await mockAccount(
    page,
    user({ fetchedAt: stamp, count: 2, sync: sync("completed", { completedAt: stamp }) }),
    ["invented-a", "invented-b"],
  );
  await page.reload();
  await expect(status.getByRole("status")).toContainText(
    "0 of your 2 watchlist films are screening in London.",
  );
  await expect(status).toContainText(
    "None of your imported films currently have London screenings.",
  );
  await expect(page.locator(".film-row")).toHaveCount(0);
  // Overdue data is labelled when no import is running.
  await mockAccount(
    page,
    user({
      fetchedAt: stamp - 3 * 86400,
      count: 2,
      stale: true,
      sync: sync("completed", { completedAt: stamp - 3 * 86400 }),
    }),
    ["invented-a", "invented-b"],
  );
  await page.reload();
  await expect(status).toContainText("overdue for an update");
  dialog = await openAccount(page);
  await expect(dialog.getByRole("link", { name: "View your watchlist" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await dialog.evaluate((node) => node.getBoundingClientRect().width <= innerWidth)).toBe(
    true,
  );
});
test("save, cooldown and dispatch failures keep input, explain retry and never expose internals", async ({
  page,
}) => {
  await mockAccount(page, user({ username: null }));
  await page.route("**/api/me", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 503, json: { error: "Settings could not be saved right now." } })
      : route.fallback(),
  );
  await page.goto("/");
  let dialog = await openAccount(page);
  await dialog.getByLabel("Letterboxd username").fill("typed-user");
  await dialog.getByRole("button", { name: "Save account" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Settings could not be saved right now.");
  await expect(dialog.getByLabel("Letterboxd username")).toHaveValue("typed-user");
  await expect(dialog.getByRole("button", { name: "Save account" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator(".page-notices").getByRole("alert")).toContainText(
    "Settings could not be saved",
  );
  await page
    .locator(".page-notices")
    .getByRole("button", { name: "Dismiss account message" })
    .click();
  await expect(page.locator(".page-notices").getByRole("alert")).toHaveCount(0);
  // Cooldown from the server disables the import until the stated time.
  await mockAccount(page, user({ fetchedAt: now() - 600, count: 1 }), ["invented-a"]);
  await page.route("**/api/watchlist/refresh", (route) =>
    route.fulfill({
      status: 429,
      headers: { "Retry-After": "900" },
      json: { error: "Refresh is available once per hour" },
    }),
  );
  await page.goto("/watchlist");
  await page.getByRole("button", { name: "Refresh now" }).click();
  await expect(page.locator(".page-notices").getByRole("alert")).toContainText("once per hour");
  await expect(
    page.locator(".watchlist-intro").getByText(/Next import available after/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh now" })).toBeDisabled();
  await page
    .locator(".page-notices")
    .getByRole("button", { name: "Dismiss account message" })
    .click();
  // A failed dispatch is a visible, retryable failure.
  await page.unroute("**/api/watchlist/refresh");
  await page.route("**/api/watchlist/refresh", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: "The import could not be queued. You can retry now; daily sync will also try again.",
      },
    }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Refresh now" }).click();
  await expect(page.locator(".page-notices").getByRole("alert")).toContainText(
    "could not be queued",
  );
  await expect(page.getByRole("button", { name: "Refresh now" })).toBeEnabled();
  // Unexpected server payloads are never shown raw.
  await page.unroute("**/api/watchlist/refresh");
  await page.route("**/api/watchlist/refresh", (route) =>
    route.fulfill({
      status: 500,
      contentType: "text/plain",
      body: "TypeError: secret stack trace",
    }),
  );
  await page.getByRole("button", { name: "Dismiss account message" }).click();
  await page.getByRole("button", { name: "Refresh now" }).click();
  const alert = page.locator(".page-notices").getByRole("alert");
  await expect(alert).toContainText("unexpected response");
  await expect(alert).not.toContainText("stack trace");
  dialog = await openAccount(page);
  await expect(dialog).toHaveAccessibleName("Account");
  await expect(dialog.getByLabel("Letterboxd username")).toBeFocused();
});
