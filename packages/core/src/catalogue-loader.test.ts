import { describe, expect, it } from "vitest";
import {
  IncompatibleDataError,
  parseManifest,
  resolveDataUrl,
  showtimesPath,
  validateCatalogue,
  validateShowtimes,
} from "./catalogue-loader";
import { DATA_SCHEMA_VERSION } from "./data";

const manifest = {
  schemaVersion: DATA_SCHEMA_VERSION,
  generatedAt: "2026-11-10T06:45:00.000Z",
  films: "/data/films.0123456789abcdef.json",
  meta: "/data/meta.0123456789abcdef.json",
  showtimes: "/data/showtimes.0123456789abcdef/",
  events: "/data/events.0123456789abcdef.json",
};
const meta = { schemaVersion: DATA_SCHEMA_VERSION, counts: { films: 2 } };
const films = [{ id: "a" }, { id: "b" }];

const rejection = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(IncompatibleDataError);
    return error as IncompatibleDataError;
  }
  throw new Error("expected the check to throw");
};

describe("parseManifest", () => {
  it("returns exactly the manifest fields", () => {
    expect(parseManifest({ ...manifest, extra: true })).toEqual(manifest);
  });

  it("flags a newer schema so the app can ask for an update", () => {
    const error = rejection(() =>
      parseManifest({ ...manifest, schemaVersion: DATA_SCHEMA_VERSION + 1 }),
    );
    expect(error.newerSchema).toBe(true);
    expect(rejection(() => parseManifest({ ...manifest, schemaVersion: 1 })).newerSchema).toBe(
      false,
    );
  });

  it("accepts a previous schema when the caller lists it", () => {
    const previous = { ...manifest, schemaVersion: DATA_SCHEMA_VERSION - 1 };
    expect(parseManifest(previous, [DATA_SCHEMA_VERSION, DATA_SCHEMA_VERSION - 1])).toEqual(
      previous,
    );
  });

  it.each([
    null,
    [],
    { ...manifest, generatedAt: "yesterday" },
    { ...manifest, films: "https://example.com/films.json" },
    { ...manifest, meta: "//example.com/meta.json" },
    { ...manifest, events: "data/events.json" },
    { ...manifest, showtimes: "/data/showtimes.0123" },
    { ...manifest, films: undefined },
  ])("rejects a malformed manifest (%#)", (value) => {
    rejection(() => parseManifest(value));
  });
});

describe("validateCatalogue", () => {
  it("returns the files when versions and counts agree", () => {
    expect(validateCatalogue(manifest, films, meta, [])).toEqual({ films, meta, events: [] });
  });

  it.each([
    ["manifest version", { schemaVersion: 1 }, films, meta, []],
    ["metadata version", manifest, films, { ...meta, schemaVersion: 1 }, []],
    ["metadata missing", manifest, films, null, []],
    ["films not a list", manifest, {}, meta, []],
    ["events not a list", manifest, films, meta, {}],
    ["film count", manifest, films.slice(1), meta, []],
    ["counts missing", manifest, films, { schemaVersion: DATA_SCHEMA_VERSION }, []],
  ])("rejects a mismatched %s", (_, m, f, me, e) => {
    rejection(() => validateCatalogue(m, f, me, e));
  });

  it("marks newer metadata as needing an update", () => {
    const newer = { ...meta, schemaVersion: DATA_SCHEMA_VERSION + 1 };
    expect(rejection(() => validateCatalogue(manifest, films, newer, [])).newerSchema).toBe(true);
  });
});

describe("validateShowtimes", () => {
  const file = { id: "a", days: {}, details: { actors: [], overview: null } };

  it("returns a matching file", () => {
    expect(validateShowtimes("a", file)).toBe(file);
  });

  it.each([null, { ...file, id: "b" }, { ...file, days: undefined }, { id: "a", days: {} }])(
    "rejects a mismatched file (%#)",
    (value) => {
      rejection(() => validateShowtimes("a", value));
    },
  );
});

describe("paths", () => {
  it("builds a showtime path with the id encoded", () => {
    expect(showtimesPath(manifest, "a b/c")).toBe(
      "/data/showtimes.0123456789abcdef/a%20b%2Fc.json",
    );
  });

  it("resolves manifest paths against the site origin only", () => {
    expect(resolveDataUrl("https://london-cine.info", manifest.films)).toBe(
      "https://london-cine.info/data/films.0123456789abcdef.json",
    );
    expect(resolveDataUrl("https://london-cine.info/", showtimesPath(manifest, "a"))).toBe(
      "https://london-cine.info/data/showtimes.0123456789abcdef/a.json",
    );
    for (const path of ["https://example.com/x.json", "//example.com/x.json", "/\\example.com"])
      rejection(() => resolveDataUrl("https://london-cine.info", path));
  });
});
