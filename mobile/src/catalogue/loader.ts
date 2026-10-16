import type { DataManifest, Film, DataMeta, EventOccurrence, FilmShowtimes } from "@lci/core/data";
import {
  CatalogueVersionError,
  validateCatalogue,
  validateManifest,
  validateShowtimes,
  resolveDataUrl,
} from "@lci/core/catalogue-loader";
import { createStore } from "../store";
export const SITE = "https://london-cine.info";
export type Catalogue = {
  manifest: DataManifest;
  films: Film[];
  meta: DataMeta;
  events: EventOccurrence[];
};
export type CatalogueCache = {
  read(): Promise<Catalogue | null>;
  write(data: Catalogue): Promise<void>;
};
export type CatalogueState = {
  data: Catalogue | null;
  loading: boolean;
  notice: string;
  updateRequired: boolean;
};
export class HttpError extends Error {
  constructor(public status: number) {
    super(`The data request returned HTTP ${status}.`);
  }
}
export function createCatalogue(
  cache: CatalogueCache,
  read: (url: string) => Promise<unknown>,
  base = SITE,
) {
  const store = createStore<CatalogueState>({
    data: null,
    loading: true,
    notice: "",
    updateRequired: false,
  });
  let refreshWork: Promise<void> | null = null;
  let lastRefresh = 0;
  const details = new Map<string, Promise<FilmShowtimes>>();
  const getManifest = async () => {
    const value = await read(`${base}/catalogue.json`);
    validateManifest(value);
    return value;
  };
  const refresh = (): Promise<void> => {
    if (refreshWork) return refreshWork;
    store.set({ ...store.getSnapshot(), loading: true });
    refreshWork = (async () => {
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const manifest = await getManifest();
          const current = store.getSnapshot().data;
          if (
            current &&
            Date.parse(manifest.generatedAt) <= Date.parse(current.manifest.generatedAt)
          ) {
            store.set({
              ...store.getSnapshot(),
              loading: false,
              notice: "",
              updateRequired: false,
            });
            lastRefresh = Date.now();
            return;
          }
          try {
            const [films, meta, events] = await Promise.all(
              [manifest.films, manifest.meta, manifest.events].map((path) =>
                read(resolveDataUrl(base, path)),
              ),
            );
            const data = { manifest, ...validateCatalogue(manifest, films, meta, events) };
            // No partial catalogue becomes visible. Persist one complete validated generation.
            let notice = "";
            try {
              await cache.write(data);
            } catch {
              notice = "Listings loaded, but could not be saved for the next launch.";
            }
            details.clear();
            store.set({ data, loading: false, notice, updateRequired: false });
            lastRefresh = Date.now();
            return;
          } catch (error) {
            if (!(error instanceof HttpError && error.status === 404 && attempt === 0)) throw error;
          }
        }
      } catch (error) {
        store.set({
          ...store.getSnapshot(),
          loading: false,
          updateRequired: error instanceof CatalogueVersionError,
          notice:
            error instanceof CatalogueVersionError
              ? error.message
              : "Could not refresh listings. Check your connection and retry. Cached listings are shown when available.",
        });
      }
    })().finally(() => {
      refreshWork = null;
    });
    return refreshWork;
  };
  const start = async () => {
    try {
      const data = await cache.read();
      if (data) {
        validateCatalogue(data.manifest, data.films, data.meta, data.events);
        store.set({ data, loading: false, notice: "", updateRequired: false });
      }
    } catch {
      /* A corrupt or evicted cache must not prevent a network load. */
    }
    await refresh();
  };
  const loadShowtimes = (id: string): Promise<FilmShowtimes> => {
    const data = store.getSnapshot().data;
    if (!data) return Promise.reject(new Error("Load the listings first."));
    const key = `${data.manifest.showtimes}${id}`;
    const cached = details.get(key);
    if (cached) return cached;
    const pending = (async () => {
      try {
        return validateShowtimes(
          id,
          await read(
            resolveDataUrl(base, `${data.manifest.showtimes}${encodeURIComponent(id)}.json`),
          ),
        );
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 404)) throw error;
        const manifest = await getManifest();
        return validateShowtimes(
          id,
          await read(resolveDataUrl(base, `${manifest.showtimes}${encodeURIComponent(id)}.json`)),
        );
      }
    })().catch((error) => {
      details.delete(key);
      throw error;
    });
    details.set(key, pending);
    return pending;
  };
  return {
    ...store,
    start,
    refresh,
    loadShowtimes,
    foreground: () => (Date.now() - lastRefresh > 30 * 60_000 ? refresh() : Promise.resolve()),
  };
}
