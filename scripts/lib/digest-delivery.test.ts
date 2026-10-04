import { expect, it, vi } from "vitest";
import { deliverDigest, type Delivery } from "./digest-delivery";
import { sendEmailPayload, type EmailPayload } from "../../server/email";
const payload: EmailPayload = {
  from: "from@test.invalid",
  to: ["to@test.invalid"],
  subject: "New digest",
  text: "Plain",
  html: "<p>New template</p>",
};
const delivery = (): Delivery => ({
  user_id: "synthetic",
  london_day: "2026-10-04",
  username: "synthetic",
  idempotency_key: "digest-v2/stored-id",
  payload: JSON.stringify(payload),
  announced: JSON.stringify([{ slug: "film", lastScreeningAt: 2000 }]),
  created_at: 1000,
  attempted_at: 1000,
  delivered_at: null,
});
it("reuses the exact persisted message/key after provider acceptance and a failed D1 confirmation", async () => {
  const accepted = new Map<string, string>();
  // Model Resend's same-key/different-payload rejection and retry deduplication.
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    const key = (options.headers as Record<string, string>)["Idempotency-Key"]!;
    const body = options.body as string;
    if (accepted.has(key) && accepted.get(key) !== body)
      return new Response(JSON.stringify({ name: "invalid_idempotent_request" }), { status: 409 });
    accepted.set(key, body);
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", fetch);
  try {
    accepted.set(
      "legacy-account-day-key",
      JSON.stringify({ ...payload, html: undefined, subject: "Old digest" }),
    );
    const send = (payload: EmailPayload, key: string) => sendEmailPayload("test-key", payload, key);
    const complete = vi
      .fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValue(undefined);
    await expect(deliverDigest(delivery(), send, complete, 1100)).rejects.toThrow(
      "database unavailable",
    );
    // A rebuild could change titles/times/HTML. The stored payload is used instead.
    await expect(deliverDigest(delivery(), send, complete, 1500)).resolves.toBe(true);
    expect(fetch.mock.calls).toHaveLength(2);
    expect(fetch.mock.calls[0]![1].body).toBe(fetch.mock.calls[1]![1].body);
    expect(accepted.size).toBe(2); // one legacy email and one new email, not two new sends
    expect(complete).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("never marks alerts after failed sending and skips already-completed deliveries", async () => {
  const send = vi.fn().mockRejectedValue(new Error("provider unavailable"));
  const complete = vi.fn();
  await expect(deliverDigest(delivery(), send, complete, 1100)).rejects.toThrow(
    "provider unavailable",
  );
  expect(complete).not.toHaveBeenCalled();
  expect(
    await deliverDigest(
      { ...delivery(), delivered_at: 1200, payload: null, announced: null },
      send,
      complete,
      1500,
    ),
  ).toBe(false);
  expect(send).toHaveBeenCalledTimes(1);
});
it("refuses uncertain sends once the provider's deduplication window expires", async () => {
  const send = vi.fn(),
    complete = vi.fn();
  await expect(deliverDigest(delivery(), send, complete, 1000 + 86400)).rejects.toThrow("24-hour");
  expect(send).not.toHaveBeenCalled();
});
