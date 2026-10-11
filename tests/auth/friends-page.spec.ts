import { test, expect, type Page } from "@playwright/test";

const origin = "http://localhost:4174";
const headers = { Origin: origin };
async function signIn(page: Page, name: string) {
  const email = `${name}-${Date.now()}@friends-page.test`;
  const sent = await page.request.post("/api/auth/request", {
    data: { email },
    headers: { ...headers, "CF-Connecting-IP": email },
  });
  expect(sent.ok()).toBe(true);
  const { link } = await sent.json();
  expect(
    (
      await page.request.post("/api/auth/verify", {
        data: { token: new URL(link).searchParams.get("token") },
        headers,
      })
    ).ok(),
  ).toBe(true);
}
async function sidebar(page: Page) {
  if (page.viewportSize()!.width < 800) {
    await page.getByRole("button", { name: /^Toggle pages/ }).click();
    return page.getByRole("dialog", { name: "Pages", exact: true });
  }
  return page.locator(".desktop-sidebar");
}

test("guest Friends is a page with comparison and a sign-in link", async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === "mobile" ? 390 : 1280, height: 900 });
  await page.goto("/friends");
  const friends = page.getByRole("article", { name: "Friends", exact: true });
  await expect(friends.getByRole("heading", { name: "Friends", exact: true })).toBeFocused();
  await expect(page).toHaveTitle("Friends — London Ciné Info");
  await expect(friends.locator(":scope > section")).toHaveCount(2);
  await expect(
    friends.getByRole("region", { name: "Find a film together", exact: true }),
  ).toBeVisible();
  await expect(
    friends.getByRole("region", { name: "Keep friends for next time", exact: true }),
  ).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath(`friends-signed-out-${info.project.name}.png`),
    fullPage: true,
  });
  const nav = await sidebar(page);
  await expect(nav.getByRole("link", { name: "Friends", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await nav.getByRole("link", { name: "Friends", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await friends.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/account");
  await expect(page.getByRole("article", { name: "Sign in", exact: true })).toBeVisible();
});

test("without an app username Friends sends profile setup to Account", async ({ page }, info) => {
  await signIn(page, `missing-${info.project.name}`);
  await page.goto("/friends");
  const friends = page.getByRole("article", { name: "Friends", exact: true });
  await expect(
    friends.getByRole("link", { name: "Choose a username in Account to add friends" }),
  ).toBeVisible();
  await expect(friends.locator("#add")).toHaveCount(0);
  await expect(friends.getByLabel("App username", { exact: true })).toHaveCount(0);
  await expect(
    friends.getByLabel("Include films in common with friends", { exact: true }),
  ).toHaveCount(0);
  await friends.getByRole("link", { name: "Choose a username in Account to add friends" }).click();
  await expect(page).toHaveURL("/account#profile");
  await expect(page.locator("#profile")).toBeFocused();
});

test("waiting requests reach navigation; accept and remove stay inline", async ({
  page,
  browser,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: info.project.name === "mobile" ? 390 : 1280, height: 900 });
  const owner = `host_${info.project.name}_${Date.now()}`;
  const peerName = `guest_${info.project.name}_${Date.now()}`;
  await signIn(page, `host-${info.project.name}`);
  expect(
    (await page.request.put("/api/friends/profile", { data: { username: owner }, headers })).ok(),
  ).toBe(true);
  const context = await browser.newContext({ baseURL: origin });
  try {
    const peer = await context.newPage();
    await signIn(peer, `guest-${info.project.name}`);
    expect(
      (
        await peer.request.put("/api/friends/profile", { data: { username: peerName }, headers })
      ).ok(),
    ).toBe(true);
    expect(
      (await peer.request.post("/api/friends", { data: { username: owner }, headers })).status(),
    ).toBe(201);
    await page.goto("/");
    await expect(page.locator(".menu-button")).toHaveAttribute("data-requests", "true");
    await expect(page.locator(".menu-button")).toHaveAccessibleName(
      "Toggle pages, 1 friend request",
    );
    if (info.project.name === "mobile") {
      expect(
        await page
          .locator(".menu-button")
          .evaluate((node) => getComputedStyle(node, "::after").width),
      ).toBe("6px");
      await page.screenshot({ path: info.outputPath("request-menu-dot.png") });
    }
    const nav = await sidebar(page);
    const link = nav.getByRole("link", { name: "Friends 1 friend request", exact: true });
    await expect(link.locator(".nav-badge")).toHaveText("1");
    await page.screenshot({ path: info.outputPath("request-navigation.png"), fullPage: true });
    await link.click();
    await expect(page).toHaveURL("/friends");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    const friends = page.getByRole("article", { name: "Friends", exact: true });
    await expect(friends).toContainText(`You are @${owner}`);
    const ids = await friends
      .locator(":scope > section")
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(ids).toEqual(["", "requests", "friends", "add"]);
    const requests = friends.getByRole("region", { name: "Requests · 1 waiting", exact: true });
    await expect(requests).toContainText(`@${peerName}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`friends-signed-in-${info.project.name}.png`),
      fullPage: true,
    });
    await requests.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(friends.getByRole("status").filter({ hasText: "now friends" })).toBeVisible();
    await expect(friends.locator("#requests")).toHaveCount(0);
    await expect(page.locator(".menu-button")).toHaveAttribute("data-requests", "false");
    await expect(
      page.locator(".desktop-sidebar .nav-badge, .sidebar-drawer .nav-badge"),
    ).toHaveCount(0);
    const shared = friends.getByRole("button", { name: "See shared films", exact: true });
    await expect(shared).toBeDisabled();
    await expect(shared).toHaveAttribute("title", /has not connected/);
    await friends.getByRole("button", { name: "Remove", exact: true }).click();
    const removal = friends.getByRole("group", { name: "Remove friend", exact: true });
    await expect(removal.locator("p")).toBeFocused();
    await expect(friends.locator(".social-person")).toHaveCount(0);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await removal.getByRole("button", { name: "Keep friend", exact: true }).click();
    await expect(friends.getByRole("button", { name: "Remove", exact: true })).toBeFocused();
    await friends.getByRole("button", { name: "Remove", exact: true }).click();
    await removal.getByRole("button", { name: "Remove friend", exact: true }).click();
    await expect(friends.getByRole("status").filter({ hasText: "Friend removed." })).toBeVisible();
    await expect(
      friends.getByRole("heading", { name: "Your friends · 0", exact: true }),
    ).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Watchlists Manage friends closes the picker and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Filters(?:\s|$)/ }).click();
  await page
    .getByRole("button", { name: /^Watchlists/ })
    .filter({ visible: true })
    .click();
  const picker = page.getByRole("dialog", { name: "Watchlists", exact: true });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Manage friends", exact: true }).click();
  await expect(page).toHaveURL("/friends");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(
    page
      .getByRole("article", { name: "Friends", exact: true })
      .getByRole("heading", { name: "Friends", exact: true }),
  ).toBeFocused();
});

test("request counts cap visually and page polling preserves drafts and stops on departure", async ({
  page,
}, info) => {
  await signIn(page, `poll-${info.project.name}`);
  let count = 12,
    reads = 0;
  await page.route("**/api/friends", (route) => {
    reads++;
    return route.fulfill({
      json: {
        appUsername: "page_host",
        friendsDigest: true,
        friends: Array.from({ length: count }, (_, index) => ({
          id: `request-${index}`,
          username: `waiting_${index}`,
          letterboxdUsername: null,
          status: "pending",
          direction: "incoming",
          fetchedAt: null,
          count: 0,
          stale: true,
        })),
      },
    });
  });
  await page.clock.install({ time: new Date() });
  await page.goto("/friends#requests");
  const friends = page.getByRole("article", { name: "Friends", exact: true });
  await expect(friends).toContainText("You are @page_host");
  await expect(friends.locator("#requests")).toBeFocused();
  await expect(page.locator(".desktop-sidebar .nav-badge")).toHaveText("9+");
  await expect(page.locator(".menu-button")).toHaveAccessibleName(
    "Toggle pages, 12 friend requests",
  );
  const input = friends
    .getByRole("region", { name: "Add a friend", exact: true })
    .getByLabel("App username", { exact: true });
  await input.fill("draft_friend");
  const before = reads;
  count = 1;
  await page.clock.fastForward(30000);
  await expect(
    friends.getByRole("heading", { name: "Requests · 1 waiting", exact: true }),
  ).toBeVisible();
  expect(reads).toBeGreaterThan(before);
  await expect(input).toHaveValue("draft_friend");
  await expect(input).toBeFocused();
  await page.locator(".masthead h1 a").click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".film-row").first()).toBeVisible();
  const after = reads;
  await page.clock.fastForward(60000);
  expect(reads).toBe(after);
});
