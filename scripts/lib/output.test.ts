import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { buildDataset } from "./transform";
import { loadBoroughs } from "./boroughs";
import { writeDataset } from "./output";
import type { SourceRelease } from "../../src/shared/data";

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
  expect(JSON.parse(await readFile(join(root, "public", first.films), "utf8"))).toHaveLength(6);
  expect(
    JSON.parse(await readFile(join(root, "public", first.showtimes, "classic-a.json"), "utf8")),
  ).toMatchObject({ id: "classic-a" });
  const changed = structuredClone(dataset);
  changed.showtimes[0]!.days["2026-10-03"]![0]!.bookingUrl = "https://example.com/new-booking";
  const second = await writeDataset(changed, root);
  expect(second.films).toBe(first.films);
  expect(second.showtimes).not.toBe(first.showtimes);
  expect(await readdir(join(root, "public/data"))).not.toContain(first.showtimes.split("/")[2]);
  const previousManifest = await readFile(join(root, "src/generated/manifest.json"), "utf8");
  const invalid = structuredClone(dataset);
  invalid.showtimes[0]!.id = "../escape";
  await expect(writeDataset(invalid, root)).rejects.toThrow(/Unsafe output filename/);
  expect(await readFile(join(root, "src/generated/manifest.json"), "utf8")).toBe(previousManifest);
  expect(await readdir(join(root, "public/data"))).toContain(second.showtimes.split("/")[2]);
});
