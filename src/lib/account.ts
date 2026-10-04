import { useCallback, useEffect, useState, useRef } from "preact/hooks";
import type { Account, Watchlist } from "../shared/account";
export async function accountApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed. Please try again.");
  return data as T;
}
export function useAccount() {
  const [user, setUser] = useState<Account | null>(null);
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setError("");
    try {
      const result = await accountApi<{ user: Account | null }>("/api/me");
      const list = result.user ? await accountApi<Watchlist>("/api/watchlist") : null;
      if (current !== generation.current) return;
      setUser(result.user);
      setWatchlist(list);
    } catch {
      if (current !== generation.current) return;
      setError("Account service is unavailable. You can still browse screenings.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (!user?.pending) return;
    const interval = window.setInterval(() => {
      void reload();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [user?.pending, reload]);
  return { user, watchlist, loading, error, reload };
}
export type AccountState = ReturnType<typeof useAccount>;
