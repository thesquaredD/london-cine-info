import { DATA_SCHEMA_VERSION, type DataManifest } from "@readograph/core/data";
import type { CacheFiles } from "./cache";
import type { Fetcher, FetchResponse } from "./loader";

/**
 * Test doubles for the catalogue tests: a fake site that serves one or more deploys the way
 * Cloudflare Pages does (missing `/data/*` files come back as 200 `text/html`), and an
 * in-memory cache directory. Not imported by the app.
 */

export const ORIGIN = "https://example.test";

export function deploy(generatedAt: string, tag: string, filmIds = ["a", "b"]) {
  const manifest: DataManifest = {
    schemaVersion: DATA_SCHEMA_VERSION,
    generatedAt,
    films: `/data/films.${tag}.json`,
    meta: `/data/meta.${tag}.json`,
    showtimes: `/data/showtimes.${tag}/`,
    events: `/data/events.${tag}.json`,
  };
  const films = filmIds.map((id) => ({ id, ti: `Film ${id}` }));
  const files: Record<string, unknown> = {
    [manifest.films]: films,
    [manifest.meta]: { schemaVersion: DATA_SCHEMA_VERSION, counts: { films: films.length } },
    [manifest.events]: [],
  };
  for (const id of filmIds)
    files[`${manifest.showtimes}${id}.json`] = {
      id,
      days: {},
      details: { actors: [], overview: null },
    };
  return { manifest, files };
}

const response = (status: number, body: string, type: string): FetchResponse => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (name) => (name.toLowerCase() === "content-type" ? type : null) },
  text: async () => body,
});

/**
 * A site whose live deploy can be swapped mid-test. `before` runs before each request is
 * answered, so a test can land a deploy between the manifest and the files.
 */
export function fakeSite(initial: ReturnType<typeof deploy>) {
  let live = initial;
  const requests: string[] = [];
  let before: ((url: string) => void) | null = null;
  const fetcher: Fetcher = async (url) => {
    requests.push(url);
    before?.(url);
    const path = new URL(url).pathname;
    if (path === "/catalogue.json")
      return response(200, JSON.stringify(live.manifest), "application/json");
    if (path in live.files)
      return response(200, JSON.stringify(live.files[path]), "application/json; charset=utf-8");
    // Pages in SPA mode: every unknown path serves the app's index page.
    return response(200, "<!doctype html><title>Readograph</title>", "text/html; charset=utf-8");
  };
  return {
    fetcher,
    requests,
    publish(next: ReturnType<typeof deploy>) {
      live = next;
    },
    beforeRequest(hook: ((url: string) => void) | null) {
      before = hook;
    },
  };
}

export function memoryFiles(initial: Record<string, string> = {}): CacheFiles & {
  files: Map<string, string>;
} {
  const files = new Map(Object.entries(initial));
  return {
    files,
    list: async () => [...files.keys()],
    read: async (name) => {
      const text = files.get(name);
      if (text === undefined) throw new Error(`No such file: ${name}`);
      return text;
    },
    write: async (name, text) => {
      files.set(name, text);
    },
    remove: async (name) => {
      files.delete(name);
    },
  };
}
