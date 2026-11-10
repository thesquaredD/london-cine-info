import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { buildDataset } from "./transform";
import { loadBoroughs } from "./boroughs";
import { writeDataset } from "./output";
import type { SourceRelease } from "@readograph/core/data";

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

it("publishes immutable URLs, removes obsolete outputs, and preserves the last build on validation failure", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../../tests/fixtures/pipeline.json", import.meta.url), "utf8"),
  ) as {
    now: string;
    combined: unknown;
    matched: unknown;
    sources: { combined: SourceRelease; matched: SourceRelease };
  };
  const dataset = buildDataset(fixture.combined, fixture.matched, {
    now: new Date(fixture.now),
    sources: fixture.sources,
    boroughs: await loadBoroughs(),
  });
  const root = await mkdtemp(join(tmpdir(), "london-cine-output-"));
  temporaryRoots.push(root);
  const first = await writeDataset(dataset, root);
  const catalogue = () => readFile(join(root, "public", "catalogue.json"), "utf8");
  expect(JSON.parse(await catalogue())).toEqual(first);
  expect(await catalogue()).toBe(await readFile(join(root, "src/generated/manifest.json"), "utf8"));
  expect(JSON.parse(await readFile(join(root, "public", first.films), "utf8"))).toHaveLength(6);
  expect(
    JSON.parse(await readFile(join(root, "public", first.showtimes, "classic-a.json"), "utf8")),
  ).toMatchObject({ id: "classic-a" });
  const index = JSON.parse(await readFile(join(root, "public", first.events), "utf8"));
  expect(index).toHaveLength(2);
  expect(index.find((row: { filmId: string }) => row.filmId === "classic-a")).toMatchObject({
    labels: ["Live score"],
    date: "2026-10-03",
    localTime: "14:00",
    bookingUrl: "https://example.com/book/pcc/1791032400000",
  });
  const changed = structuredClone(dataset);
  changed.showtimes[0]!.days["2026-10-03"]![0]!.bookingUrl = "https://example.com/new-booking";
  const second = await writeDataset(changed, root);
  expect(second.films).toBe(first.films);
  expect(second.showtimes).not.toBe(first.showtimes);
  expect(await readdir(join(root, "public/data"))).not.toContain(first.showtimes.split("/")[2]);
  const previousManifest = await readFile(join(root, "src/generated/manifest.json"), "utf8");
  expect(JSON.parse(await catalogue())).toEqual(second);
  const invalid = structuredClone(dataset);
  invalid.showtimes[0]!.id = "../escape";
  await expect(writeDataset(invalid, root)).rejects.toThrow(/Unsafe output filename/);
  expect(await readFile(join(root, "src/generated/manifest.json"), "utf8")).toBe(previousManifest);
  expect(await catalogue()).toBe(previousManifest);
  expect(await readdir(join(root, "public/data"))).toContain(second.showtimes.split("/")[2]);
});

it("restores the public catalogue when the build manifest cannot be installed", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../../tests/fixtures/pipeline.json", import.meta.url), "utf8"),
  ) as {
    now: string;
    combined: unknown;
    matched: unknown;
    sources: { combined: SourceRelease; matched: SourceRelease };
  };
  const dataset = buildDataset(fixture.combined, fixture.matched, {
    now: new Date(fixture.now),
    sources: fixture.sources,
    boroughs: await loadBoroughs(),
  });
  const root = await mkdtemp(join(tmpdir(), "london-cine-output-"));
  temporaryRoots.push(root);
  // A non-empty directory where the manifest goes makes the last rename fail.
  await mkdir(join(root, "src/generated/manifest.json"), { recursive: true });
  await writeFile(join(root, "src/generated/manifest.json/keep"), "");
  await mkdir(join(root, "public"), { recursive: true });
  await writeFile(join(root, "public/catalogue.json"), "previous\n");
  await expect(writeDataset(dataset, root)).rejects.toThrow();
  expect(await readFile(join(root, "public/catalogue.json"), "utf8")).toBe("previous\n");
  expect(await readdir(join(root, "public"))).toEqual(["catalogue.json"]);
});
