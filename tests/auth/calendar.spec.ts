import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
async function login(page: Page, email: string) {
  const sent = await page.request.post("/api/auth/request", {
    data: { email },
    headers: { Origin: "http://localhost:4174" },
  });
  expect(sent.ok()).toBe(true);
  const { link } = await sent.json();
  const verified = await page.request.post("/api/auth/verify", {
    data: { token: new URL(link).searchParams.get("token") },
    headers: { Origin: "http://localhost:4174" },
  });
  expect(verified.ok()).toBe(true);
}
async function screening(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Fixture Classic A", exact: true }).click();
  await page
    .getByRole("button", { name: /^Add to calendar:/ })
    .first()
    .click();
  return page.getByRole("dialog", { name: "Add to calendar", exact: true });
}
async function exportFile(page: Page, click: () => Promise<unknown>) {
  const downloading = page.waitForEvent("download");
  await click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.ics$/);
  return readFile((await download.path())!, "utf8");
}
test("screening export, saved calendar persistence, failure recovery, removal and account isolation", async ({
  page,
}, info) => {
  // Each suite shares the local D1 instance. Start this account scenario with a fresh
  // local quotas so adding coverage does not exhaust the production sign-in limit.
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
      "--command",
      "DELETE FROM rate_limits",
    ],
    { stdio: "pipe" },
  );
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let dialog = await screening(page);
  await expect(dialog.getByRole("button", { name: "Sign in to save", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("add-to-calendar.png") });
  const guestFile = await exportFile(page, () =>
    dialog.getByRole("button", { name: "Download calendar file (.ics)", exact: true }).click(),
  );
  expect(guestFile).toContain("BEGIN:VEVENT");
  expect(guestFile).toContain("SUMMARY:Fixture Classic A");
  expect(guestFile).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  const email = `calendar-${info.project.name}-${Date.now()}@example.com`;
  await login(page, email);
  dialog = await screening(page);
  await expect(
    dialog.getByRole("button", { name: "Save to my calendar", exact: true }),
  ).toBeEnabled();
  await page.route("**/api/calendar", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 503, json: { error: "Calendar unavailable. Please retry." } })
      : route.fallback(),
  );
  await dialog.getByRole("button", { name: "Save to my calendar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Calendar unavailable");
  await page.unroute("**/api/calendar");
  await dialog.getByRole("button", { name: "Save to my calendar", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Remove from my calendar", exact: true }),
  ).toBeEnabled();
  const stored = (await (await page.request.get("/api/calendar")).json()).screenings;
  expect(stored).toHaveLength(1);
  expect(guestFile.replace(/\r\n /g, "")).toContain(`UID:${stored[0].id}@london-cine.info`);
  await dialog.getByRole("button", { name: "View my calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/my-calendar/);
  await page.reload();
  await expect(page.locator(".saved-screenings > li")).toHaveCount(1);
  const allFile = await exportFile(page, () =>
    page.getByRole("button", { name: "Download my calendar (.ics)", exact: true }).click(),
  );
  expect(allFile).toContain(
    `DTSTART:${new Date(stored[0].start)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
  );
  expect(allFile.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: info.outputPath("my-calendar.png"), fullPage: true });
  await page.request.post("/api/auth/logout", {
    data: {},
    headers: { Origin: "http://localhost:4174" },
  });
  await login(page, `other-${email}`);
  await page.reload();
  await expect(page.getByText(/No screenings saved yet/)).toBeVisible();
  await page.request.post("/api/auth/logout", {
    data: {},
    headers: { Origin: "http://localhost:4174" },
  });
  await login(page, email);
  await page.reload();
  await expect(page.locator(".saved-screenings > li")).toHaveCount(1);
  await page.getByRole("button", { name: /^Remove Fixture Classic A/ }).click();
  await expect(page.getByText(/No screenings saved yet/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/No screenings saved yet/)).toBeVisible();
  expect(errors).toEqual([]);
});
