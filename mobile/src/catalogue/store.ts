import type { Catalogue } from "@readograph/core/catalogue-loader";
import type { DataManifest, FilmShowtimes } from "@readograph/core/data";
import {
  REFRESH_AFTER_MS,
  createShowtimeLoader,
  fetchManifest,
  isNewer,
  refreshCatalogue,
  type CatalogueCache,
  type CatalogueEntry,
  type Fetcher,
} from "./loader";

/**
 * The catalogue store: what the screens read. Plain TypeScript with a `subscribe` and
 * `getState` pair for `useSyncExternalStore`; `CatalogueProvider` wires it to React and to the
 * app's foreground events.
 */

export type CatalogueState = {
  /** The catalogue on screen: the cache at first, then each newer download. */
  catalogue: Catalogue | null;
  manifest: DataManifest | null;
  /** True until the cache has been read and, with no cache, the first download has ended. */
  loading: boolean;
  /** A download is running. The screen keeps showing `catalogue` meanwhile. */
  refreshing: boolean;
  /** Set when the last refresh failed; the screens show it only when there is no catalogue. */
  error: string | null;
  /** Rule 5: the published data needs a newer app. */
  updateRequired: boolean;
};

export type CatalogueStore = ReturnType<typeof createCatalogueStore>;

const OFFLINE = "The listings could not be loaded. Check your connection and try again.";

export function createCatalogueStore({
  fetcher,
  origin,
  cache,
  clock = () => Date.now(),
}: {
  fetcher: Fetcher;
  origin: string;
  cache: CatalogueCache;
  clock?: () => number;
}) {
  let state: CatalogueState = {
    catalogue: null,
    manifest: null,
    loading: true,
    refreshing: false,
    error: null,
    updateRequired: false,
  };
  let entry: CatalogueEntry | null = null;
  let lastCheck = 0;
  let running: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  function set(changes: Partial<CatalogueState>) {
    state = { ...state, ...changes };
    for (const listener of listeners) listener();
  }

  function show(next: CatalogueEntry) {
    // A slow cache read must not replace a newer download that finished first.
    if (entry && !isNewer(next.manifest, entry.manifest)) return;
    entry = next;
    showtimes.clear();
    set({ catalogue: next.catalogue, manifest: next.manifest });
  }

  const showtimes = createShowtimeLoader({
    fetcher,
    origin,
    manifest: () => state.manifest,
    refreshManifest: async () => {
      // A showtime file went missing, so a deploy replaced the data. Read the manifest itself
      // (a refresh already running may have read it before the deploy), use it for the retry,
      // and bring the catalogue up to it in the background.
      const fresh = await fetchManifest(fetcher, origin).catch(() => null);
      if (fresh && isNewer(fresh, state.manifest))
        void (async () => {
          await refresh();
          if (isNewer(fresh, state.manifest)) await refresh();
        })();
      return fresh;
    },
  });

  /** Rule 2 (and 4 and 5). Concurrent calls share one run. */
  function refresh(): Promise<void> {
    running ??= (async () => {
      lastCheck = clock();
      set({ refreshing: true });
      try {
        const result = await refreshCatalogue({ fetcher, origin, cache, current: entry });
        if (result.kind === "updated") show(result.entry);
        set({ error: null, updateRequired: result.kind === "update-app" });
      } catch {
        // Network, server or a file that stayed missing: keep what is on screen.
        set({ error: OFFLINE });
      } finally {
        set({ refreshing: false, loading: false });
        running = null;
      }
    })();
    return running;
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Rule 1 then rule 2: show the cache straight away, then check for newer listings. */
    async start() {
      const cached = await cache.read().catch(() => null);
      if (cached) {
        show(cached);
        set({ loading: false });
      }
      await refresh();
    },
    refresh,
    /** Rule 3: called when the app returns to the foreground. */
    foreground() {
      if (clock() - lastCheck >= REFRESH_AFTER_MS) return refresh();
      return Promise.resolve();
    },
    loadShowtimes: (id: string): Promise<FilmShowtimes> => showtimes.load(id),
  };
}
