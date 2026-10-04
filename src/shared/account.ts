export type Account = {
  id: string;
  email: string;
  username: string | null;
  digestWeekday: number | null;
  fetchedAt: number | null;
  count: number;
  stale: boolean;
  pending: boolean;
  sync?: SyncStatus;
};
export type Watchlist = {
  slugs: string[];
  fetchedAt: number | null;
  count: number;
  stale: boolean;
  username?: string | null;
  sync?: SyncStatus;
};
export const IMPORT_TIMEOUT = 30 * 60;
export type SyncStatus = {
  state: "idle" | "queued" | "importing" | "completed" | "failed";
  requestedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  retryAt: number | null;
  error: string | null;
};
export const IMPORT_ERRORS = {
  not_found:
    "Letterboxd could not find this watchlist. Check the username and make sure the list is public.",
  inaccessible:
    "Letterboxd did not let us read this watchlist. Make sure it is public, then try again later.",
  unavailable: "Letterboxd is unavailable or blocking requests. Please try again later.",
  incomplete:
    "The complete watchlist could not be read. It may have changed during import. Please try again later.",
  dispatch:
    "The import could not be queued. Please retry when available; daily sync will also try again.",
  stalled:
    "The import has not finished in time. Please retry when available; daily sync will also try again.",
  internal: "The import could not be completed. Please try again later.",
} as const;
export type ImportErrorCode = keyof typeof IMPORT_ERRORS;
export function safeImportError(code: string | null): string | null {
  return code ? (IMPORT_ERRORS[code as ImportErrorCode] ?? IMPORT_ERRORS.internal) : null;
}
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
