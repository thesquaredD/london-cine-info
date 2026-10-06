import { DASHBOARD_NAME, dashboardInsights } from "./lib/analytics-dashboard";

const host = "https://eu.posthog.com";
const root = `${host}/api/projects/296412/`;
if (process.argv.includes("--print")) {
  console.log(JSON.stringify({ name: DASHBOARD_NAME, insights: dashboardInsights }, null, 2));
} else {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key)
    throw new Error(
      "Set POSTHOG_PERSONAL_API_KEY locally (dashboard and insight read/write scopes), or use --print. Never commit the key.",
    );
  type Resource = { id: number; name?: string; dashboards?: number[]; deleted?: boolean };
  async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
    if (!url.startsWith(root))
      throw new Error("Refusing to send credentials outside the project API");
    const response = await fetch(url, {
      method,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`PostHog ${method} failed (${response.status})`);
    return (await response.json()) as T;
  }
  async function list(path: string) {
    const all: Resource[] = [];
    let next: string | null = `${root}${path}/?limit=100`;
    while (next) {
      const page: { results: Resource[]; next: string | null } = await api(next);
      all.push(...page.results.filter((resource) => !resource.deleted));
      next = page.next;
    }
    return all;
  }
  const dashboards = await list("dashboards");
  const dashboard =
    dashboards.find((item) => item.name === DASHBOARD_NAME) ??
    (await api<Resource>(`${root}dashboards/`, "POST", {
      name: DASHBOARD_NAME,
      description:
        "Organic growth, retention and feature friction. Production only; no replay. Managed by scripts/setup-analytics-dashboard.ts.",
      tags: ["london-cine-analytics"],
    }));
  const insights = await list("insights");
  for (const [order, insight] of dashboardInsights.entries()) {
    const existing = insights.find(
      (item) => item.name === insight.name && item.dashboards?.includes(dashboard.id),
    );
    await api(
      existing ? `${root}insights/${existing.id}/` : `${root}insights/`,
      existing ? "PATCH" : "POST",
      {
        ...insight,
        order,
        saved: true,
        dashboards: existing?.dashboards ?? [dashboard.id],
        tags: ["london-cine-analytics"],
      },
    );
  }
  console.log(`${host}/project/296412/dashboard/${dashboard.id}`);
}
