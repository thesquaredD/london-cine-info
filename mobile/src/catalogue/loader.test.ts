import { beforeAll, expect, it, vi } from "vitest";
import { createCatalogue, HttpError, type Catalogue } from "./loader";
import { fixture } from "../../../tests/catalogue-fixture";
let data: Catalogue;
beforeAll(async () => {
  data = await fixture();
});
const reader = (snapshot: Catalogue) =>
  vi.fn(async (url: string) => {
    if (url.endsWith("/catalogue.json")) return snapshot.manifest;
    if (url.endsWith(snapshot.manifest.films)) return snapshot.films;
    if (url.endsWith(snapshot.manifest.meta)) return snapshot.meta;
    if (url.endsWith(snapshot.manifest.events)) return snapshot.events;
    throw new HttpError(404);
  });
it("renders the cache before a network request finishes and keeps it when offline", async () => {
  let reject!: (error: Error) => void;
  const read = vi.fn(
    () =>
      new Promise<unknown>((_resolve, rejectWork) => {
        reject = rejectWork;
      }),
  );
  const cache = { read: async () => data, write: vi.fn() };
  const store = createCatalogue(cache, read),
    start = store.start();
  await vi.waitFor(() => expect(read).toHaveBeenCalled());
  expect(store.getSnapshot().data).toBe(data);
  reject(new Error("offline"));
  await start;
  expect(store.getSnapshot().data).toBe(data);
  expect(store.getSnapshot().notice).toContain("Could not refresh");
  expect(cache.write).not.toHaveBeenCalled();
});
it("validates all files before committing and never replaces cache with a partial catalogue", async () => {
  const read = reader(data),
    write = vi.fn();
  read.mockImplementation(async (url) =>
    url.endsWith("catalogue.json")
      ? data.manifest
      : url.endsWith(data.manifest.meta)
        ? data.meta
        : [],
  );
  const store = createCatalogue({ read: async () => null, write }, read);
  await store.start();
  expect(store.getSnapshot().data).toBeNull();
  expect(write).not.toHaveBeenCalled();
});
it("refetches the manifest once on a vanished hash, commits the new generation and coalesces refreshes", async () => {
  const updated = structuredClone(data);
  updated.manifest.films = "/data/films.b.json";
  const read = reader(updated);
  read
    .mockImplementationOnce(async () => data.manifest)
    .mockImplementationOnce(async () => {
      throw new HttpError(404);
    });
  const write = vi.fn(),
    store = createCatalogue({ read: async () => null, write }, read);
  await store.start();
  expect(read.mock.calls.filter(([url]) => url.endsWith("catalogue.json"))).toHaveLength(2);
  expect(write).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().data!.manifest.films).toBe("/data/films.b.json");
  await Promise.all([store.refresh(), store.refresh()]);
  expect(read.mock.calls.filter(([url]) => url.endsWith("catalogue.json"))).toHaveLength(3);
});
it("does not loop forever on 404 and keeps old listings when the server requires a newer app", async () => {
  const read = vi.fn(async () => ({ ...data.manifest, schemaVersion: 99 }));
  const store = createCatalogue({ read: async () => data, write: vi.fn() }, read);
  await store.start();
  expect(store.getSnapshot().data).toBe(data);
  expect(store.getSnapshot().updateRequired).toBe(true);
  const vanished = vi.fn(async (url: string) => {
    if (url.endsWith("catalogue.json")) return data.manifest;
    throw new HttpError(404);
  });
  const empty = createCatalogue({ read: async () => null, write: vi.fn() }, vanished);
  await empty.start();
  expect(vanished.mock.calls.filter(([url]) => url.endsWith("catalogue.json"))).toHaveLength(2);
});
it("recovers a corrupt cache and retains fresh data when disk writes fail", async () => {
  const store = createCatalogue(
    {
      read: async () => {
        throw new Error("corrupt");
      },
      write: async () => {
        throw new Error("full");
      },
    },
    reader(data),
  );
  await store.start();
  expect(store.getSnapshot().data!.films).toEqual(data.films);
  expect(store.getSnapshot().notice).toContain("could not be saved");
});

it("refreshes on foreground only after thirty minutes, and reuses the current generation otherwise", async () => {
  const start = Date.parse("2026-10-16T10:00:00Z"),
    clock = vi.spyOn(Date, "now").mockReturnValue(start);
  try {
    const read = reader(data),
      store = createCatalogue({ read: async () => data, write: vi.fn() }, read);
    await store.start();
    await store.foreground();
    expect(read).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(start + 31 * 60_000);
    await store.foreground();
    expect(read).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().data).toBe(data);
  } finally {
    clock.mockRestore();
  }
});
it("coalesces detail requests, refetches the manifest on a retired hash, and retries failed details", async () => {
  const read = reader(data),
    store = createCatalogue({ read: async () => data, write: vi.fn() }, read);
  await store.start();
  const updated = { ...data.manifest, showtimes: "/data/showtimes.b/" };
  const details = { id: "classic-a", days: {}, details: { actors: [], overview: null } };
  read.mockImplementation(async (url) => {
    if (url.endsWith("catalogue.json")) return updated;
    if (url.includes("/showtimes.b/")) return details;
    throw new HttpError(404);
  });
  const [a, b] = await Promise.all([
    store.loadShowtimes("classic-a"),
    store.loadShowtimes("classic-a"),
  ]);
  expect(a).toBe(b);
  expect(read.mock.calls.filter(([url]) => url.includes("/showtimes.a/"))).toHaveLength(1);
  read.mockRejectedValueOnce(new Error("offline"));
  await expect(store.loadShowtimes("missing")).rejects.toThrow("offline");
  read.mockResolvedValueOnce({ ...details, id: "missing" });
  await expect(store.loadShowtimes("missing")).resolves.toHaveProperty("id", "missing");
});
