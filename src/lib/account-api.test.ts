import { afterEach, expect, it, vi } from "vitest";
import { accountApi } from "./account";
afterEach(() => vi.restoreAllMocks());
it("turns network and non-JSON service failures into safe recoverable messages", async () => {
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new TypeError("private network detail"));
  await expect(accountApi("/api/friends")).rejects.toMatchObject({
    status: 0,
    message: "We could not reach the account service. Check your connection and try again.",
  });
  request.mockResolvedValue(new Response("<h1>private proxy detail</h1>", { status: 503 }));
  await expect(accountApi("/api/friends")).rejects.toMatchObject({
    status: 503,
    message: "The account service returned an unexpected response. Please try again later.",
  });
});
it("preserves session and retry information without exposing upstream authentication details", async () => {
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ error: "private auth detail" }), { status: 401 }),
    );
  await expect(accountApi("/api/friends")).rejects.toMatchObject({
    status: 401,
    message: "Your session has expired. Please sign in again.",
  });
  vi.spyOn(Date, "now").mockReturnValue(1_000_000);
  request.mockResolvedValue(
    new Response(JSON.stringify({ error: "Please retry shortly." }), {
      status: 429,
      headers: { "Retry-After": "3" },
    }),
  );
  await expect(
    accountApi("/api/watchlists/public", "POST", { username: "peer" }),
  ).rejects.toMatchObject({ status: 429, retryAt: 1003 });
});
it("passes cancellation into the request and reports an interrupted request safely", async () => {
  const controller = new AbortController();
  controller.abort();
  const request = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    expect(init?.signal?.aborted).toBe(true);
    throw new DOMException("private abort detail", "AbortError");
  });
  await expect(
    accountApi("/api/watchlists/public", "POST", { username: "peer" }, controller.signal),
  ).rejects.toMatchObject({ status: 0 });
  expect(request).toHaveBeenCalledTimes(1);
});
