import { it, expect, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  instances: [] as { options: Record<string, unknown> }[],
  capture: vi.fn(),
  optIn: vi.fn(),
  optOut: vi.fn(),
  reset: vi.fn(),
  identify: vi.fn(),
}));
vi.mock("posthog-react-native", () => ({
  default: class {
    capture = sdk.capture;
    optIn = sdk.optIn;
    optOut = sdk.optOut;
    reset = sdk.reset;
    identify = sdk.identify;
    constructor(_token: string, options: Record<string, unknown>) {
      sdk.instances.push({ options });
    }
  },
}));
import { analyticsChoice, analyticsHeaders, capture, identify } from "./analytics";
it("makes no SDK instance until opt-in, redacts SDK-added properties, and drops queued events after opt-out", () => {
  capture("film_opened", { film_id: "a" });
  expect(sdk.instances).toHaveLength(0);
  expect(analyticsHeaders()["X-Analytics-Enabled"]).toBe("0");
  identify("test-user");
  analyticsChoice(true);
  expect(sdk.instances).toHaveLength(1);
  expect(sdk.identify).toHaveBeenCalledWith("account:test-user");
  const options = sdk.instances[0]!.options;
  expect(options).toMatchObject({
    enableSessionReplay: false,
    captureAppLifecycleEvents: false,
    preloadFeatureFlags: false,
    disableGeoip: true,
  });
  const before = options.before_send as (event: {
    event: string;
    properties: Record<string, unknown>;
  }) => { properties: Record<string, unknown> } | null;
  const clean = before({
    event: "film_opened",
    properties: { film_id: "a", email: "private@example.com", session: "secret", latitude: 51.5 },
  })!;
  expect(JSON.stringify(clean)).not.toContain("private");
  expect(clean.properties).not.toHaveProperty("session");
  expect(clean.properties).not.toHaveProperty("latitude");
  expect(before({ event: "$autocapture", properties: {} })).toBeNull();
  analyticsChoice(false);
  capture("film_opened");
  expect(sdk.capture).not.toHaveBeenCalled();
  expect(before({ event: "film_opened", properties: {} })).toBeNull();
  expect(analyticsHeaders()["X-Analytics-Enabled"]).toBe("0");
});
