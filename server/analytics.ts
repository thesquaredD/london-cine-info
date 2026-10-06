import {
  POSTHOG_HOST,
  POSTHOG_TOKEN,
  SITE_HOST,
  safeAnalyticsProperties,
  type AnalyticsEvent,
  type AnalyticsProperties,
} from "../src/shared/analytics";

// Also used by the Node importer. Safe properties are the entire payload: no headers, raw
// request URLs, provider messages, usernames, emails, cookies or database rows.
export async function sendAnalytics(
  enabled: boolean,
  id: string,
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
) {
  if (!enabled) return;
  try {
    const response = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_TOKEN,
        event,
        properties: {
          ...safeAnalyticsProperties(properties),
          distinct_id: id,
          environment: "production",
          $geoip_disable: true,
          $ip: null,
          $process_person_profile: false,
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) console.warn("Analytics delivery failed", response.status);
  } catch {
    console.warn("Analytics delivery unavailable");
  }
}

export function requestAnalyticsEnabled(request: Request, enabled?: string): boolean {
  return enabled === "true" && new URL(request.url).hostname === SITE_HOST;
}
export function requestAnalyticsId(request: Request): string | null {
  const value = request.headers.get("X-Analytics-Id") ?? "";
  return /^(?:account:)?[a-zA-Z0-9_-]{8,80}$/.test(value) && !value.includes("@") ? value : null;
}

export function requestAnalyticsContext(request: Request): AnalyticsProperties {
  const raw = request.headers.get("X-Analytics-Context") ?? "";
  if (!raw || raw.length > 1600) return {};
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const keys = [
      "source",
      "referrer_host",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "landing_path",
      "$session_id",
      "device_type",
    ];
    return safeAnalyticsProperties(
      Object.fromEntries(
        keys.filter((key) => typeof data[key] === "string").map((key) => [key, data[key]]),
      ),
    );
  } catch {
    return {};
  }
}
