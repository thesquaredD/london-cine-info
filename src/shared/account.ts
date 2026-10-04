export type Account = {
  id: string;
  email: string;
  username: string | null;
  digestWeekday: number | null;
  fetchedAt: number | null;
  count: number;
  stale: boolean;
  pending: boolean;
};
export type Watchlist = {
  slugs: string[];
  fetchedAt: number | null;
  count: number;
  stale: boolean;
};
export function letterboxdSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "letterboxd.com" || parsed.hostname === "www.letterboxd.com"
      ? (/^\/film\/([a-z0-9-]+)\/?$/.exec(parsed.pathname)?.[1] ?? null)
      : null;
  } catch {
    return null;
  }
}
