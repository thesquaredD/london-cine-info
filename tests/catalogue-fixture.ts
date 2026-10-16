import { readFile } from "node:fs/promises";
import { buildDataset } from "../scripts/lib/transform";
import { loadBoroughs } from "../scripts/lib/boroughs";
import { buildEventIndex } from "@lci/core/event-index";
import type { DataManifest, Film, DataMeta, EventOccurrence } from "@lci/core/data";
type Catalogue = {
  manifest: DataManifest;
  films: Film[];
  meta: DataMeta;
  events: EventOccurrence[];
};
export async function fixture(): Promise<Catalogue> {
  const input = JSON.parse(
    await readFile(new URL("./fixtures/pipeline.json", import.meta.url), "utf8"),
  );
  const dataset = buildDataset(input.combined, input.matched, {
    now: new Date(input.now),
    sources: input.sources,
    boroughs: await loadBoroughs(),
  });
  return {
    films: dataset.films,
    meta: dataset.meta,
    events: buildEventIndex(dataset.films, dataset.showtimes),
    manifest: {
      schemaVersion: 2,
      generatedAt: dataset.meta.generatedAt,
      films: "/data/films.a.json",
      meta: "/data/meta.a.json",
      events: "/data/events.a.json",
      showtimes: "/data/showtimes.a/",
    },
  };
}
