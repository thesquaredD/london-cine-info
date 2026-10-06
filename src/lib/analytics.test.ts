import { afterEach, beforeEach, it, expect, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  get_distinct_id: vi.fn(() => "visitor-12345678"),
  get_session_id: vi.fn(() => "session-12345678"),
  has_opted_out_capturing: vi.fn(() => false),
}));
vi.mock("posthog-js/dist/module.slim.no-external", () => ({ default: sdk }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("window", {
    location: new URL("http://localhost/new?token=private"),
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal("document", { referrer: "https://www.google.com/search?q=private" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("keeps local browsing disabled by default", async () => {
  const analytics = await import("./analytics");
  analytics.initAnalytics();
  analytics.capture("film_opened", { film_id: "1" });
  expect(sdk.init).not.toHaveBeenCalled();
  expect(sdk.capture).not.toHaveBeenCalled();
});
it("uses explicit events, labels tests, strips accidental properties and resets identities", async () => {
  vi.stubEnv("VITE_ANALYTICS_TEST", "1");
  const analytics = await import("./analytics");
  analytics.initAnalytics();
  expect(sdk.init.mock.calls[0]![1]).toMatchObject({
    autocapture: false,
    disable_session_recording: true,
    capture_pageview: false,
    advanced_disable_flags: true,
  });
  analytics.identifyAccount("user-one");
  analytics.identifyAccount("user-one");
  expect(sdk.identify).toHaveBeenCalledTimes(1);
  analytics.identifyAccount("user-two");
  analytics.identifyAccount(null);
  expect(sdk.reset).toHaveBeenCalledTimes(2);
  const result = analytics.sanitizeCapture({
    uuid: "event-one",
    event: "film_opened",
    properties: {
      distinct_id: "visitor-12345678",
      path: "/new",
      email: "private@example.com",
      $current_url: "https://example.com?token=private",
    },
  });
  expect(result?.properties).toMatchObject({
    environment: "test",
    path: "/new",
    $current_url: "https://london-cine.info/new",
  });
  expect(result?.properties).not.toHaveProperty("email");
  expect(
    analytics.sanitizeCapture({ uuid: "event-two", event: "$autocapture", properties: {} }),
  ).toBeNull();
});
it("does not throw when the SDK fails or capturing is opted out", async () => {
  vi.stubEnv("VITE_ANALYTICS_TEST", "1");
  const analytics = await import("./analytics");
  analytics.initAnalytics();
  sdk.capture.mockImplementationOnce(() => {
    throw new Error("storage blocked");
  });
  expect(() => analytics.capture("$pageview")).not.toThrow();
  sdk.has_opted_out_capturing.mockReturnValueOnce(true);
  expect(analytics.analyticsHeaders()).toEqual({ "X-Analytics-Enabled": "0" });
});
