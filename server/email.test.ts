import { afterEach, expect, it, vi } from "vitest";
import { sendEmail } from "./email";
afterEach(() => vi.unstubAllGlobals());
it("sends HTML and plain text with delivery headers", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await sendEmail(
    "test-key",
    "from@test.invalid",
    "to@test.invalid",
    "Subject",
    "Plain",
    "batch",
    { "List-Unsubscribe": "<https://example.com/unsubscribe>" },
    "<p>HTML</p>",
  );
  const options = fetch.mock.calls[0]![1];
  expect(JSON.parse(options.body)).toEqual({
    from: "from@test.invalid",
    to: ["to@test.invalid"],
    subject: "Subject",
    text: "Plain",
    html: "<p>HTML</p>",
    headers: { "List-Unsubscribe": "<https://example.com/unsubscribe>" },
  });
  expect(options.headers["Idempotency-Key"]).toBe("batch");
});
it("keeps text-only sign-in emails compatible and rejects delivery failure", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("provider detail", { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  await expect(sendEmail("test-key", "from", "to", "Sign in", "Link", "auth")).rejects.toThrow(
    "Email delivery failed (503)",
  );
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).not.toHaveProperty("html");
});
