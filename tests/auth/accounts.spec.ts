import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
async function menu(page: Page) {
  if ((page.viewportSize()?.width ?? 1200) < 800) {
    await page.getByRole("button", { name: "Toggle pages" }).click();
    return page.getByRole("dialog", { name: "Pages", exact: true });
  }
  return page.locator(".desktop-sidebar");
}
async function close(page: Page) {
  if ((page.viewportSize()?.width ?? 1200) < 800) await page.keyboard.press("Escape");
}
test("real Functions sign-in, watchlist, settings, shared filter and account deletion", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/watchlist");
  await expect(
    page.getByText("Sign in using Account in the menu to import your watchlist."),
  ).toBeVisible();
  const email = `browser-${info.project.name}-${Date.now()}@example.com`;
  const signedOutPanel = await menu(page);
  await signedOutPanel.getByLabel("Email", { exact: true }).fill(email);
  const sent = page.waitForResponse((response) => response.url().endsWith("/api/auth/request"));
  await signedOutPanel.getByRole("button", { name: "Send sign-in link" }).click();
  const response = await sent;
  expect(response.ok()).toBe(true);
  const { link } = await response.json();
  await expect(signedOutPanel.getByText("Check your email", { exact: false })).toBeVisible();
  await close(page);
  await page.goto(link);
  await page.getByRole("button", { name: "Confirm sign-in" }).click();
  await expect(page).toHaveURL("/watchlist");
  const cookie = (await context.cookies()).find((cookie) => cookie.name === "__Host-session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.secure).toBe(true);
  let panel = await menu(page);
  await panel.getByLabel("Letterboxd username").fill("synthetic-user");
  await panel.getByLabel("Weekly screening email").selectOption("3");
  await panel.getByRole("button", { name: "Save account" }).click();
  await expect(panel.getByText("Account saved.", { exact: false })).toBeVisible();
  await close(page);
  const { user } = await (await page.request.get("/api/me")).json();
  // Seed synthetic imported data locally, never scrape or email a real user.
  const manifest = JSON.parse(readFileSync("src/generated/manifest.json", "utf8"));
  const films = JSON.parse(readFileSync(`public${manifest.films}`, "utf8"));
  const selected = films.find(
    (film: { ra: { lb?: { url: string } }; sc: unknown[] }) =>
      film.ra.lb?.url?.includes("letterboxd.com/film/") && film.sc.length,
  );
  const slug = new URL(selected.ra.lb.url).pathname.split("/")[2];
  expect(user.id).toMatch(/^[a-f0-9-]{36}$/);
  expect(slug).toMatch(/^[a-z0-9-]+$/);
  const stamp = Math.floor(Date.now() / 1000);
  execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "london-cine-info",
      "--local",
      "--persist-to",
      process.env.ACCOUNT_TEST_STATE!,
      "--command",
      `INSERT INTO watchlist_items(user_id,slug,added_at) VALUES ('${user.id}','${slug}',${stamp}); INSERT INTO watchlist_sync(user_id,fetched_at,count_reported,count_parsed) VALUES ('${user.id}',${stamp},1,1);`,
    ],
    { stdio: "pipe" },
  );
  await page.reload();
  await expect(page.locator(".film-row")).toHaveCount(1);
  await expect(
    page.getByText("1 of your 1 watchlist films are screening in London."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: `${selected.ti} is on your Letterboxd watchlist` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sort watchlist first" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("watchlist.png") });
  panel = await menu(page);
  await panel.getByRole("link", { name: "All movies", exact: true }).click();
  await page.getByRole("button", { name: /^(More filters|Filters) ▾$/ }).click();
  const filters = page.getByRole("dialog", { name: "Filters", exact: true });
  await filters.getByRole("checkbox", { name: "Only my watchlist" }).check();
  await filters.getByRole("button", { name: /^Show/ }).click();
  await expect(page.locator(".film-row")).toHaveCount(1);
  await expect(page).toHaveURL(/watchlist=1/);
  await page.reload();
  await expect(page.locator(".film-row")).toHaveCount(1);
  panel = await menu(page);
  await panel.getByRole("button", { name: "Delete account", exact: true }).click();
  await panel.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(panel.getByRole("button", { name: "Send sign-in link" })).toBeVisible();
  expect((await (await page.request.get("/api/me")).json()).user).toBeNull();
  await close(page);
  expect(errors).toEqual([]);
});
