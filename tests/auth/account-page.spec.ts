import { test, expect, type Page } from "@playwright/test";

const origin = "http://localhost:4174";
async function signIn(page: Page, suffix: string) {
  const email = `account-page-${suffix}-${Date.now()}@example.com`;
  const sent = await page.request.post("/api/auth/request", {
    data: { email },
    headers: { Origin: origin, "CF-Connecting-IP": email },
  });
  expect(sent.ok()).toBe(true);
  const { link } = await sent.json();
  const verified = await page.request.post("/api/auth/verify", {
    data: { token: new URL(link).searchParams.get("token") },
    headers: { Origin: origin },
  });
  expect(verified.ok()).toBe(true);
  return email;
}
async function sidebar(page: Page) {
  if (page.viewportSize()!.width < 800) {
    await page.getByRole("button", { name: "Toggle pages", exact: true }).click();
    return page.getByRole("dialog", { name: "Pages", exact: true });
  }
  return page.locator(".desktop-sidebar");
}

test("Account navigation, browser favourites and sidebar sign out", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: info.project.name === "mobile" ? 390 : 1280, height: 900 });
  await page.goto("/account");
  const guest = page.getByRole("article", { name: "Sign in", exact: true });
  await expect(guest.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(guest.getByRole("region", { name: "Favourite cinemas", exact: true })).toContainText(
    "Chosen for this browser",
  );
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath(`signed-out-${info.project.name}.png`),
    fullPage: true,
  });
  let nav = await sidebar(page);
  await expect(nav.locator(".preferences-nav")).not.toContainText("Sign in");
  await expect(
    nav
      .locator(".sidebar-bottom .sidebar-auth")
      .getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    await nav.locator(".sidebar-bottom").evaluate((node) => node.firstElementChild?.className),
  ).toBe("sidebar-auth");
  await expect(nav.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.screenshot({
    path: info.outputPath(`auth-footer-signed-out-${info.project.name}.png`),
  });
  if (info.project.name === "mobile")
    await nav.getByRole("link", { name: "Sign in", exact: true }).click();
  const email = await signIn(page, info.project.name);
  await page.reload();
  const account = page.getByRole("article", { name: "Account", exact: true });
  await expect(account).toContainText(`Signed in as ${email}`);
  await expect(account.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  expect(
    await account
      .locator(":scope > section[id]")
      .evaluateAll((nodes) => nodes.map((node) => node.id)),
  ).toEqual(["profile", "watchlist", "emails", "cinemas", "delete"]);
  await expect(account.getByRole("heading", { name: "Account", exact: true })).toBeFocused();
  await expect(page).toHaveTitle("Account — London Ciné Info");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const fields = account.locator(".profile-fields > .pref-field");
  const app = (await fields.nth(0).boundingBox())!;
  const lb = (await fields.nth(1).boundingBox())!;
  if (info.project.name === "mobile") {
    expect(lb.y).toBeGreaterThanOrEqual(app.y + app.height);
    expect(lb.x).toBe(app.x);
  } else expect(lb.y).toBe(app.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath(`signed-in-${info.project.name}.png`),
    fullPage: true,
  });
  nav = await sidebar(page);
  await expect(nav.getByRole("link", { name: "Account", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    nav.locator(".preferences-nav").getByRole("link", { name: "Account", exact: true }),
  ).toBeVisible();
  await expect(
    nav.locator(".preferences-nav").getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(0);
  await expect(
    nav
      .locator(".sidebar-bottom .sidebar-auth")
      .getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath(`auth-footer-signed-in-${info.project.name}.png`),
  });
  await nav.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".page-notices")).toContainText("You are signed out.");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("email and Privacy section links focus the requested section", async ({ page }, info) => {
  await signIn(page, `anchors-${info.project.name}`);
  await page.goto("/account#emails");
  await expect(page.locator("#emails")).toBeFocused();
  const bounds = (await page.locator("#emails").boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeLessThan(page.viewportSize()!.height);
  await page.evaluate(() => {
    location.hash = "profile";
  });
  await expect(page.locator("#profile")).toBeFocused();
  await page.goto("/privacy");
  await page.getByRole("link", { name: "username", exact: true }).click();
  await expect(page).toHaveURL("/account#profile");
  await expect(page.locator("#profile")).toBeFocused();
  await page.goto("/privacy");
  await page.getByRole("link", { name: "email preferences", exact: true }).click();
  await expect(page).toHaveURL("/account#emails");
  await expect(page.locator("#emails")).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL("/privacy");
  await page.goForward();
  await expect(page.locator("#emails")).toBeFocused();
});

test("Profile and Emails issue partial saves and retain drafts across a failed first endpoint", async ({
  page,
}, info) => {
  await signIn(page, `saves-${info.project.name}`);
  await page.goto("/account");
  const account = page.getByRole("article", { name: "Account", exact: true });
  const profile = account.getByRole("region", { name: "Profile", exact: true });
  const emails = account.getByRole("region", { name: "Emails", exact: true });
  const updates: { path: string; body: unknown }[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      ["/api/me", "/api/friends/profile"].includes(new URL(request.url()).pathname)
    )
      updates.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() });
  });
  await profile
    .getByLabel("App username", { exact: true })
    .fill(`page_${info.project.name}_${Date.now()}`);
  await profile.getByLabel("Letterboxd username", { exact: true }).fill("sample-list");
  await emails.getByLabel("Weekly screening email", { exact: true }).selectOption("3");
  await expect(profile.getByRole("status")).toHaveText("Unsaved changes");
  await page.route("**/api/friends/profile", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 503, json: { error: "Profile unavailable. Please retry." } })
      : route.fallback(),
  );
  await profile.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(profile.getByRole("alert")).toContainText("Profile unavailable");
  await expect(profile.getByRole("alert")).toHaveCount(1);
  await expect(profile.locator(".notice-title")).toHaveText("That action didn't finish");
  expect(updates.map((update) => update.path)).toEqual(["/api/friends/profile"]);
  await expect(profile.getByLabel("Letterboxd username", { exact: true })).toHaveValue(
    "sample-list",
  );
  await expect(emails.getByLabel("Weekly screening email", { exact: true })).toHaveValue("3");
  await page.unroute("**/api/friends/profile");
  await page.route("**/api/me", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 503,
          json: { error: "Letterboxd settings unavailable. Please retry." },
        })
      : route.fallback(),
  );
  updates.length = 0;
  await profile.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(profile.getByRole("alert")).toContainText("Letterboxd settings unavailable");
  expect(updates.map((update) => update.path)).toEqual(["/api/friends/profile", "/api/me"]);
  await expect(profile.getByLabel("Letterboxd username", { exact: true })).toHaveValue(
    "sample-list",
  );
  await expect(profile.getByRole("button", { name: "Save profile", exact: true })).toBeEnabled();
  await expect(emails.getByLabel("Weekly screening email", { exact: true })).toHaveValue("3");
  await page.unroute("**/api/me");
  updates.length = 0;
  await profile.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(profile.getByRole("status").filter({ hasText: "Profile saved." })).toBeVisible();
  expect(updates).toEqual([{ path: "/api/me", body: { username: "sample-list" } }]);
  await expect(
    profile.getByRole("status").filter({ hasText: /^No unsaved changes$/ }),
  ).toBeVisible();
  await expect(
    account.getByRole("button", { name: "Import watchlist", exact: true }),
  ).toBeEnabled();
  await expect(emails.getByLabel("Weekly screening email", { exact: true })).toHaveValue("3");
  await emails.getByLabel("Include films in common with friends", { exact: true }).uncheck();
  updates.length = 0;
  await emails.getByRole("button", { name: "Save emails", exact: true }).click();
  await expect(
    emails.getByRole("status").filter({ hasText: "Email preferences saved." }),
  ).toBeVisible();
  expect(updates).toEqual([
    { path: "/api/me", body: { digestWeekday: 3 } },
    { path: "/api/friends/profile", body: { friendsDigest: false } },
  ]);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.reload();
  await expect(emails.getByLabel("Weekly screening email", { exact: true })).toHaveValue("3");
  await expect(
    emails.getByLabel("Include films in common with friends", { exact: true }),
  ).not.toBeChecked();
  const saved = await (await page.request.get("/api/friends")).json();
  expect(saved.appUsername).toMatch(/^page_/);
  const nav = await sidebar(page);
  await nav.getByRole("link", { name: "Friends", exact: true }).click();
  const friends = page.getByRole("article", { name: "Friends", exact: true });
  await expect(friends).toContainText(`You are @${saved.appUsername}`);
  await expect(friends.getByLabel("Your app username", { exact: true })).toHaveCount(0);
  await friends
    .getByRole("region", { name: "Add a friend", exact: true })
    .getByLabel("App username", { exact: true })
    .fill("another_friend");
  await expect(friends.getByRole("button", { name: "Send request", exact: true })).toBeEnabled();
});

test("Delete confirmation is inline, restores focus on cancel and leaves a notice on completion", async ({
  page,
}, info) => {
  await signIn(page, `delete-${info.project.name}`);
  await page.goto("/account");
  const deletion = page.getByRole("region", { name: "Delete account", exact: true });
  await deletion.getByRole("button", { name: "Delete account…", exact: true }).click();
  await expect(deletion.locator("p[tabindex]")).toBeFocused();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await deletion.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    deletion.getByRole("button", { name: "Delete account…", exact: true }),
  ).toBeFocused();
  await deletion.getByRole("button", { name: "Delete account…", exact: true }).click();
  await deletion.getByRole("button", { name: "Confirm deletion", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".page-notices")).toContainText(
    "Your account and watchlist were deleted.",
  );
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect((await (await page.request.get("/api/me")).json()).user).toBeNull();
});
