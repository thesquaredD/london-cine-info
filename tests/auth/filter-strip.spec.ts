import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

test("connected watchlist and chosen cinemas appear immediately and all eight shortcuts fit", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  const email = `strip-${info.project.name}-${Date.now()}@example.com`;
  const origin = { Origin: "http://localhost:4174" };
  const sent = await page.request.post("/api/auth/request", { data: { email }, headers: origin });
  const { link } = await sent.json();
  await page.request.post("/api/auth/verify", {
    data: { token: new URL(link).searchParams.get("token") },
    headers: origin,
  });
  const { user } = await (await page.request.get("/api/me")).json();
  await page.goto("/");
  const strip = page.getByRole("group", { name: "Shortcuts" });
  await expect(strip.getByRole("button")).toHaveCount(6);
  // Simulate completion of the local import; focus invokes the existing account refresh.
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
      `UPDATE users SET letterboxd_username='synthetic-user' WHERE id='${user.id}'; INSERT INTO watchlist_items(user_id,slug,added_at) VALUES ('${user.id}','fixture',1791018000); INSERT INTO watchlist_sync(user_id,fetched_at,count_reported,count_parsed,completed_at) VALUES ('${user.id}',1791018000,1,1,1791018000);`,
    ],
    { stdio: "pipe" },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(strip.getByRole("button", { name: "My watchlist", exact: true })).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Toggle pages" }).click();
  await page
    .getByRole("button", { name: "Account", exact: true })
    .filter({ visible: true })
    .click();
  const account = page.locator(".account-dialog");
  await account.getByRole("button", { name: "Manage my cinemas", exact: true }).click();
  const cinemas = page.getByRole("dialog", { name: "Manage my cinemas", exact: true });
  await cinemas.getByRole("checkbox", { name: "BFI Southbank", exact: true }).check();
  await expect(cinemas.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  await cinemas.getByRole("button", { name: "Done", exact: true }).click();
  await account.getByRole("button", { name: "Close account", exact: true }).click();
  await expect(strip.getByRole("button")).toHaveCount(8);
  const width = info.project.name === "mobile" ? 390 : 1280;
  await page.setViewportSize({ width, height: 900 });
  expect((await strip.boundingBox())!.height).toBeLessThanOrEqual(width === 390 ? 80 : 30);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const evidence = join(homedir(), ".Codex/london-cine-info/filter-strip");
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: join(evidence, `signed-in-${width}.png`) });
  await strip.getByRole("button", { name: "My watchlist", exact: true }).click();
  await expect(page.locator(".film-row")).toHaveCount(1);
  await expect(strip.getByRole("button", { name: "My watchlist", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(errors).toEqual([]);
});
