// This is a public ingestion token, not a personal/admin API key.
export const POSTHOG_TOKEN = "phc_CzvNQdZeADVcaVpa2uH5svsvUPbNbFrwHUsHaTmjPZH3";
export const POSTHOG_HOST = "https://eu.i.posthog.com";
export const SITE_HOST = "london-cine.info";
export const ANALYTICS_VERSION = 1;

export const ANALYTICS_EVENTS = [
  "$pageview",
  "search_performed",
  "filters_changed",
  "watchlist_used",
  "film_opened",
  "booking_clicked",
  "screening_details_clicked",
  "catalogue_load_failed",
  "showtimes_load_failed",
  "account_opened",
  "sign_in_requested",
  "sign_in_verified",
  "signup_completed",
  "watchlist_connected",
  "watchlist_disconnected",
  "watchlist_import_requested",
  "watchlist_import_completed",
  "watchlist_import_failed",
  "digest_preference_changed",
  "account_deleted",
  "api_request_failed",
  "app_username_saved",
  "friends_digest_preference_changed",
  "friend_request_sent",
  "friend_request_accepted",
  "friend_request_cancelled",
  "friend_request_declined",
  "friend_removed",
  "shared_watchlists_used",
  "public_watchlist_import_requested",
  "public_watchlist_import_completed",
  "public_watchlist_import_failed",
  "public_watchlist_import_cancelled",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsProperties = Record<string, string | number | boolean | null | string[]>;

const propertyNames = new Set([
  "distinct_id",
  "$anon_distinct_id",
  "$device_id",
  "$user_id",
  "$is_identified",
  "$session_id",
  "$window_id",
  "$lib",
  "$lib_version",
  "$process_person_profile",
  "$current_url",
  "$pathname",
  "path",
  "environment",
  "analytics_version",
  "signed_in",
  "device_type",
  "source",
  "referrer_host",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "landing_path",
  "query",
  "result_count",
  "result_type",
  "filter_keys",
  "filter_values",
  "excluded_values",
  "filter_count",
  "watchlist",
  "tonight",
  "short",
  "film_gauge",
  "event_type",
  "film_id",
  "venue_id",
  "sold_out",
  "on_watchlist",
  "booking_fallback",
  "endpoint",
  "method",
  "status",
  "failure_kind",
  "duration_ms",
  "import_kind",
  "item_count",
  "first_import",
  "connected",
  "enabled",
  "weekday",
  "$insert_id",
  "shared_watchlists",
  "selected_friend_count",
  "public_watchlist_count",
  "all_friends",
  "match_mode",
  "first_setup",
]);

// Search text is intentional; credentials/contact details pasted into it are not.
export function analyticsText(value: string, limit = 200): string {
  return value
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(/\b(?:ph[cxs]_[A-Za-z0-9]+|[a-f0-9]{64})\b/gi, "[token]")
    .replace(/\p{Cc}/gu, " ")
    .trim()
    .slice(0, limit);
}

export function safeAnalyticsProperties(properties: Record<string, unknown>): AnalyticsProperties {
  const safe: AnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!propertyNames.has(key)) continue;
    if (typeof value === "string") safe[key] = analyticsText(value, key === "query" ? 200 : 160);
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "boolean" || value === null) safe[key] = value;
    else if (Array.isArray(value) && value.every((item) => typeof item === "string"))
      safe[key] = value.slice(0, 100).map((item) => analyticsText(item, 160));
  }
  // Never take these from browser URLs or user input.
  if (typeof properties.path === "string") {
    const path = safePath(properties.path);
    safe.path = path;
    safe.$pathname = path;
    safe.$current_url = `https://${SITE_HOST}${path}`;
  } else {
    delete safe.$current_url;
    delete safe.$pathname;
  }
  if (typeof safe.landing_path === "string") safe.landing_path = safePath(safe.landing_path);
  safe.analytics_version = ANALYTICS_VERSION;
  return safe;
}

const paths = new Set([
  "/",
  "/new",
  "/classics",
  "/retrospectives",
  "/events",
  "/calendar",
  "/watchlist",
  "/my-calendar",
  "/radar",
  "/about",
  "/privacy",
  "/auth/verify",
  "/unsubscribe",
]);
export function safePath(path: string): string {
  return paths.has(path) ? path : "/";
}

export function acquisition(url: URL, referrer: string): AnalyticsProperties {
  let referrerHost = "";
  try {
    referrerHost = new URL(referrer).hostname;
  } catch {
    /* Direct visit. */
  }
  if (referrerHost === url.hostname) referrerHost = "";
  const source = analyticsText(url.searchParams.get("utm_source") ?? "", 80);
  const searchEngine =
    /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|ecosia\.org)$/i.test(
      referrerHost,
    );
  return {
    source: source || (searchEngine ? "organic_search" : referrerHost ? "referral" : "direct"),
    referrer_host: analyticsText(referrerHost, 100),
    utm_source: source,
    utm_medium: analyticsText(url.searchParams.get("utm_medium") ?? "", 80),
    utm_campaign: analyticsText(url.searchParams.get("utm_campaign") ?? "", 80),
    landing_path: safePath(url.pathname),
  };
}
