import PostHog from "posthog-react-native";
import {
  ANALYTICS_EVENTS,
  POSTHOG_HOST,
  POSTHOG_TOKEN,
  safeAnalyticsProperties,
  type AnalyticsEvent,
  type AnalyticsProperties,
} from "@lci/core/analytics";
let client: PostHog | null = null;
let enabled = false;
let identity: string | null = null;
export function analyticsChoice(value: boolean) {
  enabled = value;
  if (value) {
    client ??= new PostHog(POSTHOG_TOKEN, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      preloadFeatureFlags: false,
      disableRemoteConfig: true,
      setDefaultPersonProperties: false,
      before_send: (event) => {
        if (
          !enabled ||
          (!(ANALYTICS_EVENTS as readonly string[]).includes(event.event) &&
            event.event !== "$identify")
        )
          return null;
        return {
          ...event,
          properties: {
            ...safeAnalyticsProperties(event.properties ?? {}),
            $geoip_disable: true,
            $ip: null,
          },
        };
      },
      disableGeoip: true,
    });
    client.optIn();
    if (identity) client.identify(`account:${identity}`);
  } else if (client) {
    client.optOut();
    client.reset();
  }
}
export function identify(value: string | null) {
  identity = value;
  if (enabled && client) {
    if (value) client.identify(`account:${value}`);
    else client.reset();
  }
}
export function capture(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (enabled)
    client?.capture(event, { ...safeAnalyticsProperties(properties), $geoip_disable: true });
}
export function analyticsHeaders(): Record<string, string> {
  return {
    "X-Analytics-Enabled": enabled ? "1" : "0",
    ...(enabled && identity ? { "X-Analytics-Id": `account:${identity}` } : {}),
  };
}
