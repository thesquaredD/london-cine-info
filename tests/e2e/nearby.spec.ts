import { test, expect, type Page, type Route } from "@playwright/test";

const TRAFALGAR = { latitude: 51.5074, longitude: -0.1278, postcode: "WC2N 5DU" };
const MARYLEBONE = { latitude: 51.5246, longitude: -0.165, postcode: "NW1 6XE" };
const EDINBURGH = { latitude: 55.9533, longitude: -3.1883, postcode: "EH1 1YZ" };

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-03T09:00:00Z"));
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/image.tmdb.org/**", (route) => route.fulfill({ status: 404 }));
  // Device location is driven from the test: each request waits until we answer it.
  await page.addInitScript(() => {
    type Pending = { ok: PositionCallback; fail?: PositionErrorCallback | null };
    const pending: Pending[] = [];
    Object.assign(window, { __geo: pending });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback, fail?: PositionErrorCallback | null) =>
          pending.push({ ok, fail }),
      },
    });
  });
});

function geo(page: Page) {
  return {
    succeed: (lat: number, lon: number) =>
      page.evaluate(
        ([lat, lon]) => {
          const request = (
            window as unknown as { __geo: { ok: PositionCallback }[] }
          ).__geo.shift();
          request!.ok({ coords: { latitude: lat, longitude: lon } } as GeolocationPosition);
        },
        [lat, lon],
      ),
    fail: (code: number) =>
      page.evaluate((code) => {
        const request = (
          window as unknown as { __geo: { fail: PositionErrorCallback }[] }
        ).__geo.shift();
        request!.fail({ code } as GeolocationPositionError);
      }, code),
  };
}

async function openNearby(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Near me", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Find nearby cinemas", exact: true });
  await expect(dialog).toBeVisible();
  // Let the sheet finish sliding in before measuring control positions.
  await dialog.evaluate((node) =>
    Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  return dialog;
}
const status = (dialog: ReturnType<Page["getByRole"]>) => dialog.locator("#nearby-status");

test("postcode, range and unchecked cinemas apply as a temporary filter", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "london-cine.cinemas.v1",
      JSON.stringify({ browserId: "00000000-0000-4000-8000-000000000000", venues: ["bfi.org.uk"] }),
    ),
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("https://api.postcodes.io/**", async (route) => {
    await held;
    await route.fulfill({ json: { result: MARYLEBONE } });
  });
  const dialog = await openNearby(page);
  const saved = await page.evaluate(() => localStorage.getItem("london-cine.cinemas.v1"));
  await expect(page.getByRole("button", { name: "Edit cinemas", exact: true })).toBeHidden();

  const range = dialog.getByLabel("Range", { exact: true });
  await expect(range).toBeVisible();
  const before = await range.boundingBox();
  const heading = dialog.locator(".nearby-finder-heading");
  const headingBefore = (await heading.boundingBox())!.y;
  await dialog.getByRole("textbox", { name: "Postcode" }).fill("nw16xe");
  await dialog.getByRole("button", { name: "Find", exact: true }).click();
  await expect(status(dialog)).toHaveText("Checking postcode…");
  await expect(dialog.getByRole("button", { name: "Show films" })).toBeDisabled();
  // Cancel appears inside the reserved slot; the results below do not move.
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  expect((await heading.boundingBox())!.y).toBeCloseTo(headingBefore, 0);
  release();
  await expect(status(dialog)).toContainText("2 cinemas within 2 miles of NW1 6XE.");
  await expect(heading).toContainText("Cinemas within 2 miles of NW1 6XE");
  await expect(dialog.getByRole("textbox", { name: "Postcode" })).toHaveValue("NW1 6XE");
  // Feedback has reserved space: the controls stay where they were.
  expect((await range.boundingBox())!.y).toBeCloseTo(before!.y, 0);

  // Fixture cinemas from Marylebone: Picturehouse Central 1.6 mi, Prince Charles 1.7 mi,
  // BFI Southbank 2.5 mi.
  const boxes = dialog.getByRole("checkbox");
  const names = dialog.locator(".nearby-finder-name > span");
  await expect(names).toHaveText(["Picturehouse Central", "Prince Charles Cinema"]);
  for (const box of await boxes.all()) await expect(box).toBeChecked();
  await expect(dialog.getByText("2 of 2 cinemas selected")).toBeVisible();
  const prince = dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true });
  await prince.uncheck();
  await expect(dialog.getByText("1 of 2 cinemas selected")).toBeVisible();

  // Narrowing hides every cinema; widening brings the exclusion back and adds BFI selected.
  await range.selectOption("1");
  await expect(status(dialog)).toContainText("No cinemas within 1 mile of NW1 6XE");
  await expect(boxes).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Show films" })).toBeDisabled();
  await range.selectOption("3");
  await expect(names).toHaveText([
    "Picturehouse Central",
    "Prince Charles Cinema",
    "BFI Southbank",
  ]);
  const distances = await dialog
    .locator(".nearby-finder-distance")
    .evaluateAll((nodes) => nodes.map((node) => parseFloat(node.firstChild!.textContent!)));
  expect(distances).toEqual([...distances].sort((a, b) => a - b));
  await expect(prince).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true })).toBeChecked();
  await expect(dialog.getByText("2 of 3 cinemas selected")).toBeVisible();
  const chosen = ["picturehouses.com-central", "bfi.org.uk-southbank"];

  await dialog.getByRole("button", { name: "Show films", exact: true }).click();
  await expect(dialog).toBeHidden();
  const url = new URL(page.url());
  expect(url.searchParams.getAll("venue")).toEqual(chosen);
  expect(url.searchParams.has("cinemas")).toBe(false);
  await expect(page.getByText(`Nearby · ${chosen.length} cinemas`)).toBeVisible();
  await expect(page.locator(".film-row").first()).toBeVisible();
  // Saved My cinemas are untouched, and Edit cinemas only appears with My cinemas on.
  expect(await page.evaluate(() => localStorage.getItem("london-cine.cinemas.v1"))).toBe(saved);
  await expect(page.getByRole("button", { name: "Edit cinemas", exact: true })).toBeHidden();
  await page
    .getByRole("group", { name: "Shortcuts" })
    .getByRole("button", { name: "My cinemas", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Edit cinemas", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.getAll("venue")).toEqual(["bfi.org.uk"]);

  // Reopening resumes the last search with its exclusions.
  await page.getByRole("button", { name: "Near me", exact: true }).click();
  await expect(prince).not.toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("a new location keeps exclusions, a failure keeps the labelled list, typing wins", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("https://api.postcodes.io/**", async (route) => {
    const url = route.request().url();
    if (url.includes("ZZ")) return route.fulfill({ status: 404, json: {} });
    if (url.includes("WC2N")) {
      await held;
      return route.fulfill({ json: { result: TRAFALGAR } });
    }
    return route.fulfill({ json: { result: MARYLEBONE } });
  });
  const dialog = await openNearby(page);
  const input = dialog.getByRole("textbox", { name: "Postcode" });
  const heading = dialog.locator(".nearby-finder-heading");
  const prince = dialog.getByRole("checkbox", { name: "Prince Charles Cinema", exact: true });
  await input.fill("NW1 6XE");
  await input.press("Enter");
  await expect(status(dialog)).toContainText("of NW1 6XE.");
  await prince.uncheck();

  // A failed search says the list still belongs to the previous location.
  await input.fill("ZZ1 1ZZ");
  await input.press("Enter");
  await expect(status(dialog)).toContainText("We couldn’t find that postcode");
  await expect(status(dialog)).toContainText("Still showing cinemas near NW1 6XE.");
  await expect(heading).toContainText("Cinemas within 2 miles of NW1 6XE");
  await expect(input).toHaveAttribute("aria-invalid", "true");

  // Typing during a lookup is not overwritten by the tidied result.
  await input.fill("wc2n5du");
  await input.press("Enter");
  await expect(status(dialog)).toHaveText("Checking postcode…");
  await input.fill("WC2N 5");
  release();
  await expect(status(dialog)).toContainText("cinemas within 2 miles of WC2N 5DU.");
  await expect(heading).toContainText("of WC2N 5DU");
  await expect(input).toHaveValue("WC2N 5");

  // The cinema unticked near NW1 6XE stays unticked for the new location.
  await expect(prince).not.toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: "Picturehouse Central", exact: true }),
  ).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "BFI Southbank", exact: true })).toBeChecked();
});

test("invalid, unknown and failing postcodes explain how to recover", async ({ page }) => {
  let requests = 0;
  let reply: (route: Route) => Promise<void> = (route) => route.fulfill({ status: 404, json: {} });
  await page.route("https://api.postcodes.io/**", (route) => {
    requests++;
    return reply(route);
  });
  const dialog = await openNearby(page);
  const input = dialog.getByRole("textbox", { name: "Postcode" });
  await input.fill("Soho");
  await input.press("Enter");
  await expect(status(dialog)).toContainText("Enter a UK postcode");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  expect(requests).toBe(0);

  await input.fill("ZZ1 1ZZ");
  await input.press("Enter");
  await expect(status(dialog)).toContainText("We couldn’t find that postcode");

  reply = (route) => route.fulfill({ status: 503, json: {} });
  await input.press("Enter");
  await expect(status(dialog)).toContainText("The postcode service isn’t working right now");

  reply = (route) => route.abort("internetdisconnected");
  await input.press("Enter");
  await expect(status(dialog)).toContainText("Check your connection");

  reply = (route) => route.fulfill({ json: { result: EDINBURGH } });
  await input.fill("EH1 1YZ");
  await input.press("Enter");
  await expect(status(dialog)).toContainText("No cinemas within 2 miles of EH1 1YZ");
  await expect(dialog.getByText("Choose a wider range")).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "false");
  await expect(dialog.getByRole("button", { name: "Show films" })).toBeDisabled();
});

test("device location covers waiting, denial, timeout and success", async ({ page }) => {
  const dialog = await openNearby(page);
  const locate = dialog.getByRole("button", { name: "Use my location", exact: true });
  await locate.click();
  await expect(status(dialog)).toContainText("Waiting for your location");
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await geo(page).fail(1);
  await expect(status(dialog)).toContainText("Location access is blocked");
  await locate.click();
  await geo(page).fail(3);
  await expect(status(dialog)).toContainText("Finding your location took too long");
  await locate.click();
  await geo(page).fail(2);
  await expect(status(dialog)).toContainText("isn’t available on this device");
  await locate.click();
  await geo(page).succeed(TRAFALGAR.latitude, TRAFALGAR.longitude);
  await expect(status(dialog)).toContainText(/cinemas within 2 miles of your location\./);
  await expect(dialog.getByRole("button", { name: "Show films" })).toBeEnabled();
});

test("a slower earlier lookup never replaces the latest location", async ({ page }) => {
  let releaseFirst!: () => void;
  const first = new Promise<void>((resolve) => (releaseFirst = resolve));
  await page.route("https://api.postcodes.io/**", async (route) => {
    if (route.request().url().includes("EH1")) {
      await first;
      return route.fulfill({ json: { result: EDINBURGH } }).catch(() => undefined);
    }
    return route.fulfill({ json: { result: TRAFALGAR } });
  });
  const dialog = await openNearby(page);
  const input = dialog.getByRole("textbox", { name: "Postcode" });
  await input.fill("EH1 1YZ");
  await input.press("Enter");
  await expect(status(dialog)).toHaveText("Checking postcode…");
  await input.fill("WC2N 5DU");
  await input.press("Enter");
  await expect(status(dialog)).toContainText("of WC2N 5DU.");
  releaseFirst();
  // A device answer that arrives after the reader moved on is ignored too.
  await dialog.getByRole("button", { name: "Use my location", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(status(dialog)).toContainText("of WC2N 5DU.");
  await geo(page).succeed(EDINBURGH.latitude, EDINBURGH.longitude);
  // Any render from that stale answer settles before the next input event is handled.
  await dialog.getByLabel("Range", { exact: true }).selectOption("3");
  await expect(status(dialog)).toContainText("within 3 miles of WC2N 5DU.");
  await expect(dialog.getByRole("checkbox").first()).toBeVisible();
});

test("signed-in nearby search never saves over account cinemas", async ({ page }) => {
  const writes: string[] = [];
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "nearby-user",
          email: "fixture@example.com",
          username: null,
          pending: false,
          fetchedAt: null,
          digestWeekday: null,
        },
      },
    }),
  );
  await page.route("**/api/cinemas", (route) => {
    if (route.request().method() !== "POST") writes.push(route.request().method());
    return route.fulfill({ json: { venues: ["bfi.org.uk"], version: 4 } });
  });
  await page.route("https://api.postcodes.io/**", (route) =>
    route.fulfill({ json: { result: TRAFALGAR } }),
  );
  await page.goto("/?cinemas=mine");
  const mine = page
    .getByRole("group", { name: "Shortcuts" })
    .getByRole("button", { name: "My cinemas", exact: true });
  await expect(mine).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Edit cinemas", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Near me", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Find nearby cinemas", exact: true });
  await dialog.getByRole("textbox", { name: "Postcode" }).fill("WC2N 5DU");
  await dialog.getByRole("button", { name: "Find", exact: true }).click();
  await dialog.getByRole("checkbox").first().uncheck();
  await dialog.getByRole("button", { name: "Show films", exact: true }).click();
  await expect(mine).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Edit cinemas", exact: true })).toBeHidden();
  expect(new URL(page.url()).searchParams.getAll("venue").length).toBeGreaterThan(1);
  await mine.click();
  expect(new URL(page.url()).searchParams.getAll("venue")).toEqual(["bfi.org.uk"]);
  expect(writes).toEqual([]);
});

