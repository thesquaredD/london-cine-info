import { describe, expect, it } from "vitest";
import { DATA_SCHEMA_VERSION } from "@readograph/core/data";
import { createCatalogueCache } from "./cache";
import {
  MissingDataError,
  NetworkDataError,
  createShowtimeLoader,
  fetchJson,
  refreshCatalogue,
  type Fetcher,
} from "./loader";
import { ORIGIN, deploy, fakeSite, memoryFiles } from "./test-server";

const first = deploy("2026-11-10T06:45:00.000Z", "aaaa");
const second = deploy("2026-11-10T11:45:00.000Z", "bbbb", ["a", "b", "c"]);

const reply =
  (status: number, body: string, type = "application/json"): Fetcher =>
  async () => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => (name === "content-type" ? type : null) },
    text: async () => body,
  });

describe("fetchJson", () => {
  it("parses a JSON response", async () => {
    await expect(fetchJson(reply(200, '{"a":1}'), `${ORIGIN}/x.json`)).resolves.toEqual({ a: 1 });
  });

  it("treats the SPA fallback page as a missing file", async () => {
    await expect(
      fetchJson(reply(200, "<!doctype html>", "text/html; charset=utf-8"), `${ORIGIN}/data/x.json`),
    ).rejects.toBeInstanceOf(MissingDataError);
  });

  it("treats a body that is not JSON as missing, whatever its content type says", async () => {
    await expect(fetchJson(reply(200, "<html>"), `${ORIGIN}/data/x.json`)).rejects.toBeInstanceOf(
      MissingDataError,
    );
  });

  it("treats 404 as missing and other failures as network errors", async () => {
    await expect(fetchJson(reply(404, ""), `${ORIGIN}/a`)).rejects.toBeInstanceOf(MissingDataError);
    await expect(fetchJson(reply(503, ""), `${ORIGIN}/a`)).rejects.toBeInstanceOf(NetworkDataError);
    const offline: Fetcher = async () => {
      throw new TypeError("Network request failed");
    };
    await expect(fetchJson(offline, `${ORIGIN}/a`)).rejects.toBeInstanceOf(NetworkDataError);
  });
});

describe("refreshCatalogue", () => {
  it("downloads and stores the catalogue on a first launch", async () => {
    const site = fakeSite(first);
    const files = memoryFiles();
    const cache = createCatalogueCache(files);
    const result = await refreshCatalogue({
      fetcher: site.fetcher,
      origin: ORIGIN,
      cache,
      current: null,
    });
    expect(result.kind).toBe("updated");
    expect(await cache.read()).toEqual(result.kind === "updated" ? result.entry : null);
    expect(site.requests[0]).toBe(`${ORIGIN}/catalogue.json`);
  });

  it("does nothing more than read the manifest when the cache is current", async () => {
    const site = fakeSite(first);
    const cache = createCatalogueCache(memoryFiles());
    const initial = await refreshCatalogue({
      fetcher: site.fetcher,
      origin: ORIGIN,
      cache,
      current: null,
    });
    if (initial.kind !== "updated") throw new Error("expected a download");
    site.requests.length = 0;
    const result = await refreshCatalogue({
      fetcher: site.fetcher,
      origin: ORIGIN,
      cache,
      current: initial.entry,
    });
    expect(result.kind).toBe("current");
    expect(site.requests).toEqual([`${ORIGIN}/catalogue.json`]);
  });

  it("swaps in a newer deploy", async () => {
    const site = fakeSite(first);
    const cache = createCatalogueCache(memoryFiles());
    const initial = await refreshCatalogue({
      fetcher: site.fetcher,
      origin: ORIGIN,
      cache,
      current: null,
    });
    if (initial.kind !== "updated") throw new Error("expected a download");
    site.publish(second);
    const result = await refreshCatalogue({
      fetcher: site.fetcher,
      origin: ORIGIN,
      cache,
      current: initial.entry,
    });
    expect(result.kind === "updated" && result.entry.catalogue.films).toHaveLength(3);
    expect((await cache.read())?.manifest.generatedAt).toBe(second.manifest.generatedAt);
  });

  it("re-reads the manifest once when a deploy lands between the manifest and the files", async () => {
    const site = fakeSite(first);
    site.beforeRequest((url) => {
      if (url.includes("/data/")) site.publish(second);
    });
    const cache = createCatalogueCache(memoryFiles());
    const result = await refreshCatalogue({
      fetcher: site.fetcher,
      origin: ORIGIN,
      cache,
      current: null,
    });
    expect(result.kind === "updated" && result.entry.manifest).toEqual(second.manifest);
    expect(site.requests.filter((url) => url.endsWith("/catalogue.json"))).toHaveLength(2);
  });

  it("gives up after one retry and leaves the cache alone", async () => {
    const broken = { manifest: first.manifest, files: {} };
    const site = fakeSite(broken);
    const files = memoryFiles();
    await expect(
      refreshCatalogue({
        fetcher: site.fetcher,
        origin: ORIGIN,
        cache: createCatalogueCache(files),
        current: null,
      }),
    ).rejects.toBeInstanceOf(MissingDataError);
    expect(site.requests.filter((url) => url.endsWith("/catalogue.json"))).toHaveLength(2);
    expect(files.files.size).toBe(0);
  });

  it("asks for an app update when the data uses a newer schema", async () => {
    const newer = deploy("2026-11-11T06:45:00.000Z", "cccc");
    newer.manifest.schemaVersion = DATA_SCHEMA_VERSION + 1;
    const site = fakeSite(newer);
    const result = await refreshCatalogue({
      fetcher: site.fetcher,
      origin: ORIGIN,
      cache: createCatalogueCache(memoryFiles()),
      current: null,
    });
    expect(result.kind).toBe("update-app");
    expect(site.requests).toHaveLength(1);
  });
});

describe("createShowtimeLoader", () => {
  it("caches each film's file for the session", async () => {
    const site = fakeSite(first);
    const loader = createShowtimeLoader({
      fetcher: site.fetcher,
      origin: ORIGIN,
      manifest: () => first.manifest,
      refreshManifest: async () => first.manifest,
    });
    const [a, again] = await Promise.all([loader.load("a"), loader.load("a")]);
    expect(a.id).toBe("a");
    expect(again).toBe(a);
    expect(site.requests).toEqual([`${ORIGIN}/data/showtimes.aaaa/a.json`]);
  });

  it("follows a new deploy when the film's file has gone", async () => {
    const site = fakeSite(second);
    let refreshed = 0;
    const loader = createShowtimeLoader({
      fetcher: site.fetcher,
      origin: ORIGIN,
      manifest: () => first.manifest,
      refreshManifest: async () => {
        refreshed += 1;
        return second.manifest;
      },
    });
    expect((await loader.load("a")).id).toBe("a");
    expect(refreshed).toBe(1);
    expect(site.requests.at(-1)).toBe(`${ORIGIN}/data/showtimes.bbbb/a.json`);
  });

  it("forgets a failed load so that a later attempt fetches again", async () => {
    const site = fakeSite({ manifest: first.manifest, files: {} });
    const loader = createShowtimeLoader({
      fetcher: site.fetcher,
      origin: ORIGIN,
      manifest: () => first.manifest,
      refreshManifest: async () => first.manifest,
    });
    await expect(loader.load("a")).rejects.toBeInstanceOf(MissingDataError);
    site.publish(first);
    expect((await loader.load("a")).id).toBe("a");
  });
});
