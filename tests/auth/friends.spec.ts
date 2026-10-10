import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Film } from "../../src/shared/data";
import { letterboxdSlug } from "../../src/shared/account";
const origin = "http://localhost:4174";
async function login(page: Page, email: string) {
  const sent = await page.request.post("/api/auth/request", {
    data: { email },
    headers: { Origin: origin, "CF-Connecting-IP": email },
  });
  expect(sent.ok()).toBe(true);
  const { link } = await sent.json();
  expect(
    (
      await page.request.post("/api/auth/verify", {
        data: { token: new URL(link).searchParams.get("token") },
        headers: { Origin: origin },
      })
    ).ok(),
  ).toBe(true);
  return (await (await page.request.get("/api/me")).json()).user;
}
async function openFriends(page: Page) {
  if (page.viewportSize()!.width < 800) {
    await page.getByRole("button", { name: "Toggle pages" }).click();
    await page
      .locator(".sidebar-drawer")
      .getByRole("button", { name: /^Friends/ })
      .click();
  } else
    await page
      .locator(".desktop-sidebar")
      .getByRole("button", { name: /^Friends/ })
      .click();
  const dialog = page.getByRole("dialog", { name: "Find a film together", exact: true });
  await dialog.getByRole("button", { name: "Keep friends for next time", exact: true }).click();
  await expect(dialog).toBeVisible();
  return dialog;
}
async function watchlistsButton(page: Page) {
  await page.getByRole("button", { name: /^Filters(?:\s|$)/ }).click();
  return page.getByRole("button", { name: /^Watchlists/ }).filter({ visible: true });
}
const sqlQuote = (v: string) => `'${v.replaceAll("'", "''")}'`;
function execute(sql: string, path: string) {
  writeFileSync(path, sql);
  execFileSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "london-cine-info",
      "--local",
      "--persist-to",
      process.env.ACCOUNT_TEST_STATE!,
      "--file",
      path,
    ],
    { stdio: "pipe" },
  );
}

