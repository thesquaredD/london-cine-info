import {
  IncompatibleDataError,
  parseManifest,
  resolveDataUrl,
  showtimesPath,
  validateCatalogue,
  validateShowtimes,
  type Catalogue,
} from "@readograph/core/catalogue-loader";
import { DATA_SCHEMA_VERSION, type DataManifest, type FilmShowtimes } from "@readograph/core/data";

/**
 * The app's catalogue loading rules (plan section B), without any React Native API so they run
 * under Vitest. The network comes in as `fetcher`, the disk as a `CatalogueCache`.
 *
 * 1. On launch, the cached catalogue is read and shown (see `store.ts`).
 * 2. `/catalogue.json` is fetched; when its `generatedAt` is newer than the cache, the three
 *    files it names are fetched, checked and then stored as one entry.
 * 3. On returning to the foreground after `REFRESH_AFTER_MS`, step 2 runs again (`store.ts`).
 * 4. A data file that is missing is fetched again once, from a freshly read manifest. Cloudflare
 *    Pages serves the site in SPA mode, so a missing `/data/*` file comes back as HTTP 200 with
 *    an HTML page, not as a 404: a non-JSON body or a `text/html` response counts as missing.
 * 5. A manifest with a newer schema than this build reads keeps the cached catalogue on screen
 *    and asks for an app update.
 */

/**
 * The schema versions this build reads. After a breaking bump, keep the previous version here
 * for 30 days (AGENTS.md, "Screening data schema").
 */
export const ACCEPTED_SCHEMAS: readonly number[] = [DATA_SCHEMA_VERSION];

/** Step 3: how long the app waits in the background before checking for new listings. */
export const REFRESH_AFTER_MS = 30 * 60 * 1000;

/** The part of a `fetch` response the loader reads. React Native's `fetch` satisfies it. */
export type FetchResponse = {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};
export type Fetcher = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<FetchResponse>;

/** One stored catalogue: the manifest that named the files and the checked files. */
export type CatalogueEntry = { manifest: DataManifest; catalogue: Catalogue };

/** Where the last good catalogue is kept between launches (`cache.ts`). */
export interface CatalogueCache {
  read(): Promise<CatalogueEntry | null>;
  write(entry: CatalogueEntry): Promise<void>;
}

/** A data file the manifest named was not there: a deploy replaced it (rule 4). */
export class MissingDataError extends Error {
  readonly url: string;
  constructor(url: string, reason: string) {
    super(`The data file ${url} is not available (${reason}).`);
    this.name = "MissingDataError";
    this.url = url;
  }
}

/** The server or network failed in a way a later retry may fix. */
export class NetworkDataError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NetworkDataError";
  }
}

const noCache = { headers: { "Cache-Control": "no-cache" } };

/**
 * Fetches and parses one JSON file. A 404, an HTML response or a body that is not JSON is a
 * missing file (rule 4); any other failed status is a network error.
 */
export async function fetchJson(fetcher: Fetcher, url: string, fresh = false): Promise<unknown> {
  let response: FetchResponse;
  try {
    response = await fetcher(url, fresh ? noCache : undefined);
  } catch (error) {
    throw new NetworkDataError(`The request for ${url} failed.`, { cause: error });
  }
  if (response.status === 404 || response.status === 410)
    throw new MissingDataError(url, `HTTP ${response.status}`);
  if (!response.ok)
    throw new NetworkDataError(`The request for ${url} returned HTTP ${response.status}.`);
  const type = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (type.includes("text/html")) throw new MissingDataError(url, "an HTML page was returned");
  const body = await response.text();
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new MissingDataError(url, "the response is not JSON");
  }
}

/** Reads and checks `${origin}/catalogue.json`, always bypassing HTTP caches. */
export async function fetchManifest(fetcher: Fetcher, origin: string): Promise<DataManifest> {
  const value = await fetchJson(fetcher, new URL("/catalogue.json", origin).href, true);
  return parseManifest(value, ACCEPTED_SCHEMAS);
}

