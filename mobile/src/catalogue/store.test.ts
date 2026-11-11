import { describe, expect, it, vi } from "vitest";
import { createCatalogueCache } from "./cache";
import { REFRESH_AFTER_MS, type Fetcher } from "./loader";
import { createCatalogueStore } from "./store";
import { ORIGIN, deploy, fakeSite, memoryFiles } from "./test-server";

const first = deploy("2026-11-10T06:45:00.000Z", "aaaa");
const second = deploy("2026-11-10T11:45:00.000Z", "bbbb", ["a", "b", "c"]);
const offline: Fetcher = async () => {
  throw new TypeError("Network request failed");
};

async function warmCache() {
  const files = memoryFiles();
  const store = createCatalogueStore({
    fetcher: fakeSite(first).fetcher,
    origin: ORIGIN,
    cache: createCatalogueCache(files),
  });
  await store.start();
  return files;
}

describe("catalogue store", () => {
  it("shows the cached catalogue with no connection", async () => {
    const files = await warmCache();
    const store = createCatalogueStore({
      fetcher: offline,
      origin: ORIGIN,
      cache: createCatalogueCache(files),
    });
    await store.start();
    const state = store.getState();
    expect(state.catalogue?.films).toHaveLength(2);
    expect(state.loading).toBe(false);
    expect(state.error).not.toBeNull();
  });

  it("shows the cache before the network answers", async () => {
    const files = await warmCache();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const site = fakeSite(second);
    const slow: Fetcher = async (url, init) => {
      await gate;
      return site.fetcher(url, init);
    };
    const store = createCatalogueStore({
      fetcher: slow,
      origin: ORIGIN,
      cache: createCatalogueCache(files),
    });
    const started = store.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().catalogue?.films).toHaveLength(2);
    expect(store.getState().refreshing).toBe(true);
    release();
    await started;
    expect(store.getState().catalogue?.films).toHaveLength(3);
  });

  it("reports an error only after the first download fails with no cache", async () => {
    const store = createCatalogueStore({
      fetcher: offline,
      origin: ORIGIN,
      cache: createCatalogueCache(memoryFiles()),
    });
    expect(store.getState().loading).toBe(true);
    await store.start();
    expect(store.getState()).toMatchObject({ loading: false, catalogue: null });
    expect(store.getState().error).toMatch(/could not be loaded/);
  });

  it("checks again on returning to the foreground only after 30 minutes", async () => {
    let now = 0;
    const site = fakeSite(first);
    const store = createCatalogueStore({
      fetcher: site.fetcher,
      origin: ORIGIN,
      cache: createCatalogueCache(memoryFiles()),
      clock: () => now,
    });
    await store.start();
    const manifests = () => site.requests.filter((url) => url.endsWith("/catalogue.json")).length;
    now = REFRESH_AFTER_MS - 1;
    await store.foreground();
    expect(manifests()).toBe(1);
    site.publish(second);
    now = REFRESH_AFTER_MS;
    await store.foreground();
    expect(manifests()).toBe(2);
    expect(store.getState().catalogue?.films).toHaveLength(3);
  });

  it("keeps the cache on screen and asks for an update on a newer schema", async () => {
    const files = await warmCache();
    const newer = deploy("2026-11-11T06:45:00.000Z", "cccc");
    newer.manifest.schemaVersion += 1;
    const store = createCatalogueStore({
      fetcher: fakeSite(newer).fetcher,
      origin: ORIGIN,
      cache: createCatalogueCache(files),
    });
    await store.start();
    expect(store.getState()).toMatchObject({ updateRequired: true, error: null });
    expect(store.getState().manifest?.generatedAt).toBe(first.manifest.generatedAt);
  });

  it("refreshes the catalogue when a showtime file has gone", async () => {
    const site = fakeSite(first);
    const store = createCatalogueStore({
      fetcher: site.fetcher,
      origin: ORIGIN,
      cache: createCatalogueCache(memoryFiles()),
    });
    await store.start();
    site.publish(second);
    expect((await store.loadShowtimes("c")).id).toBe("c");
    // The catalogue catches up in the background.
    await vi.waitFor(() =>
      expect(store.getState().manifest?.generatedAt).toBe(second.manifest.generatedAt),
    );
  });
});

describe("catalogue store, edge cases", () => {
  it("keeps showing new listings when the cache cannot be written", async () => {
    const files = memoryFiles();
    const full = {
      ...files,
      write: async () => Promise.reject(new Error("ENOSPC")),
    };
    const store = createCatalogueStore({
      fetcher: fakeSite(first).fetcher,
      origin: ORIGIN,
      cache: createCatalogueCache(full),
    });
    await store.start();
    expect(store.getState()).toMatchObject({ error: null, loading: false });
    expect(store.getState().catalogue?.films).toHaveLength(2);
  });

  it("does not let a slow cache read replace a newer download", async () => {
    const files = await warmCache();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const cache = createCatalogueCache(files);
    const slowCache = {
      read: async () => {
        await gate;
        return cache.read();
      },
      write: cache.write,
    };
    const store = createCatalogueStore({
      fetcher: fakeSite(second).fetcher,
      origin: ORIGIN,
      cache: slowCache,
    });
    const started = store.start();
    await store.refresh();
    expect(store.getState().catalogue?.films).toHaveLength(3);
    release();
    await started;
    expect(store.getState().catalogue?.films).toHaveLength(3);
  });

  it("retries a missing showtime file against a manifest read after the deploy", async () => {
    const site = fakeSite(first);
    const store = createCatalogueStore({
      fetcher: site.fetcher,
      origin: ORIGIN,
      cache: createCatalogueCache(memoryFiles()),
    });
    await store.start();
    // A refresh that read the old manifest is still running when the deploy lands.
    site.beforeRequest((url) => {
      if (url.includes("/data/showtimes.aaaa/")) site.publish(second);
    });
    const stale = store.refresh();
    expect((await store.loadShowtimes("c")).id).toBe("c");
    await stale;
  });
});
