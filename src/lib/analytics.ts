import "posthog-js/dist/web-vitals";
import posthog, { type CaptureResult } from "posthog-js/dist/module.no-external";
import {
  ANALYTICS_EVENTS,
  POSTHOG_HOST,
  POSTHOG_TOKEN,
  SITE_HOST,
  acquisition,
  safeAnalyticsProperties,
  safePath,
  type AnalyticsEvent,
  type AnalyticsProperties,
} from "../shared/analytics";

export const ANALYTICS_CHOICE_STORAGE = "london-cine.analytics-disabled.v1";
let optedOut = (() => {
  try {
    return localStorage.getItem(ANALYTICS_CHOICE_STORAGE) === "true";
  } catch {
    return false;
  }
})();
export function browserDoNotTrack() {
  return typeof navigator !== "undefined" && ["1", "yes"].includes(navigator.doNotTrack ?? "");
}
export function analyticsAllowed() {
  if (optedOut || browserDoNotTrack()) return false;
  try {
    return !initialized || !posthog.has_opted_out_capturing();
  } catch {
    return !optedOut;
  }
}
function applyAnalyticsAllowed(allowed: boolean) {
  optedOut = !allowed;
  try {
    if (!allowed) sessionStorage.removeItem("cine-analytics-visit");
  } catch {
    /* Collection still stops when storage is unavailable. */
  }
  try {
    if (allowed && !browserDoNotTrack() && !initialized) initAnalytics();
    if (initialized) {
      if (allowed && !browserDoNotTrack()) {
        // Clear a persisted SDK objection after reload and any stale account identity.
        posthog.reset(true);
        posthog.opt_in_capturing({ captureEventName: false });
        if (accountId) posthog.identify(`account:${accountId}`);
      } else posthog.opt_out_capturing();
    }
  } catch {
    /* The local guard still enforces the choice if the SDK fails. */
  }
  if (typeof window !== "undefined") window.dispatchEvent?.(new Event("cine-analytics-choice"));
}
export function setAnalyticsAllowed(allowed: boolean) {
  let saved = true;
  try {
    localStorage.setItem(ANALYTICS_CHOICE_STORAGE, String(!allowed));
  } catch {
    saved = false;
  }
  applyAnalyticsAllowed(allowed);
  return saved;
}
if (typeof window !== "undefined")
  window.addEventListener?.("storage", (event) => {
    if (event.key === ANALYTICS_CHOICE_STORAGE || event.key === null)
      applyAnalyticsAllowed(event.key !== ANALYTICS_CHOICE_STORAGE || event.newValue !== "true");
  });

let initialized = false;
let accountId: string | null = null;
let environment = "production";
let visit: AnalyticsProperties = {};

export function sanitizeCapture(event: CaptureResult | null): CaptureResult | null {
  if (
    !analyticsAllowed() ||
    !event ||
    (!(ANALYTICS_EVENTS as readonly string[]).includes(event.event) && event.event !== "$identify")
  )
    return null;
  return {
    uuid: event.uuid,
    event: event.event,
    timestamp: event.timestamp,
    properties: {
      ...safeAnalyticsProperties({
        ...event.properties,
        // SDK-generated events do not go through our capture() wrapper.
        // Web Vitals can flush after navigation: retain the measured page's route.
        ...(["$pageleave", "$web_vitals"].includes(event.event)
          ? { path: automaticEventPath(event.properties.$current_url) }
          : {}),
      }),
      environment,
      token: POSTHOG_TOKEN,
      $geoip_disable: true,
      $ip: null,
    },
  };
}

function automaticEventPath(url: unknown): string {
  try {
    return safePath(new URL(String(url)).pathname);
  } catch {
    return safePath(window.location.pathname);
  }
}

export function initAnalytics() {
  if (initialized || typeof window === "undefined" || !analyticsAllowed()) return;
  const test = import.meta.env.VITE_ANALYTICS_TEST === "1";
  if (!test && (!import.meta.env.PROD || window.location.hostname !== SITE_HOST)) return;
  environment = test ? "test" : "production";
  visit = acquisition(new URL(window.location.href), document.referrer);
  try {
    posthog.init(POSTHOG_TOKEN, {
      api_host: POSTHOG_HOST,
      opt_out_useragent_filter: test,
      ui_host: "https://eu.posthog.com",
      persistence: "localStorage",
      disable_compression: test,
      request_batching: !test,
      person_profiles: "identified_only",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: true,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      rageclick: false,
      capture_performance: { web_vitals: true, web_vitals_attribution: false },
      capture_exceptions: false,
      capture_webmcp: false,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      save_referrer: false,
      save_campaign_params: false,
      respect_dnt: true,
      before_send: sanitizeCapture,
    });
    initialized = true;
    // Keep acquisition stable across reloads within a visit, without saving URLs.
    try {
      const previous = JSON.parse(sessionStorage.getItem("cine-analytics-visit") ?? "null") as {
        at: number;
        visit: AnalyticsProperties;
      } | null;
      if (previous && previous.at > Date.now() - 30 * 60 * 1000 && visit.source === "direct")
        visit = safeAnalyticsProperties(previous.visit);
      sessionStorage.setItem("cine-analytics-visit", JSON.stringify({ at: Date.now(), visit }));
    } catch {
      /* Attribution still works when session storage is unavailable. */
    }
    // A persisted identified ID must be checked against the actual session before use.
    const id = posthog.get_distinct_id();
    if (id.startsWith("account:")) posthog.reset(true);
    if (accountId) posthog.identify(`account:${accountId}`);
  } catch {
    /* Analytics must never prevent the app from loading. */
  }
}

export function capture(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!initialized || !analyticsAllowed()) return;
  try {
    try {
      sessionStorage.setItem("cine-analytics-visit", JSON.stringify({ at: Date.now(), visit }));
    } catch {
      /* Optional attribution cache. */
    }
    posthog.capture(event, {
      ...visit,
      path: safePath(window.location.pathname),
      signed_in: accountId !== null,
      device_type: window.matchMedia("(max-width: 799px)").matches ? "mobile" : "desktop",
      ...properties,
    });
  } catch {
    /* Browsing continues if the SDK or storage is blocked. */
  }
}

export function identifyAccount(id: string | null) {
  if (accountId === id) return;
  const previous = accountId;
  accountId = id;
  if (!initialized || !analyticsAllowed()) return;
  try {
    if (previous !== null) posthog.reset(true);
    if (id) posthog.identify(`account:${id}`);
  } catch {
    /* Identity tracking is best effort. */
  }
}

export function analyticsHeaders(): Record<string, string> {
  if (!analyticsAllowed()) return { "X-Analytics-Enabled": "0" };
  if (!initialized) return {};
  try {
    return {
      "X-Analytics-Id": posthog.get_distinct_id(),
      "X-Analytics-Enabled": "1",
      "X-Analytics-Context": JSON.stringify({
        ...visit,
        $session_id: posthog.get_session_id(),
        device_type: window.matchMedia("(max-width: 799px)").matches ? "mobile" : "desktop",
      }),
    };
  } catch {
    return {};
  }
}

/**
 * The identity feedback is sent under: this browser's analytics ID (an opaque account ID when
 * signed in). Null when analytics is off here, so feedback never re-enables tracking.
 */
export function feedbackIdentity(): { distinctId: string; environment: string } | null {
  if (!initialized || !analyticsAllowed()) return null;
  try {
    return { distinctId: posthog.get_distinct_id(), environment };
  } catch {
    return null;
  }
}
