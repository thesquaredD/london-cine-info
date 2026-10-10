import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const phone = (page: Page) => (page.viewportSize()?.width ?? 1200) < 800;
/** Opens the account dialog from the sidebar (desktop) or the Pages drawer (phone). */
async function openAccount(page: Page) {
  if (phone(page)) {
    await page.getByRole("button", { name: "Toggle pages" }).click();
    const drawer = page.getByRole("dialog", { name: "Pages", exact: true });
    await drawer.getByRole("button", { name: /^(Sign in|Account)$/ }).click();
    await expect(drawer).toBeHidden();
  } else await page.locator(".desktop-sidebar .account-panel button").click();
  const dialog = page.locator(".account-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}
test("real Functions sign-in, dialog settings, watchlist, shared filter and account deletion", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/watchlist");
  await expect(page.getByText("Sign in to import your public Letterboxd watchlist.")).toBeVisible();
  const email = `browser-${info.project.name}-${Date.now()}@example.com`;
  let dialog = await openAccount(page);
  await expect(dialog).toHaveAccessibleName("Sign in");
  await expect(dialog.getByLabel("Email", { exact: true })).toBeFocused();
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  const sent = page.waitForResponse((response) => response.url().endsWith("/api/auth/request"));
  await dialog.getByRole("button", { name: "Send sign-in link" }).click();
  const response = await sent;
  expect(response.ok()).toBe(true);
  const { link } = await response.json();
  await expect(dialog.getByRole("status")).toContainText("Check your email");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // The notice stays visible on the page after the dialog closes.
  await expect(page.locator(".page-notices").getByRole("status")).toContainText("Check your email");
  if (!phone(page))
    await expect(page.locator(".desktop-sidebar .account-panel button")).toBeFocused();
  await page.goto(link);
  await page.getByRole("button", { name: "Confirm sign-in" }).click();
  await expect(page).toHaveURL("/watchlist");
  const cookie = (await context.cookies()).find((cookie) => cookie.name === "__Host-session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.secure).toBe(true);
  await expect(
    page.getByText("Set your Letterboxd username to import your public watchlist."),
  ).toBeVisible();
  dialog = await openAccount(page);
  await expect(dialog).toHaveAccessibleName("Account");
  await expect(dialog.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save account" })).toBeDisabled();
  await dialog.getByLabel("Letterboxd username").fill("synthetic-user");
  await dialog.getByLabel("Weekly screening email").selectOption("3");
  await expect(dialog.getByText("You have unsaved changes.")).toBeVisible();
  await page.screenshot({ path: info.outputPath("account-dialog.png") });
  await dialog.getByRole("button", { name: "Save account" }).click();
  await expect(dialog.getByRole("status").filter({ hasText: "Account saved." })).toBeVisible();
  await expect(dialog.getByText("has not been imported yet")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Import watchlist" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Close account" }).click();
  await expect(dialog).toBeHidden();
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
      `INSERT INTO watchlist_items(user_id,slug,added_at) VALUES ('${user.id}','${slug}',${stamp}); INSERT INTO watchlist_sync(user_id,fetched_at,count_reported,count_parsed,completed_at) VALUES ('${user.id}',${stamp},1,1,${stamp});`,
    ],
    { stdio: "pipe" },
  );
  await page.reload();
  await expect(page.locator(".film-row")).toHaveCount(1);
  const intro = page.locator(".watchlist-intro");
  await expect(intro.getByText("1 of your 1 watchlist film is screening in London.")).toBeVisible();
  await expect(intro.getByText(/Last successful import:/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh now" })).toBeEnabled();
  await expect(
    page.getByRole("link", { name: `${selected.ti} is on your Letterboxd watchlist` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sort watchlist first" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("watchlist.png") });
  // Request an import from the page: local dev records the queue without dispatching GitHub.
  await page.getByRole("button", { name: "Refresh now" }).click();
  await expect(intro.getByRole("status").filter({ hasText: "Import queued" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import in progress" })).toBeDisabled();
  await expect(page.locator(".film-row")).toHaveCount(1);
  dialog = await openAccount(page);
  await expect(dialog.getByText("Import queued", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "Close account" }).click();
  if (phone(page)) await page.getByRole("button", { name: "Toggle pages" }).click();
  await (
    phone(page)
      ? page.getByRole("dialog", { name: "Pages", exact: true })
      : page.locator(".desktop-sidebar")
  )
    .getByRole("link", { name: "All movies", exact: true })
    .click();
  await page.getByRole("button", { name: /^(More filters|All filters)$/ }).click();
  const filters = page.getByRole("dialog", { name: "Filters", exact: true });
  await filters.getByRole("checkbox", { name: "Only my watchlist" }).check();
  await filters.getByRole("button", { name: /^Show/ }).click();
  await expect(page.locator(".film-row")).toHaveCount(1);
  await expect(page).toHaveURL(/watchlist=1/);
  await page.reload();
  await expect(page.locator(".film-row")).toHaveCount(1);
  dialog = await openAccount(page);
  await dialog.getByRole("button", { name: "Delete account", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("Delete account");
  await expect(dialog.getByText("This cannot be undone.")).toBeVisible();
  await page.screenshot({ path: info.outputPath("delete-confirmation.png") });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveAccessibleName("Account");
  await dialog.getByRole("button", { name: "Delete account", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".page-notices").getByRole("status")).toContainText("were deleted");
  expect((await (await page.request.get("/api/me")).json()).user).toBeNull();
  await expect(page.getByText("Sign in to view your watchlist", { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});
