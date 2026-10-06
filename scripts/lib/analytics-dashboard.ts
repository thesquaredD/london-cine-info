// Query shapes follow PostHog's public query schema. No person properties required.
export const DASHBOARD_NAME = "London Cine — growth and friction";
const properties = [{ key: "environment", value: "production", operator: "exact", type: "event" }];
const base = { dateRange: { date_from: "-90d" }, properties, filterTestAccounts: false };
const entity = (event: string, math = "dau") => ({ kind: "EventsNode", event, math });
const viz = (source: Record<string, unknown>) => ({ kind: "InsightVizNode", source });
const trends = (events: string[], breakdown?: string, math = "dau") =>
  viz({
    ...base,
    kind: "TrendsQuery",
    interval: "week",
    series: events.map((event) => entity(event, math)),
    trendsFilter: { display: "ActionsLineGraph" },
    ...(breakdown ? { breakdownFilter: { breakdown, breakdown_type: "event" } } : {}),
  });
const funnel = (events: string[], days: number) =>
  viz({
    ...base,
    kind: "FunnelsQuery",
    series: events.map((event) => entity(event, "total")),
    funnelsFilter: {
      funnelOrderType: "ordered",
      funnelVizType: "steps",
      funnelWindowInterval: days,
      funnelWindowIntervalUnit: "day",
    },
  });
const table = (select: string, condition: string, group: string, order: string) => ({
  kind: "DataTableNode",
  source: {
    kind: "HogQLQuery",
    query: `SELECT ${select} FROM events WHERE properties.environment = 'production' AND timestamp >= now() - INTERVAL 90 DAY AND (${condition}) GROUP BY ${group} ORDER BY ${order} LIMIT 30`,
  },
});
export const dashboardInsights = [
  {
    name: "Weekly visitors",
    description:
      "Unique visitors, including your own visits. Browser identities are approximate people.",
    query: trends(["$pageview"]),
  },
  {
    name: "Acquisition sources",
    description:
      "Visit attribution: organic search, referral, direct or UTM source. Direct can include unattributed sharing.",
    query: trends(["$pageview"], "source"),
  },
  {
    name: "Landing pages",
    description: "Weekly unique visitors by their visit's first landing route.",
    query: trends(["$pageview"], "landing_path"),
  },
  {
    name: "New and returning visitors",
    description:
      "PostHog lifecycle: new, returning, resurrecting and dormant browser/account identities.",
    query: viz({
      ...base,
      kind: "LifecycleQuery",
      interval: "week",
      series: [entity("$pageview")],
    }),
  },
  {
    name: "Weekly retention",
    description:
      "First visit cohorts returning in subsequent weeks. Starts accumulating after deployment.",
    query: viz({
      ...base,
      kind: "RetentionQuery",
      retentionFilter: {
        retentionType: "retention_first_time",
        period: "Week",
        totalIntervals: 8,
        targetEntity: { id: "$pageview", type: "events" },
        returningEntity: { id: "$pageview", type: "events" },
        retentionReference: "total",
        dashboardDisplay: "table_only",
      },
    }),
  },
  {
    name: "Meaningful feature use",
    description:
      "Weekly unique users of discovery, booking and watchlists. Booking clicks are intent, not confirmed purchases.",
    query: trends(["film_opened", "booking_clicked", "watchlist_used", "shared_watchlists_used"]),
  },
  {
    name: "Discovery to booking",
    description:
      "Ordered visitor → film details → booking click within one day. Other booking paths are possible.",
    query: funnel(["$pageview", "film_opened", "booking_clicked"], 1),
  },
  {
    name: "Account and watchlist growth",
    description:
      "Verified new accounts (existing accounts excluded), connections and first/subsequent successful imports.",
    query: trends(
      ["signup_completed", "watchlist_connected", "watchlist_import_completed"],
      undefined,
      "total",
    ),
  },
  {
    name: "Account activation",
    description:
      "Sign-in request → verified → connected → imported → used within seven days. Existing connected users may skip steps.",
    query: funnel(
      [
        "sign_in_requested",
        "sign_in_verified",
        "watchlist_connected",
        "watchlist_import_completed",
        "watchlist_used",
      ],
      7,
    ),
  },
  {
    name: "Search friction",
    description:
      "Settled search text, zero-result count and average matches. Contact details, URLs and common tokens are redacted.",
    query: table(
      "properties.query AS query, count() AS searches, countIf(properties.result_count = 0) AS zero_results, avg(toFloat(properties.result_count)) AS average_matches",
      "event = 'search_performed'",
      "query",
      "searches DESC",
    ),
  },
  {
    name: "Filters with no results",
    description:
      "Most frequent zero-result filter combinations, including shared watchlist counts without identities.",
    query: table(
      "properties.path AS page, properties.filter_values AS filters, properties.excluded_values AS excluded, properties.shared_watchlists AS shared, count() AS occurrences",
      "event = 'filters_changed' AND properties.result_count = 0",
      "page, filters, excluded, shared",
      "occurrences DESC",
    ),
  },
  {
    name: "Watchlist import health",
    description:
      "Successful and failed connected/public imports; repeated failures reveal friction.",
    query: trends(
      [
        "watchlist_import_completed",
        "watchlist_import_failed",
        "public_watchlist_import_completed",
        "public_watchlist_import_failed",
      ],
      undefined,
      "total",
    ),
  },
  {
    name: "Import speed",
    description:
      "Average milliseconds for committed imports, separated by manual/scheduled/public and outcome.",
    query: table(
      "event, properties.import_kind AS kind, count() AS imports, avg(toFloat(properties.duration_ms)) AS average_ms",
      "event IN ('watchlist_import_completed', 'watchlist_import_failed', 'public_watchlist_import_completed', 'public_watchlist_import_failed')",
      "event, kind",
      "imports DESC",
    ),
  },
  {
    name: "API and loading failures",
    description:
      "Only controlled endpoint/status/failure categories; no raw error messages or request URLs.",
    query: table(
      "event, properties.endpoint AS endpoint, properties.status AS status, properties.failure_kind AS category, count() AS failures",
      "event IN ('api_request_failed', 'catalogue_load_failed', 'showtimes_load_failed')",
      "event, endpoint, status, category",
      "failures DESC",
    ),
  },
  {
    name: "Friends and shared discovery",
    description:
      "Weekly unique actors. Request and acceptance are counts, not a conversion funnel: they involve different people.",
    query: trends([
      "friend_request_sent",
      "friend_request_accepted",
      "shared_watchlists_used",
      "public_watchlist_import_completed",
    ]),
  },
];