test("real friendship lifecycle, 500-friend search and filters, guest comparisons and account isolation", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const manifest = JSON.parse(readFileSync("src/generated/manifest.json", "utf8"));
  const films = JSON.parse(readFileSync(`public${manifest.films}`, "utf8")) as Film[];
  const slugs = films
    .map((f) => letterboxdSlug(f.ra.lb?.url))
    .filter((s): s is string => !!s)
    .slice(0, 4);
  expect(slugs.length).toBeGreaterThan(1);
  await page.clock.install({ time: new Date(manifest.generatedAt) });
  const suffix = `${info.project.name}_${Date.now()}`;
  const owner = await login(page, `owner-${suffix}@friends.test`);
  await page.goto("/");
  await expect(
    page.locator(".all-filters, .watchlists-trigger").filter({ visible: true }).first(),
  ).toBeVisible();
  let dialog = await openFriends(page);
  await dialog.getByLabel("Your app username").fill(`owner_${suffix}`);
  await dialog.getByRole("button", { name: "Save username" }).click();
  await expect(dialog.getByRole("status")).toContainText("username was saved");
  await dialog.getByRole("button", { name: "Close find a film together", exact: true }).click();
  const peerContext = await browser.newContext({ baseURL: origin, viewport: page.viewportSize()! });
  const peer = await peerContext.newPage();
  try {
    await login(peer, `peer-${suffix}@friends.test`);
    expect(
      (
        await peer.request.put("/api/friends/profile", {
          data: { username: `peer_${suffix}` },
          headers: { Origin: origin },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await peer.request.post("/api/friends", {
          data: { username: `owner_${suffix}` },
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(201);
    await page.reload();
    dialog = await openFriends(page);
    await dialog.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("now friends");
    await dialog.getByRole("button", { name: "Close find a film together", exact: true }).click();
    const timestamp = Math.floor(Date.now() / 1000);
    const quote = sqlQuote;
    const statements: string[] = [];
    statements.push(
      `UPDATE users SET letterboxd_username='owner_watchlist' WHERE id=${quote(owner.id)};`,
      `INSERT INTO watchlist_sync(user_id,fetched_at,count_parsed,completed_at) VALUES (${quote(owner.id)},${timestamp},${slugs.length},${timestamp});`,
      ...slugs.map(
        (slug) =>
          `INSERT INTO watchlist_items(user_id,slug,added_at) VALUES (${quote(owner.id)},${quote(slug)},${timestamp});`,
      ),
    );
    for (let i = 0; i < 500; i++) {
      const id = randomUUID(),
        handle = `stress_${info.project.name}_${String(i).padStart(3, "0")}`,
        [low, high] = [owner.id, id].sort();
      statements.push(
        `INSERT INTO users(id,email,app_username,letterboxd_username,unsubscribe_token,created_at) VALUES (${quote(id)},${quote(id + "@stress.test")},${quote(handle)},${quote(handle)},${quote(randomUUID())},${timestamp});`,
        `INSERT INTO friendships(user_low,user_high,requested_by,status,created_at,accepted_at) VALUES (${quote(low!)},${quote(high!)},${quote(owner.id)},'accepted',${timestamp},${timestamp});`,
        `INSERT INTO watchlist_sync(user_id,fetched_at,count_parsed,completed_at) VALUES (${quote(id)},${timestamp},1,${timestamp});`,
        `INSERT INTO watchlist_items(user_id,slug,added_at) VALUES (${quote(id)},${quote(slugs[i % slugs.length]!)},${timestamp});`,
      );
    }
    const tempUsername = `temporary_${info.project.name}`;
    statements.push(
      `INSERT INTO public_watchlist_pages(username,page,payload,expires_at) VALUES (${quote(tempUsername)},1,${quote(JSON.stringify({ slugs: slugs.slice(0, 2), count: 2, pages: 1 }))},${timestamp + 3600});`,
    );
    execute(statements.join("\n"), info.outputPath("stress-seed.sql"));
    await page.reload();
    dialog = await openFriends(page);
    await expect(dialog.getByRole("heading", { name: "Your friends · 501" })).toBeVisible();
    expect(await dialog.locator(".social-person").count()).toBeLessThanOrEqual(6);
    const start = performance.now();
    await dialog
      .getByLabel("Search friends", { exact: true })
      .fill(`stress_${info.project.name}_499`);
    await expect(dialog.locator(".social-person")).toHaveCount(1);
    console.log(
      `${info.project.name}: 501-friend search rendered in ${Math.round(performance.now() - start)}ms`,
    );
    await page.screenshot({ path: info.outputPath("friends-search-500.png") });
    await dialog.getByLabel("Search friends", { exact: true }).fill("");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByText("2 / 84", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Close find a film together", exact: true }).click();
    await (await watchlistsButton(page)).click();
    const lists = page.getByRole("dialog", { name: "Watchlists", exact: true });
    expect(await lists.locator(".watchlist-option").count()).toBeLessThanOrEqual(8);
    await lists.getByRole("checkbox", { name: /Any friend’s watchlist/ }).check();
    await lists.getByRole("button", { name: "Apply watchlists" }).click();
    await expect(page.locator(".watchlist-selections")).toContainText("Any friend");
    await expect(page.locator(".film-row").first()).toBeVisible();
    await expect(page.locator(".film-friends").first()).toContainText("more");
    for (const name of [
      "New releases",
      "Classics",
      "Retrospectives",
      "Events",
      "Release calendar",
      "Watchlist",
      "My calendar",
      "Radar",
      "All movies",
    ]) {
      if (page.viewportSize()!.width < 800) {
        await page.getByRole("button", { name: "Toggle pages" }).click();
        await page.locator(".sidebar-drawer").getByRole("link", { name, exact: true }).click();
      } else
        await page.locator(".desktop-sidebar").getByRole("link", { name, exact: true }).click();
      await expect(
        page.locator(".all-filters, .watchlists-trigger").filter({ visible: true }).first(),
      ).toBeVisible();
      await expect(page.locator(".watchlist-selections")).toContainText("Any friend");
    }
    await (await watchlistsButton(page)).click();
    await lists.getByRole("checkbox", { name: /Any friend’s watchlist/ }).uncheck();
    await lists
      .getByLabel("Friends’ watchlists", { exact: true })
      .fill(`stress_${info.project.name}_499`);
    const chosen = lists.getByRole("checkbox", {
      name: new RegExp(`@stress_${info.project.name}_499`),
    });
    await chosen.check();
    await lists.getByRole("button", { name: "Apply watchlists" }).click();
    await expect(page.locator(".film-row")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".film-row")).toHaveCount(1);
    await page.screenshot({ path: info.outputPath("friend-filter.png") });
    await page.request.post("/api/auth/logout", { data: {}, headers: { Origin: origin } });
    await page.reload();
    await expect(page.locator(".watchlist-selections")).toHaveCount(0);
    await (await watchlistsButton(page)).click();
    await lists.getByRole("button", { name: "+ Use a Letterboxd watchlist" }).click();
    await lists.getByLabel("Letterboxd username", { exact: true }).fill(tempUsername);
    await lists.getByRole("button", { name: "Use watchlist", exact: true }).click();
    await expect(lists.getByRole("status")).toContainText("available for this session");
    await lists.getByRole("button", { name: "Apply watchlists" }).click();
    await expect(page.locator(".film-row")).toHaveCount(2);
    await page.reload();
    await expect(page.locator(".film-row")).toHaveCount(2);
    await expect(page.locator(".watchlist-selections")).toContainText("temporary");
    await login(page, `isolated-${suffix}@friends.test`);
    await page.reload();
    await expect(page.locator(".watchlist-selections")).toHaveCount(0);
    dialog = await openFriends(page);
    await expect(dialog.getByRole("heading", { name: "Your friends · 0" })).toBeVisible();
    await dialog.getByRole("button", { name: "Close find a film together", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    expect(errors).toEqual([]);
  } finally {
    await peerContext.close();
  }
});