test("Cancel returns focus to the control that started the request", async ({ page }) => {
  await page.route("https://api.postcodes.io/**", () => {
    // Never answers: the postcode check stays in progress until cancelled.
  });
  const dialog = await openNearby(page);
  const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
  const locate = dialog.getByRole("button", { name: "Use my location", exact: true });
  await locate.click();
  await cancel.click();
  await expect(cancel).toBeHidden();
  await expect(locate).toBeFocused();

  const postcode = dialog.getByRole("textbox", { name: "Postcode" });
  await postcode.fill("WC2N 5DU");
  await dialog.getByRole("button", { name: "Find", exact: true }).click();
  await expect(status(dialog)).toContainText("Checking");
  await cancel.click();
  await expect(postcode).toBeFocused();
});

test("the cinema list does not move when Select all appears", async ({ page }) => {
  await page.route("https://api.postcodes.io/**", (route) =>
    route.fulfill({ json: { result: TRAFALGAR } }),
  );
  const dialog = await openNearby(page);
  const heading = dialog.locator(".nearby-finder-heading");
  const list = dialog.locator(".nearby-finder-list");
  const before = await Promise.all([heading.boundingBox(), list.boundingBox()]);
  await dialog.getByRole("textbox", { name: "Postcode" }).fill("WC2N 5DU");
  await dialog.getByRole("button", { name: "Find", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /^(Select|Clear) all$/ })).toBeVisible();
  const after = await Promise.all([heading.boundingBox(), list.boundingBox()]);
  expect(after[0]!.height).toBe(before[0]!.height);
  expect(after[1]!.y).toBe(before[1]!.y);
});
