import { it, expect, vi } from "vitest";
import { createSession, type Credentials } from "./client";
const credentials: Credentials = {
  session: "a".repeat(64),
  userId: "native-user",
  expiresAt: Math.floor(Date.now() / 1000) + 86400,
};
it("restores a secure session, sends bearer and analytics headers, and clears it on 401", async () => {
  const write = vi.fn(),
    transport = vi.fn(
      async () => new Response(JSON.stringify({ error: "expired" }), { status: 401 }),
    );
  const store = createSession({ read: async () => credentials, write }, transport, () => ({
    "X-Analytics-Enabled": "0",
  }));
  await store.restore();
  await expect(store.api("/api/calendar")).rejects.toThrow("Your session has expired");
  expect(transport.mock.calls[0]![1]).toMatchObject({
    credentials: "omit",
    headers: { Authorization: `Bearer ${credentials.session}`, "X-Analytics-Enabled": "0" },
  });
  expect(store.getSnapshot()).toBeNull();
  expect(write).toHaveBeenCalledWith(null);
});
it("discards expired credentials and never publishes a token if secure storage fails", async () => {
  const write = vi.fn(),
    store = createSession({ read: async () => ({ ...credentials, expiresAt: 1 }), write });
  await store.restore();
  expect(store.getSnapshot()).toBeNull();
  const failed = createSession({
    read: async () => null,
    write: async () => {
      throw new Error("locked");
    },
  });
  await expect(failed.accept(credentials)).rejects.toThrow("locked");
  expect(failed.getSnapshot()).toBeNull();
});
it("an old in-flight response cannot clear a newly signed-in session", async () => {
  let finish!: (value: Response) => void;
  const store = createSession(
    { read: async () => credentials, write: async () => {} },
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  await store.restore();
  const request = store.api("/api/calendar");
  await store.accept({ ...credentials, session: "b".repeat(64), userId: "other-user" });
  finish(new Response("{}", { status: 401 }));
  await expect(request).rejects.toThrow("expired");
  expect(store.getSnapshot()!.userId).toBe("other-user");
});
it("handles network, malformed responses and cooldowns with safe messages", async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new Error("secret"))
    .mockResolvedValueOnce(new Response("<html>"))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Please retry later" }), {
        status: 429,
        headers: { "Retry-After": "30" },
      }),
    );
  const store = createSession({ read: async () => null, write: async () => {} }, transport);
  await expect(store.api("/api/me")).rejects.toThrow("could not reach");
  await expect(store.api("/api/me")).rejects.toThrow("unexpected response");
  await expect(store.api("/api/me")).rejects.toMatchObject({
    status: 429,
    retryAt: expect.any(Number),
  });
});

it("serializes secure writes so a renewal in progress cannot restore a signed-out token", async () => {
  let unblock!: () => void;
  let saved: Credentials | null = credentials;
  const storage = {
    read: async () => saved,
    write: vi.fn(async (value: Credentials | null) => {
      if (value)
        await new Promise<void>((resolve) => {
          unblock = resolve;
        });
      saved = value;
    }),
  };
  const store = createSession(
    storage,
    vi.fn(async () => new Response(JSON.stringify({ user: { id: credentials.userId } }))),
  );
  await store.restore();
  const renewal = store.api("/api/me");
  await vi.waitFor(() => expect(storage.write).toHaveBeenCalledTimes(1));
  const clear = store.clear();
  unblock();
  await expect(renewal).rejects.toThrow("account changed");
  await clear;
  expect(saved).toBeNull();
  expect(store.getSnapshot()).toBeNull();
});
