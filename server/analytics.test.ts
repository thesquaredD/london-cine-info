import { afterEach, it, expect, vi } from "vitest";
import {
  requestAnalyticsEnabled,
  requestAnalyticsId,
  requestAnalyticsContext,
  sendAnalytics,
} from "./analytics";
afterEach(() => vi.unstubAllGlobals());
it("does not send server events from previews or when disabled", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await sendAnalytics(false, "account:opaque", "signup_completed");
  expect(fetcher).not.toHaveBeenCalled();
  expect(requestAnalyticsEnabled(new Request("https://preview.pages.dev/api/me"), "true")).toBe(
    false,
  );
  expect(requestAnalyticsEnabled(new Request("https://london-cine.info/api/me"), "false")).toBe(
    false,
  );
  expect(requestAnalyticsEnabled(new Request("https://london-cine.info/api/me"), "true")).toBe(
    true,
  );
});
it("sends only safe properties and isolates timeout/provider failures", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetcher);
  await sendAnalytics(true, "account:opaque", "watchlist_import_failed", {
    failure_kind: "inaccessible",
    email: "private@example.com",
    username: "private",
  });
  const payload = JSON.parse(fetcher.mock.calls[0]![1].body);
  expect(payload.properties).toMatchObject({
    distinct_id: "account:opaque",
    environment: "production",
    failure_kind: "inaccessible",
  });
  expect(payload.properties).not.toHaveProperty("email");
  expect(payload.properties).not.toHaveProperty("username");
  fetcher.mockRejectedValue(new Error("blocked"));
  await expect(sendAnalytics(true, "account:opaque", "signup_completed")).resolves.toBeUndefined();
});
it("treats client context as bounded telemetry and never as authentication", () => {
  const request = new Request("https://london-cine.info/api/me", {
    headers: {
      "X-Analytics-Id": "visitor-12345678",
      "X-Analytics-Context": JSON.stringify({
        source: "organic_search",
        landing_path: "/new",
        email: "private@example.com",
        signed_in: true,
      }),
    },
  });
  expect(requestAnalyticsId(request)).toBe("visitor-12345678");
  expect(requestAnalyticsContext(request)).toMatchObject({
    source: "organic_search",
    landing_path: "/new",
  });
  expect(requestAnalyticsContext(request)).not.toHaveProperty("signed_in");
  expect(requestAnalyticsContext(request)).not.toHaveProperty("email");
  expect(
    requestAnalyticsId(
      new Request(request.url, { headers: { "X-Analytics-Id": "private@example.com" } }),
    ),
  ).toBeNull();
});
