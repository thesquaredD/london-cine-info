import { describe, expect, it } from "vitest";
import { DATA_SCHEMA_VERSION } from "@readograph/core/data";
import { createCatalogueCache, entryFileName } from "./cache";
import type { CatalogueEntry } from "./loader";
import { deploy, memoryFiles } from "./test-server";

function entry(generatedAt: string, tag: string): CatalogueEntry {
  const { manifest, files } = deploy(generatedAt, tag);
  return {
    manifest,
    catalogue: {
      films: files[manifest.films] as CatalogueEntry["catalogue"]["films"],
      meta: files[manifest.meta] as CatalogueEntry["catalogue"]["meta"],
      events: [],
    },
  };
}
const older = entry("2026-11-10T06:45:00.000Z", "aaaa");
const newer = entry("2026-11-10T11:45:00.000Z", "bbbb");

describe("catalogue cache", () => {
  it("is empty on a first launch", async () => {
    expect(await createCatalogueCache(memoryFiles()).read()).toBeNull();
  });

  it("returns what was written, and keeps one generation", async () => {
    const files = memoryFiles();
    const cache = createCatalogueCache(files);
    await cache.write(older);
    await cache.write(newer);
    expect(await cache.read()).toEqual(newer);
    expect([...files.files.keys()]).toEqual([entryFileName(newer.manifest.generatedAt)]);
  });

  it("names files so that they sort in generation order", () => {
    expect(
      entryFileName("2026-11-10T06:45:00.000Z") < entryFileName("2026-11-10T11:45:00.000Z"),
    ).toBe(true);
    expect(entryFileName("2026-11-10T06:45:00.000Z")).not.toMatch(/[:]/);
  });

  it("falls back to the previous generation when the newest write was cut short", async () => {
    const files = memoryFiles();
    const cache = createCatalogueCache(files);
    await cache.write(older);
    const full = JSON.stringify(newer);
    files.files.set(entryFileName(newer.manifest.generatedAt), full.slice(0, full.length / 2));
    expect(await cache.read()).toEqual(older);
  });

  it("ignores a stored catalogue this build can no longer read", async () => {
    const files = memoryFiles();
    const stale = structuredClone(older);
    stale.manifest.schemaVersion = DATA_SCHEMA_VERSION - 1;
    files.files.set(entryFileName(stale.manifest.generatedAt), JSON.stringify(stale));
    expect(await createCatalogueCache(files).read()).toBeNull();
  });

  it("ignores unrelated files and an unreadable directory", async () => {
    const files = memoryFiles({ "notes.txt": "x" });
    expect(await createCatalogueCache(files).read()).toBeNull();
    const broken = { ...files, list: async () => Promise.reject(new Error("EACCES")) };
    expect(await createCatalogueCache(broken).read()).toBeNull();
  });
});
