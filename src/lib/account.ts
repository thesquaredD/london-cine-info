import { useCallback, useEffect, useState, useRef } from "preact/hooks";
import type { Account, Watchlist } from "../shared/account";
export class AccountError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAt: number | null = null,
  ) {
    super(message);
  }
}
export async function accountApi<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new AccountError(
      "We could not reach the account service. Check your connection and try again.",
    );
  }
  let data: Record<string, unknown>;
  try {
    data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
  } catch {
    throw new AccountError(
      "The account service returned an unexpected response. Please try again later.",
      response.status,
    );
  }
  if (!response.ok) {
    const retry = response.headers.get("Retry-After");
    const retryAt = retry
      ? /^\d+$/.test(retry)
        ? Date.now() / 1000 + Number(retry)
        : Date.parse(retry) / 1000
      : null;
    throw new AccountError(
      response.status === 401
        ? "Your session has expired. Please sign in again."
        : typeof data.error === "string"
          ? data.error
          : "The request failed. Please try again later.",
      response.status,
      retryAt && Number.isFinite(retryAt) ? retryAt : null,
    );
  }
  return data as T;
}
export type AccountNotice = {
  kind: "success" | "error";
  message: string;
  retryAt?: number | null;
  action?: string;
};
export function useAccount() {
  const [user, setUser] = useState<Account | null>(null);
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<AccountNotice | null>(null);
  const [busy, setBusy] = useState("");
  const generation = useRef(0);
  const identity = useRef<string | null>(null);
  const actionLock = useRef(false);
  const clear = useCallback(() => {
    generation.current++;
    identity.current = null;
    setUser(null);
    setWatchlist(null);
    setError("");
  }, []);
  const reload = useCallback(
    async (retry = true): Promise<void> => {
      const current = ++generation.current;
      try {
        const result = await accountApi<{ user: Account | null }>("/api/me");
        if (
          !("user" in result) ||
          (result.user &&
            (typeof result.user.id !== "string" || typeof result.user.pending !== "boolean"))
        )
          throw new AccountError("Account data could not be read. Please try again.");
        if (current !== generation.current) return;
        const nextIdentity = result.user ? `${result.user.id}:${result.user.username}` : null;
        if (identity.current && !result.user)
          setNotice({ kind: "error", message: "Your session has expired. Please sign in again." });
        if (nextIdentity !== identity.current) setWatchlist(null);
        identity.current = nextIdentity;
        setUser(result.user);
        if (!result.user) {
          setWatchlist(null);
          setError("");
          return;
        }
        const list = await accountApi<Watchlist>("/api/watchlist");
        if (current !== generation.current) return;
        if (
          !Array.isArray(list.slugs) ||
          !list.slugs.every((slug) => typeof slug === "string") ||
          typeof list.count !== "number"
        )
          throw new AccountError("Watchlist data could not be read. Please try again.");
        // Settings and imports can change between the two API requests.
        if (
          (list.username !== undefined && list.username !== result.user.username) ||
          list.fetchedAt !== result.user.fetchedAt
        ) {
          if (retry) return reload(false);
          setError("Your watchlist changed while loading. Check status to load the latest data.");
          return;
        }
        setWatchlist(list);
        if (list.sync)
          setUser({
            ...result.user,
            sync: list.sync,
            pending: ["queued", "importing"].includes(list.sync.state),
            stale: list.stale,
          });
        setError("");
      } catch (failure) {
        if (current !== generation.current) return;
        if (failure instanceof AccountError && failure.status === 401) {
          clear();
          setNotice({ kind: "error", message: failure.message });
        } else
          setError(
            failure instanceof Error
              ? failure.message
              : "Account service is unavailable. You can still browse screenings.",
          );
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [clear],
  );
  const perform = useCallback(
    async (name: string, work: () => Promise<void>, message: string) => {
      if (actionLock.current) return false;
      actionLock.current = true;
      setBusy(name);
      setNotice(null);
      try {
        await work();
        setNotice({ kind: "success", message });
        return true;
      } catch (failure) {
        if (failure instanceof AccountError && failure.status === 401) clear();
        setNotice({
          kind: "error",
          action: name,
          message: failure instanceof Error ? failure.message : "Please try again later.",
          retryAt: failure instanceof AccountError ? failure.retryAt : null,
        });
        return false;
      } finally {
        actionLock.current = false;
        setBusy("");
      }
    },
    [clear],
  );
  useEffect(() => {
    void reload();
    return () => {
      generation.current++;
    };
  }, [reload]);
  const refresh = useCallback(() => reload(), [reload]);
  useEffect(() => {
    // Refresh status after returning to this tab; polling stops at a terminal server state.
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    const interval = user?.pending
      ? window.setInterval(() => {
          if (!document.hidden) void refresh();
        }, 15000)
      : null;
    return () => {
      window.removeEventListener("focus", focus);
      if (interval) window.clearInterval(interval);
    };
  }, [user?.pending, refresh]);
  return {
    user,
    watchlist,
    loading,
    error,
    notice,
    busy,
    reload: refresh,
    perform,
    clear,
    dismissNotice: () => setNotice(null),
  };
}
export type AccountState = ReturnType<typeof useAccount>;
