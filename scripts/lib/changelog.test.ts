import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readView } from "../../src/lib/catalogue";
import { buildBundle, checkPolicy, parseFragments } from "./changelog";

const entry = (fields: Record<string, unknown>) => {
  const value = {
    id: "evening-filter",
    type: "added",
    title: "Evening screenings",
    body: "Pick Evening to see screenings that start after 5pm.",
    visibility: "public",
    ...fields,
  };
  return { name: `${value.id}.json`, text: JSON.stringify(value) };
};
const DAY = Date.UTC(2026, 9, 12, 12) / 1000;

describe("changelog fragments", () => {
  it("accepts public notes and internal entries with a reason", () => {
    const { fragments, errors } = parseFragments([
      entry({ href: "/events", linkLabel: "Open Events" }),
      entry({ id: "ci-cache", visibility: "internal", reason: "Build tooling only." }),
    ]);
    expect(errors).toEqual([]);
    expect(fragments.map((fragment) => fragment.id)).toEqual(["evening-filter", "ci-cache"]);
  });

  it.each([
    ["internal without a reason", { visibility: "internal" }],
    ["public with a reason", { reason: "Hidden" }],
    ["an external link", { href: "https://example.com", linkLabel: "Go" }],
    ["a link without its label", { href: "/events" }],
    ["markup in copy", { body: "Now <b>bold</b>." }],
    ["a URL in copy", { body: "See https://example.com for more." }],
    ["an unknown category", { type: "removed" }],
    ["an unknown field", { author: "agent" }],
    ["an over-long title", { title: "x".repeat(81) }],
  ])("rejects %s", (_name, fields) => {
    expect(parseFragments([entry(fields)]).errors).not.toEqual([]);
  });

  it("rejects duplicate IDs, mismatched filenames and broken JSON", () => {
    const { errors } = parseFragments([
      entry({}),
      { ...entry({}), name: "copy.json" },
      { name: "broken.json", text: "{" },
    ]);
    expect(errors).toEqual([
      "copy.json: filename must be <id>.json",
      "copy.json: duplicate id evening-filter",
      "broken.json: not valid JSON",
    ]);
  });
});

describe("changelog bundle", () => {
  const parse = (...files: ReturnType<typeof entry>[]) => parseFragments(files).fragments;

  it("publishes public enabled notes newest first with a London change date", () => {
    const fragments = parse(
      entry({ id: "older" }),
      entry({ id: "newer", type: "fixed" }),
      entry({ id: "tooling", visibility: "internal", reason: "CI only." }),
      entry({ id: "dormant", feature: "radar-v2" }),
      entry({ id: "draft" }),
    );
    const added = new Map([
      ["older", DAY - 86_400],
      ["newer", DAY + 11 * 3600 - 60], // 22:59 UTC is 23:59 in London on 12 October
      ["tooling", DAY],
      ["dormant", DAY],
    ]);
    const { content, version, errors } = buildBundle(
      fragments,
      { "radar-v2": false },
      added,
      "a".repeat(40),
    );
    expect(errors).toEqual([]);
    const bundle = JSON.parse(content);
    expect(bundle.entries.map((e: { id: string }) => e.id)).toEqual(["draft", "newer", "older"]);
    expect(bundle.entries.map((e: { changeDate: string }) => e.changeDate)).toEqual([
      null,
      "2026-10-12",
      "2026-10-11",
    ]);
    expect(content).not.toContain("CI only");
    expect(version.entryIds).toEqual(["draft", "newer", "older"]);
  });

  it("is deterministic, so a scheduled rebuild republishes identical notes", () => {
    const fragments = parse(entry({}));
    const added = new Map([["evening-filter", DAY]]);
    const first = buildBundle(fragments, {}, added, "b".repeat(40));
    expect(buildBundle(fragments, {}, added, "b".repeat(40))).toEqual(first);
  });

  it("refuses notes that name an unregistered feature", () => {
    const { errors } = buildBundle(parse(entry({ feature: "mystery" })), {}, new Map(), "c");
    expect(errors).toEqual([
      "evening-filter.json: unknown feature mystery (see changelog/features.json)",
    ]);
  });
});

describe("changelog policy", () => {
  it("requires a new fragment in every PR", () => {
    expect(checkPolicy([{ status: "M", path: "src/app.tsx" }])).toHaveLength(1);
    expect(
      checkPolicy([
        { status: "M", path: "src/app.tsx" },
        { status: "A", path: "changelog/entries/evening-filter.json" },
      ]),
    ).toEqual([]);
  });

  it("refuses to remove a merged entry", () => {
    expect(
      checkPolicy([
        { status: "D", path: "changelog/entries/old.json" },
        { status: "A", path: "changelog/entries/new.json" },
      ]),
    ).toEqual([
      "changelog/entries/old.json: published entry IDs are stable; do not remove or rename",
    ]);
  });
});

describe("committed fragments", () => {
  const files = readdirSync("changelog/entries").map((name) => ({
    name,
    text: readFileSync(`changelog/entries/${name}`, "utf8"),
  }));
  it("are valid and link only to pages the app serves", () => {
    const { fragments, errors } = parseFragments(files);
    expect(errors).toEqual([]);
    for (const { href } of fragments.filter((fragment) => fragment.href)) {
      const path = href!.split("#")[0]!;
      expect(readView(new URL(path, "https://london-cine.info")).path, href).toBe(path);
    }
  });
});