/** Fetches the three files `manifest` names and checks them together. */
export async function fetchCatalogue(
  fetcher: Fetcher,
  origin: string,
  manifest: DataManifest,
): Promise<Catalogue> {
  const [films, meta, events] = await Promise.all(
    [manifest.films, manifest.meta, manifest.events].map((path) =>
      fetchJson(fetcher, resolveDataUrl(origin, path)),
    ),
  );
  return validateCatalogue(manifest, films, meta, events, ACCEPTED_SCHEMAS);
}

/** True when `candidate` was generated after `current`. */
export function isNewer(
  candidate: Pick<DataManifest, "generatedAt">,
  current?: Pick<DataManifest, "generatedAt"> | null,
) {
  return !current || Date.parse(candidate.generatedAt) > Date.parse(current.generatedAt);
}

export type RefreshResult =
  /** The cache already holds the published catalogue. */
  | { kind: "current"; manifest: DataManifest }
  /** A newer catalogue was downloaded, checked and stored. */
  | { kind: "updated"; entry: CatalogueEntry }
  /** The published data needs a newer app (rule 5). Keep showing the cache. */
  | { kind: "update-app"; message: string };

/**
 * Rule 2 with rule 4's retry: checks the manifest and, when it is newer than `current`, swaps
 * in the files it names. Throws `NetworkDataError` or `MissingDataError` when the refresh could
 * not complete; the caller keeps whatever it is showing.
 */
export async function refreshCatalogue({
  fetcher,
  origin,
  cache,
  current,
}: {
  fetcher: Fetcher;
  origin: string;
  cache: CatalogueCache;
  current: CatalogueEntry | null;
}): Promise<RefreshResult> {
  try {
    let manifest = await fetchManifest(fetcher, origin);
    if (!isNewer(manifest, current?.manifest)) return { kind: "current", manifest };
    let catalogue: Catalogue;
    try {
      catalogue = await fetchCatalogue(fetcher, origin, manifest);
    } catch (error) {
      if (!(error instanceof MissingDataError)) throw error;
      // A deploy landed between the manifest and the files: read the new manifest once.
      manifest = await fetchManifest(fetcher, origin);
      if (!isNewer(manifest, current?.manifest)) return { kind: "current", manifest };
      catalogue = await fetchCatalogue(fetcher, origin, manifest);
    }
    const entry = { manifest, catalogue };
    // A failed write (a full disk) only means the next launch starts from the older cache;
    // the new listings are still shown now.
    await cache.write(entry).catch(() => undefined);
    return { kind: "updated", entry };
  } catch (error) {
    if (error instanceof IncompatibleDataError && error.newerSchema)
      return { kind: "update-app", message: error.message };
    throw error;
  }
}

/**
 * Showtime files are fetched on demand and kept in memory for the session, as the website
 * does. A file that has gone (a deploy replaced the data) is fetched once more using the path
 * from a fresh manifest, which `refreshManifest` provides (the store also refreshes the
 * catalogue at that point).
 */
export function createShowtimeLoader({
  fetcher,
  origin,
  manifest,
  refreshManifest,
}: {
  fetcher: Fetcher;
  origin: string;
  manifest: () => DataManifest | null;
  refreshManifest: () => Promise<DataManifest | null>;
}) {
  const cache = new Map<string, Promise<FilmShowtimes>>();
  async function load(id: string): Promise<FilmShowtimes> {
    const current = manifest();
    if (!current) throw new NetworkDataError("The catalogue has not loaded yet.");
    try {
      return validateShowtimes(
        id,
        await fetchJson(fetcher, resolveDataUrl(origin, showtimesPath(current, id))),
      );
    } catch (error) {
      if (!(error instanceof MissingDataError)) throw error;
      const fresh = await refreshManifest();
      if (!fresh || fresh.showtimes === current.showtimes) throw error;
      return validateShowtimes(
        id,
        await fetchJson(fetcher, resolveDataUrl(origin, showtimesPath(fresh, id))),
      );
    }
  }
  return {
    load(id: string): Promise<FilmShowtimes> {
      const cached = cache.get(id);
      if (cached) return cached;
      const pending = load(id).catch((error: unknown) => {
        cache.delete(id);
        throw error;
      });
      cache.set(id, pending);
      return pending;
    },
    /** Drops every cached file, for when a new catalogue replaces the manifest. */
    clear() {
      cache.clear();
    },
  };
}
