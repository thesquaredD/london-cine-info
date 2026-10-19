import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { loadBoroughs } from "./lib/boroughs";
import { loadLiveData } from "./lib/releases";
import { buildDataset } from "./lib/transform";
import { writeDataset } from "./lib/output";
import { missingIndependentCinemas } from "../src/data/independent-cinemas";

const root = fileURLToPath(new URL("../", import.meta.url));
const { values } = parseArgs({
  options: { fixture: { type: "boolean", default: false }, now: { type: "string" } },
});
try {
  const input = values.fixture
    ? (JSON.parse(await readFile(join(root, "tests/fixtures/pipeline.json"), "utf8")) as {
        combined: unknown;
        matched: unknown;
        sources: Awaited<ReturnType<typeof loadLiveData>>["sources"];
        now: string;
      })
    : await loadLiveData(join(root, ".cache/clusterflick"));
  const defaultTime =
    "now" in input && typeof input.now === "string" ? input.now : new Date().toISOString();
  const now = new Date(values.now ?? defaultTime);
  const dataset = buildDataset(input.combined, input.matched, {
    now,
    sources: input.sources,
    boroughs: await loadBoroughs(),
  });
  const manifest = await writeDataset(dataset, root);
  // The fixture holds only a few venues, so the check is for live data only.
  const missingIndependent = values.fixture ? [] : missingIndependentCinemas(dataset.meta.venues);
  if (missingIndependent.length)
    console.warn(
      `Independent cinema IDs not in the dataset (review src/data/independent-cinemas.ts): ${missingIndependent.join(", ")}`,
    );
  console.log(
    JSON.stringify(
      {
        ...dataset.meta.counts,
        generatedAt: manifest.generatedAt,
        sources: dataset.meta.sources,
        filmsGzipBytes: gzipSync(JSON.stringify(dataset.films)).length,
        diagnostics: dataset.meta.diagnostics,
        manifest,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
