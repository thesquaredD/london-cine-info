import { test, expect, type Page, type Route } from "@playwright/test";
import { FEEDBACK_SURVEYS } from "@lci/core/feedback";

type Sent = { event: string; uuid?: string; properties: Record<string, unknown> };
const survey = FEEDBACK_SURVEYS.test;
const message = `$survey_response_${survey.questions.message}`;

/** Records every PostHog request; `respond` decides how the feedback endpoint answers. */
async function intercept(page: Page, respond: (route: Route) => Promise<void> | void = () => {}) {
  const feedback: Sent[] = [];
  const other: Sent[] = [];
  await page.context().route("https://works.london-cine.info/**", async (route) => {
    let body = route.request().postDataJSON();
    if (typeof body?.data === "string")
      body = JSON.parse(Buffer.from(body.data, "base64").toString("utf8"));
    const events: Sent[] = Array.isArray(body?.batch) ? body.batch : body?.event ? [body] : [];
    if (events.some((event) => event.event === "survey sent")) {
      feedback.push(...events);
      await respond(route);
      if (!route.request().failure())
        await route
          .fulfill({ status: 200, contentType: "application/json", body: '{"status":"Ok"}' })
          .catch(() => {});
      return;
    }
    other.push(...events);
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"status":1}' });
  });
  await page.route("**/api/me", (route) => route.fulfill({ json: { user: null } }));
  return { feedback, other };
}
async function openForm(page: Page) {
  await page.goto("/");
  await expect(page.locator(".film-row")).toHaveCount(6);
  await page.locator(".feedback-entry:visible").first().click();
  return page.locator("dialog.feedback-dialog");
}

test("only an explicit Send captures one survey response, with an acknowledged receipt", async ({
  page,
}) => {
  const { feedback, other } = await intercept(page);
  const dialog = await openForm(page);
  await dialog.getByRole("textbox", { name: "Your feedback" }).fill("Typed, then closed.");
  await page.keyboard.press("Escape");
  await page.locator(".feedback-entry:visible").first().click();
  await dialog.getByRole("button", { name: "Idea", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "I'd like a reply" }).check();
  await dialog.getByRole("textbox", { name: /Email/ }).fill("reply@example.com");
  expect(feedback).toEqual([]);

  await dialog.getByRole("button", { name: "Send" }).dblclick();
  await expect(dialog.getByRole("status")).toHaveText("Received. Thank you for taking the time.");
  expect(feedback).toHaveLength(1);
  const [sent] = feedback;
  expect(sent!.uuid).toBe(sent!.properties.$survey_submission_id);
  expect(sent!.properties).toMatchObject({
    $survey_id: survey.id,
    $survey_completed: true,
    [message]: "Typed, then closed.",
    [`$survey_response_${survey.questions.category}`]: "Idea",
    [`$survey_response_${survey.questions.email}`]: "reply@example.com",
    feedback_route: "/",
    environment: "test",
    $ip: null,
  });
  // Feedback text never leaks into ordinary analytics events.
  expect(JSON.stringify(other)).not.toContain("Typed, then closed.");
  expect(JSON.stringify(other)).not.toContain("reply@example.com");

  await dialog.getByRole("button", { name: "Back to browsing" }).click();
  await page.locator(".feedback-entry:visible").first().click();
  await expect(dialog.getByRole("textbox", { name: "Your feedback" })).toHaveValue("");
});

test("a failed send keeps the text, offers email, and a retry reuses the submission", async ({
  page,
}) => {
  let calls = 0;
  const { feedback } = await intercept(page, (route) =>
    ++calls === 1 ? route.fulfill({ status: 503 }) : undefined,
  );
  const dialog = await openForm(page);
  await dialog.getByRole("textbox", { name: "Your feedback" }).fill("Retry me.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByRole("alert")).toContainText("wasn’t sent");
  await expect(dialog.getByRole("textbox", { name: "Your feedback" })).toHaveValue("Retry me.");
  await expect(dialog.getByRole("link", { name: "Email feedback" })).toBeVisible();
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByRole("status")).toHaveText(/Received/);
  expect(feedback.map((event) => event.uuid)).toEqual([feedback[0]!.uuid, feedback[0]!.uuid]);
});

test("offline and blocked requests fail honestly", async ({ page, context }) => {
  const { feedback } = await intercept(page, (route) => route.abort("blockedbyclient"));
  const dialog = await openForm(page);
  await dialog.getByRole("textbox", { name: "Your feedback" }).fill("Blocked.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(dialog.getByRole("alert")).toContainText("wasn’t sent");
  expect(feedback).toHaveLength(1);
  await context.setOffline(true);
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByRole("alert")).toContainText("offline");
  expect(feedback).toHaveLength(1);
  await context.setOffline(false);
});

test("with analytics turned off the form offers email and leaves the choice alone", async ({
  page,
}) => {
  const { feedback } = await intercept(page);
  await page.addInitScript(() => localStorage.setItem("london-cine.analytics-disabled.v1", "true"));
  const dialog = await openForm(page);
  await dialog.getByRole("textbox", { name: "Your feedback" }).fill("No tracking please.");
  await expect(dialog.getByRole("status")).toContainText("analytics, which is off");
  await expect(dialog.getByRole("button", { name: "Send" })).toHaveCount(0);
  await expect(dialog.getByRole("textbox", { name: /Email/ })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("london-cine.analytics-disabled.v1"))).toBe(
    "true",
  );
  expect(feedback).toEqual([]);
});

test("Do Not Track also falls back to email", async ({ page }) => {
  const { feedback, other } = await intercept(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "1" }),
  );
  const dialog = await openForm(page);
  await expect(dialog.getByRole("status")).toContainText("analytics, which is off");
  expect([...feedback, ...other]).toEqual([]);
});

test("reply email is optional, cleared on uncheck, and Send fits the phone", async ({
  page,
}, info) => {
  await intercept(page);
  const dialog = await openForm(page);
  const choice = dialog.getByRole("checkbox", { name: "I'd like a reply" });
  const email = dialog.getByRole("textbox", { name: "Email, used only to answer this" });
  await expect(email).toHaveCount(0);
  await choice.check();
  await email.fill("optional@example.com");
  await choice.uncheck();
  await expect(email).toHaveCount(0);
  await choice.check();
  await expect(email).toHaveValue("");
  expect(
    (await dialog.getByRole("button", { name: "Send", exact: true }).boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: info.outputPath("feedback-reply.png") });
});
