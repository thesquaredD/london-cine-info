import { test, expect, type Page } from "@playwright/test";
type Event = { event: string; properties: Record<string, unknown> };
async function intercept(page: Page) {
  const events: Event[] = [];
  await page.context().route("https://works.london-cine.info/**", async (route) => {
    let body = route.request().postDataJSON();
    // Unload beacons use base64 form data to avoid a CORS preflight.
    if (typeof body?.data === "string")
      body = JSON.parse(Buffer.from(body.data, "base64").toString("utf8"));
    if (Array.isArray(body?.batch)) events.push(...body.batch);
    else if (Array.isArray(body)) events.push(...body);
    else if (body?.event) events.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"status":1}' });
  });
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/fixture.jpg", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    }),
  );
  return events;
}
test("captures settled searches, film and booking actions without replay or secrets", async ({
  page,
}) => {
  const events = await intercept(page);
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto("/?utm_source=verification&utm_campaign=synthetic&token=private-token");
  await expect(page.locator(".film-row")).toHaveCount(6);
  await expect.poll(() => events.filter((event) => event.event === "$pageview").length).toBe(1);
  await page.locator("#bar-search").fill("Titre B");
  await expect
    .poll(() => events.filter((event) => event.event === "search_performed").length)
    .toBe(1);
  expect(events.find((event) => event.event === "search_performed")?.properties).toMatchObject({
    query: "Titre B",
    result_count: 1,
  });
  // Clearing and retyping quickly only produces the final settled query.
  await page.locator("#bar-search").fill("not-in-catalogue");
  await expect
    .poll(() => events.filter((event) => event.event === "search_performed").length)
    .toBe(2);
  expect(
    events.filter((event) => event.event === "search_performed")[1]?.properties.result_count,
  ).toBe(0);
  await page.locator("#bar-search").fill("Titre B");
  await expect(page.locator(".film-row")).toHaveCount(1);
  await page.locator(".film-title").click();
  await expect(page.getByRole("region", { name: /Screenings for/ })).toBeVisible();
  await expect.poll(() => events.filter((event) => event.event === "film_opened").length).toBe(1);
  await page.route("https://tickets.example/**", (route) =>
    route.fulfill({ body: "Synthetic booking destination" }),
  );
  const link = page.locator(".screening-info a").first();
  await expect(link).toBeVisible();
  const popup = page.waitForEvent("popup");
  await link.click();
  const booking = await popup;
  await expect
    .poll(
      () =>
        events.filter((event) =>
          ["booking_clicked", "screening_details_clicked"].includes(event.event),
        ).length,
    )
    .toBe(1);
  await booking.close();
  expect(events.every((event) => event.properties.environment === "test")).toBe(true);
  expect(events.map((event) => event.event)).not.toContain("$snapshot");
  expect(events.map((event) => event.event)).not.toContain("$autocapture");
  expect(JSON.stringify(events)).not.toContain("private-token");
  expect(events[0]?.properties.source).toBe("verification");
  expect(consoleErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: test.info().outputPath("analytics-flow.png"), fullPage: true });
});
test("records filter results once and preserves a visitor across reloads", async ({ page }) => {
  const events = await intercept(page);
  await page.goto("/?genre=drama");
  await expect
    .poll(() => events.filter((event) => event.event === "filters_changed").length)
    .toBe(1);
  const original = events.find((event) => event.event === "$pageview")?.properties.distinct_id;
  await page.reload();
  await expect.poll(() => events.filter((event) => event.event === "$pageview").length).toBe(2);
  await expect
    .poll(() => events.filter((event) => event.event === "filters_changed").length)
    .toBe(2);
  expect(events.filter((event) => event.event === "$pageview")[1]?.properties.distinct_id).toBe(
    original,
  );
  await page.getByRole("button", { name: /Clear all/ }).click();
  await expect
    .poll(() => events.filter((event) => event.event === "filters_changed").length)
    .toBe(3);
  const cleared = events.filter((event) => event.event === "filters_changed").at(-1)!;
  expect(cleared.properties.filter_count).toBe(0);
});

