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
vi.mock("posthog-js/dist/module.no-external", () => ({ default: sdk }));
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
    capture_pageleave: true,
    capture_performance: { web_vitals: true, web_vitals_attribution: false },
    api_host: "https://works.london-cine.info",
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

it("keeps automatic measurements and their original route while stripping URLs and attribution", async () => {
  const { sanitizeCapture } = await import("./analytics");
  const result = sanitizeCapture({
    uuid: "vitals-one",
    event: "$web_vitals",
    properties: {
      $current_url: "https://london-cine.info/classics?token=private-token",
      $web_vitals_LCP_value: 1234,
      $web_vitals_INP_value: 80,
      $web_vitals_CLS_value: 0.02,
      $web_vitals_FCP_value: 500,
      $web_vitals_LCP_event: { attribution: { url: "private-token" } },
      $pageview_id: "page-one",
      $session_id: "session-one",
    },
  });
  expect(result?.properties).toMatchObject({
    path: "/classics",
    $current_url: "https://london-cine.info/classics",
    $web_vitals_LCP_value: 1234,
    $web_vitals_INP_value: 80,
    $web_vitals_CLS_value: 0.02,
    $web_vitals_FCP_value: 500,
    $pageview_id: "page-one",
    $session_id: "session-one",
  });
  expect(JSON.stringify(result)).not.toContain("private-token");
  expect(result?.properties).not.toHaveProperty("$web_vitals_LCP_event");
  const leave = sanitizeCapture({
    uuid: "leave-one",
    event: "$pageleave",
    properties: {
      $current_url: "https://london-cine.info/new?token=private-token",
      $prev_pageview_pathname: "/private/secret",
      $prev_pageview_id: "page-one",
      $prev_pageview_duration: 12,
      $prev_pageview_max_scroll_percentage: 0.5,
    },
  });
  expect(leave?.properties).toMatchObject({
    path: "/new",
    $prev_pageview_pathname: "/",
    $prev_pageview_id: "page-one",
    $prev_pageview_duration: 12,
    $prev_pageview_max_scroll_percentage: 0.5,
  });
});
