import { beforeAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { buildDataset, type Dataset } from "../../scripts/lib/transform";
import { loadBoroughs } from "../../scripts/lib/boroughs";
import { eventLabels, isEventScreening } from "../data/event-rules";
import { buildEventIndex } from "../shared/events";
import { matchingEvents, groupEvents, eventFacetCounts } from "./events";
import { readView, viewUrl } from "./catalogue";
import type { EventOccurrence, SourceRelease } from "../shared/data";
let dataset: Dataset;
const now = new Date("2026-10-03T09:00:00Z");
beforeAll(async () => {
  const fixture = JSON.parse(
    await readFile(new URL("../../tests/fixtures/pipeline.json", import.meta.url), "utf8"),
  ) as {
    combined: unknown;
    matched: unknown;
    sources: { combined: SourceRelease; matched: SourceRelease };
  };
  dataset = buildDataset(fixture.combined, fixture.matched, {
    now,
    sources: fixture.sources,
    boroughs: await loadBoroughs(),
  });
});
it("requires cinema evidence, excludes formats and unrelated venue activities", () => {
  for (const [category, notes, title] of [
    ["movie", "35mm", "A film"],
    ["movie", "", "Talk to Me"],
    ["movie", "", "Introduction"],
    ["movie", "", "Marathon Man"],
    ["movie", "IMAX 70mm", "A film"],
    ["talk", "", "Aesthetics of Risk"],
    ["workshop", "", "Wine tasting"],
    ["event", "", "BOARD GAMES"],
    ["comedy", "", "Open Mic"],
    ["music", "Live music", "Soul at The Ritzy"],
    ["workshop", "", "Networking"],
    ["workshop", "Introduction", "Learning to paint"],
    ["event", "", "Charity marathon"],
  ])
    expect(isEventScreening(category!, notes, title)).toBe(false);
  for (const [category, notes, title] of [
    ["movie", "The screening will be introduced.", "Fanon"],
    ["movie", "Live music", "Faust"],
    ["movie", "Q&A with Jane Doe", "A film"],
    ["shorts", "", "Shorts"],
    ["multiple-movies", "", "Programme"],
    ["talk", "", "Exploring Slow Cinema"],
    ["quiz", "", "Cinema Film Quiz"],
    ["workshop", "", "Filmmaking workshop"],
    ["tv", "", "Cunk on Cinema + Q&A"],
    ["event", "", "BFI IMAX Tour"],
  ])
    expect(isEventScreening(category!, notes, title)).toBe(true);
  expect(eventLabels("movie", "Q&A and introduction, 35mm")).toEqual(["Q&A", "Introduction"]);
});
it("deduplicates tags without merging distinct venues, screens, films or exact DST starts", () => {
  const original = dataset.showtimes.find((row) => row.id === "classic-a")!;
  const row = original.days["2026-10-03"]![0]!;
  const copy = { ...row, notes: "Q&A", formats: ["70mm"] };
  const entries = buildEventIndex(dataset.films, [
    {
      ...original,
      days: {
        "wrong-upstream-date": [
          row,
          copy,
          { ...row, venue: "other" },
          { ...row, screen: "2" },
          { ...row, time: row.time + 3600000 },
        ],
      },
    },
  ]);
  expect(entries).toHaveLength(4);
  expect(entries[0]!.date).toBe("2026-10-03");
  expect(
    entries.find(
      (entry) =>
        entry.venue === row.venue && entry.screen === row.screen && entry.time === row.time,
    )?.labels,
  ).toEqual(["Live score", "Q&A"]);
  const dst = buildEventIndex(dataset.films, [
    {
      ...original,
      days: {
        ignored: [
          { ...row, time: Date.parse("2026-10-25T00:30:00Z") },
          { ...row, time: Date.parse("2026-10-25T01:30:00Z") },
        ],
      },
    },
  ]);
  expect(dst).toHaveLength(2);
  expect(groupEvents(dst)[0]![0]).toBe("2026-10-25");
});
it("matches date, cinema and event type on one occurrence and counts occurrences", () => {
  const entries = buildEventIndex(dataset.films, dataset.showtimes);
  const state = readView(new URL("https://test.local/events?eventType=score&day=2026-10-04"));
  expect(matchingEvents(entries, dataset.films, dataset.meta, state, now)).toHaveLength(0);
  state.filters.day = ["2026-10-03"];
  expect(matchingEvents(entries, dataset.films, dataset.meta, state, now)).toHaveLength(1);
  state.filters.venue = ["bfi.org.uk-southbank"];
  expect(matchingEvents(entries, dataset.films, dataset.meta, state, now)).toHaveLength(0);
  const all = readView(new URL("https://test.local/events"));
  const extra: EventOccurrence = { ...entries[0]!, id: "distinct", time: entries[0]!.time + 60000 };
  expect(matchingEvents([...entries, extra], dataset.films, dataset.meta, all, now)).toHaveLength(
    3,
  );
  expect(
    eventFacetCounts([...entries, extra], dataset.films, dataset.meta, all, now).day.get(
      "2026-10-03",
    ),
  ).toBe(2);
  expect(viewUrl(state)).toContain("eventType=score");
});