test("measures PR 17 public imports and shared filters without usernames", async ({ page }) => {
  const events = await intercept(page);
  await page.route("**/api/watchlists/public", (route) =>
    route.fulfill({
      json: {
        username: "private_handle",
        page: 1,
        pages: 1,
        count: 1,
        slugs: ["synthetic-film"],
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  await page.getByRole("button", { name: /^Filters(?:\s|$)/ }).click();
  await page
    .getByRole("button", { name: /^Watchlists/ })
    .filter({ visible: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Watchlists", exact: true });
  await dialog.getByRole("button", { name: "+ Use a Letterboxd watchlist" }).click();
  await dialog.getByLabel("Letterboxd username", { exact: true }).fill("private_handle");
  await dialog.getByRole("button", { name: "Use watchlist", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("available for this session");
  await dialog.getByRole("button", { name: "Apply watchlists" }).click();
  await expect
    .poll(() => events.filter((event) => event.event === "shared_watchlists_used").length)
    .toBe(1);
  expect(
    events.find((event) => event.event === "public_watchlist_import_completed")?.properties
      .item_count,
  ).toBe(1);
  expect(
    events.find((event) => event.event === "shared_watchlists_used")?.properties,
  ).toMatchObject({
    public_watchlist_count: 1,
    selected_friend_count: 0,
    result_count: 0,
  });
  expect(JSON.stringify(events)).not.toContain("private_handle");
});

test("sends real Web Vitals and page-leave measurements through the proxy", async ({ page }) => {
  const directRequests: string[] = [];
  await page.route("https://*.posthog.com/**", async (route) => {
    directRequests.push(route.request().url());
    await route.abort();
  });
  const events = await intercept(page);
  await page.goto("/?token=private-token");
  await expect(page.locator(".film-row")).toHaveCount(6);
  await page.locator("#bar-search").fill("Titre B");
  await expect
    .poll(() => events.some((event) => event.event === "$web_vitals"), { timeout: 15000 })
    .toBe(true);
  const vitals = events.find((event) => event.event === "$web_vitals")!;
  expect(vitals.properties.$web_vitals_FCP_value).toEqual(expect.any(Number));
  expect(vitals.properties.$current_url).toBe("https://london-cine.info/");
  const view = events.find((event) => event.event === "$pageview")!;
  // Exercise the SDK's browser lifecycle handler while keeping the document alive
  // long enough for Playwright to intercept and acknowledge its unload beacon.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  await expect.poll(() => events.some((event) => event.event === "$pageleave")).toBe(true);
  const leave = events.find((event) => event.event === "$pageleave")!;
  expect(leave.properties.$prev_pageview_id).toBe(view.properties.$pageview_id);
  expect(leave.properties.$prev_pageview_duration).toBeGreaterThan(0);
  expect(leave.properties.$prev_pageview_max_scroll_percentage).toEqual(expect.any(Number));
  expect(leave.properties.$lib_custom_api_host).toBe("https://works.london-cine.info");
  expect(JSON.stringify(events)).not.toContain("private-token");
  expect(events.every((event) => event.properties.environment === "test")).toBe(true);
  expect(
    events.some((event) => event.event === "$snapshot" || event.event === "$autocapture"),
  ).toBe(false);
  expect(directRequests).toEqual([]);
});

test("account_opened tracks the page on direct load, sidebar navigation and history", async ({
  page,
}) => {
  const events = await intercept(page);
  await page.goto("/account");
  await expect
    .poll(() => events.filter((event) => event.event === "account_opened").length)
    .toBe(1);
  await page
    .getByRole("article", { name: "Sign in", exact: true })
    .getByLabel("Email", { exact: true })
    .fill("unsent@example.com");
  await page.goto("/");
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: "Toggle pages", exact: true }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL("/account");
  await expect
    .poll(() => events.filter((event) => event.event === "account_opened").length)
    .toBe(2);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.goBack();
  await page.goForward();
  await expect
    .poll(() => events.filter((event) => event.event === "account_opened").length)
    .toBe(3);
  const accountViews = events.filter((event) => event.event === "account_opened");
  for (const view of accountViews)
    expect(view.properties).toMatchObject({
      path: "/account",
      $pathname: "/account",
      $current_url: "https://london-cine.info/account",
    });
  expect(
    events.filter((event) => event.event === "$pageview").map((event) => event.properties.path),
  ).toEqual(["/account", "/", "/account", "/", "/account"]);
  expect(JSON.stringify(events)).not.toContain("unsent@example.com");
});

test("Friends page navigation records its path without sending usernames or section anchors", async ({
  page,
}) => {
  const events = await intercept(page);
  await page.goto("/friends#requests");
  await expect(page.getByRole("article", { name: "Friends", exact: true })).toBeVisible();
  await expect.poll(() => events.filter((event) => event.event === "$pageview").length).toBe(1);
  const view = events.find((event) => event.event === "$pageview")!;
  expect(view.properties).toMatchObject({
    path: "/friends",
    $pathname: "/friends",
    $current_url: "https://london-cine.info/friends",
  });
  await page.getByLabel("Your Letterboxd username", { exact: true }).fill("private_watchlist");
  await page
    .getByRole("article", { name: "Friends", exact: true })
    .getByRole("link", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL("/account");
  await expect.poll(() => events.filter((event) => event.event === "$pageview").length).toBe(2);
  expect(
    events.filter((event) => event.event === "$pageview").map((event) => event.properties.path),
  ).toEqual(["/friends", "/account"]);
  expect(JSON.stringify(events)).not.toContain("private_watchlist");
  expect(JSON.stringify(events)).not.toContain("#requests");
});

test("Settings records its page path and preview changes emit no film-open event", async ({
  page,
}) => {
  const events = await intercept(page);
  await page.goto("/settings#preview");
  const settings = page.getByRole("article", { name: "Settings", exact: true });
  await expect(settings.locator(".pref-preview .film-row")).toHaveCount(1);
  await expect.poll(() => events.filter((event) => event.event === "$pageview").length).toBe(1);
  expect(events.find((event) => event.event === "$pageview")!.properties).toMatchObject({
    path: "/settings",
    $pathname: "/settings",
    $current_url: "https://london-cine.info/settings",
  });
  await settings.getByLabel("Film titles").selectOption("original");
  await settings.getByRole("button", { name: "Move IMDb rating up" }).click();
  await page.locator(".masthead h1 a").click();
  await expect.poll(() => events.filter((event) => event.event === "$pageview").length).toBe(2);
  expect(
    events.filter((event) => event.event === "$pageview").map((event) => event.properties.path),
  ).toEqual(["/settings", "/"]);
  expect(events.map((event) => event.event)).not.toContain("film_opened");
  expect(JSON.stringify(events)).not.toContain("#preview");
});

test("privacy objection stops browser events and request analytics, survives reload and resumes on opt-in", async ({
  page,
  context,
}) => {
  const events = await intercept(page);
  await page.goto("/privacy#analytics");
  await expect.poll(() => events.filter((event) => event.event === "$pageview").length).toBe(1);
  const other = await context.newPage();
  await other.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await other.goto("/privacy#analytics");
  await expect.poll(() => events.filter((event) => event.event === "$pageview").length).toBe(2);
  const choice = page.getByRole("checkbox", {
    name: "Allow site analytics in this browser",
    exact: true,
  });
  await choice.uncheck();
  await expect(
    other.getByRole("checkbox", { name: "Allow site analytics in this browser", exact: true }),
  ).not.toBeChecked();
  const before = events.length;
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL("/account#emails");
  let enabled = "";
  await page.route("**/api/auth/request", (route) => {
    enabled = route.request().headers()["x-analytics-enabled"] ?? "";
    return route.fulfill({ json: { ok: true } });
  });
  await page.getByLabel("Email", { exact: true }).fill("privacy-test@example.com");
  await page.getByRole("button", { name: "Send sign-in link", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Check your email" })).toBeVisible();
  expect(enabled).toBe("0");
  await page.reload();
  await page.goto("/privacy#analytics");
  await expect(choice).not.toBeChecked();
  expect(events.length).toBe(before);
  await choice.check();
  await expect(
    other.getByRole("checkbox", { name: "Allow site analytics in this browser", exact: true }),
  ).toBeChecked();
  await page.locator(".masthead h1 a").click();
  await expect
    .poll(
      () =>
        events.filter((event) => event.event === "$pageview" && event.properties.path === "/")
          .length,
    )
    .toBe(1);
  await other.close();
});

test("Do Not Track prevents identifiers and makes the privacy choice read-only", async ({
  page,
}) => {
  const events = await intercept(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "1" }),
  );
  await page.goto("/privacy#analytics");
  const choice = page.getByRole("checkbox", {
    name: "Allow site analytics in this browser",
    exact: true,
  });
  await expect(choice).not.toBeChecked();
  await expect(choice).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Do Not Track" })).toBeVisible();
  await page.locator(".masthead h1 a").click();
  await expect(page.locator(".film-row")).toHaveCount(6);
  expect(events).toEqual([]);
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes("posthog"))),
  ).toEqual([]);
});
