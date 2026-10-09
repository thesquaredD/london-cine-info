import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  const sent = await page.request.post("/api/auth/request", {
    data: { email },
    headers: { Origin: "http://localhost:4174" },
  });
  expect(sent.ok()).toBe(true);
  const { link } = await sent.json();
  const response = await page.request.post("/api/auth/verify", {
    data: { token: new URL(link).searchParams.get("token") },
    headers: { Origin: "http://localhost:4174" },
  });
  expect(response.ok()).toBe(true);
}
async function manage(page: Page) {
  const account = page.locator(".account-dialog");
  if (!(await account.isVisible())) {
    if (page.viewportSize()!.width < 800) {
      await page.getByRole("button", { name: "Toggle pages" }).click();
      await page
        .getByRole("dialog", { name: "Pages", exact: true })
        .getByRole("button", { name: /^(Sign in|Account)$/ })
        .click();
    } else await page.locator(".desktop-sidebar .account-panel button").click();
  }
  await expect(account).toBeVisible();
  await account.getByRole("button", { name: "Manage my cinemas", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Manage my cinemas", exact: true });
  await expect(dialog.getByRole("button", { name: "Done", exact: true })).toBeEnabled();
  await expect(account).toBeHidden();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  return dialog;
}
test("real favourite union, cross-device removal, failed save, sign-out and account isolation", async ({
  page,
  browser,
}, info) => {
  const email = `favourites-${info.project.name}-${Date.now()}@example.com`;
  await page.goto("/");
  let dialog = await manage(page);
  const bfi = dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true });
  await bfi.check();
  const selected = dialog.getByRole("region", { name: "Selected cinemas", exact: true });
  await expect(
    selected.getByRole("button", { name: "Remove BFI Southbank", exact: true }),
  ).toBeVisible();
  const checkboxBox = await bfi.boundingBox();
  expect(checkboxBox!.width).toBe(18);
  expect(checkboxBox!.height).toBe(18);
  await dialog.getByLabel("Find cinemas", { exact: true }).fill("Prince Charles");
  await selected.getByRole("button", { name: "Remove BFI Southbank", exact: true }).click();
  await expect(selected.getByText("No cinemas selected yet.")).toBeVisible();
  await dialog.getByLabel("Find cinemas", { exact: true }).fill("");
  await expect(bfi).not.toBeChecked();
  await bfi.check();
  await page.screenshot({ path: info.outputPath("cinema-selection.png") });
  await expect(dialog.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await login(page, email);
  await page.reload();
  dialog = await manage(page);
  await expect(dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true })).toBeChecked();
  await dialog.getByRole("button", { name: "Close manage my cinemas", exact: true }).click();
  const device = await browser.newContext({
    baseURL: "http://localhost:4174",
    viewport: page.viewportSize()!,
    recordVideo: { dir: info.outputPath("second-device") },
  });
  const second = await device.newPage();
  try {
    await login(second, email);
    await second.goto("/");
    const remote = await manage(second);
    await expect(
      remote.getByRole("checkbox", { name: "BFI Southbank", exact: true }),
    ).toBeChecked();
    await remote.getByRole("checkbox", { name: "BFI Southbank", exact: true }).uncheck();
    await expect(remote.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await remote.getByRole("button", { name: "Done", exact: true }).click();
    await page.reload();
    dialog = await manage(page);
    await expect(
      dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }),
    ).not.toBeChecked();
    await page.route("**/api/cinemas", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({
            status: 503,
            json: { error: "Cinema sync is unavailable. Please retry." },
          })
        : route.fallback(),
    );
    await dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }).check();
    await expect(dialog.getByRole("alert")).toContainText("Cinema sync is unavailable");
    await expect(
      dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }),
    ).toBeChecked();
    await page.unroute("**/api/cinemas");
    await dialog.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(dialog.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.request.post("/api/auth/logout", {
      data: {},
      headers: { Origin: "http://localhost:4174" },
    });
    await page.reload();
    dialog = await manage(page);
    await expect(
      dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }),
    ).toBeChecked();
    await expect(
      dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }),
    ).not.toBeChecked();
    await dialog.getByRole("button", { name: "Close manage my cinemas", exact: true }).click();
    await login(page, `other-${email}`);
    await page.reload();
    dialog = await manage(page);
    // The second account receives only guest favourites, never the previous account's Prince Charles choice.
    await expect(
      dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }),
    ).not.toBeChecked();
    await dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }).uncheck();
    await expect(dialog.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    const account = page.locator(".account-dialog");
    await expect(account).toBeVisible();
    await account.getByRole("button", { name: "Close account", exact: true }).click();
    if (page.viewportSize()!.width < 800)
      await page.getByRole("button", { name: /^Quick filters/ }).click();
    await page
      .locator(".quick-days")
      .getByRole("button", { name: "My cinemas", exact: true })
      .click();
    if (page.viewportSize()!.width < 800)
      await page
        .getByRole("dialog", { name: "Quick filters", exact: true })
        .getByRole("button", { name: /^Show/ })
        .click();
    await expect(
      page.getByRole("heading", { name: "Set up my cinemas", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".film-row")).toHaveCount(0);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("cinema-setup-empty.png") });
    await expect(page.getByRole("group", { name: "Suggested filter adjustments" })).toBeHidden();
    await page.getByRole("button", { name: "Set up my cinemas", exact: true }).click();
    await expect(
      dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }),
    ).not.toBeChecked();
    await dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }).check();
    await expect(dialog.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.locator(".film-row")).toHaveCount(2);
    await expect(
      page.getByRole("heading", { name: "Set up my cinemas", exact: true }),
    ).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.screenshot({ path: info.outputPath("favourites.png") });
  } finally {
    await device.close();
  }
});
