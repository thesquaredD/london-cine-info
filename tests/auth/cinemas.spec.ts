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
  if (page.viewportSize()!.width < 800)
    await page.getByRole("button", { name: /^Quick filters/ }).click();
  await page
    .locator(".quick-days")
    .getByRole("button", { name: "Manage my cinemas", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Manage my cinemas", exact: true });
  await expect(dialog.getByRole("button", { name: "Save my cinemas", exact: true })).toBeEnabled();
  return dialog;
}
test("real favourite union, cross-device removal, failed save, sign-out and account isolation", async ({
  page,
  browser,
}, info) => {
  const email = `favourites-${info.project.name}-${Date.now()}@example.com`;
  await page.goto("/");
  let dialog = await manage(page);
  await dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }).check();
  await dialog.getByRole("button", { name: "Save my cinemas", exact: true }).click();
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
    await remote.getByRole("button", { name: "Save my cinemas", exact: true }).click();
    await page.reload();
    dialog = await manage(page);
    await expect(
      dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true }),
    ).not.toBeChecked();
    await dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }).check();
    await page.route("**/api/cinemas", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({
            status: 503,
            json: { error: "Cinema sync is unavailable. Please retry." },
          })
        : route.fallback(),
    );
    await dialog.getByRole("button", { name: "Save my cinemas", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Cinema sync is unavailable");
    await expect(
      dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true }),
    ).toBeChecked();
    await page.unroute("**/api/cinemas");
    await dialog.getByRole("button", { name: "Save my cinemas", exact: true }).click();
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
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.screenshot({ path: info.outputPath("favourites.png") });
  } finally {
    await device.close();
  }
});
