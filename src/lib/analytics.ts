import posthog, { type CaptureResult } from "posthog-js/dist/module.slim.no-external";
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

let initialized = false;
let accountId: string | null = null;
let environment = "production";
let visit: AnalyticsProperties = {};

export function sanitizeCapture(event: CaptureResult | null): CaptureResult | null {
  if (
    !event ||
    (!(ANALYTICS_EVENTS as readonly string[]).includes(event.event) && event.event !== "$identify")
  )
    return null;
  return {
    uuid: event.uuid,
    event: event.event,
    timestamp: event.timestamp,
    properties: {
      ...safeAnalyticsProperties(event.properties),
      environment,
      token: POSTHOG_TOKEN,
      $geoip_disable: true,
      $ip: null,
    },
  };
}

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
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
      capture_pageleave: false,
      disable_session_recording: true,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      rageclick: false,
      capture_performance: false,
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
  } catch {
    /* Analytics must never prevent the app from loading. */
  }
}

export function capture(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!initialized) return;
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
  if (!initialized || accountId === id) return;
  try {
    if (accountId !== null) posthog.reset(true);
    accountId = id;
    if (id) posthog.identify(`account:${id}`);
  } catch {
    /* Identity tracking is best effort. */
  }
}

export function analyticsHeaders(): Record<string, string> {
  if (!initialized) return {};
  if (posthog.has_opted_out_capturing()) return { "X-Analytics-Enabled": "0" };
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
