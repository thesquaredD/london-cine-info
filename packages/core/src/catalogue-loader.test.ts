import { it, expect } from "vitest";
import { fixture } from "../../../tests/catalogue-fixture";
import {
  validateCatalogue,
  validateManifest,
  validateShowtimes,
  resolveDataUrl,
  CatalogueVersionError,
} from "./catalogue-loader";
it("validates a complete catalogue, rejects count and generation mismatches and newer schemas", async () => {
  const data = await fixture();
  expect(validateCatalogue(data.manifest, data.films, data.meta, data.events).films).toHaveLength(
    6,
  );
  expect(() => validateCatalogue(data.manifest, [], data.meta, data.events)).toThrow(
    "incompatible",
  );
  expect(() =>
    validateCatalogue(
      data.manifest,
      data.films,
      { ...data.meta, generatedAt: "2020-01-01" },
      data.events,
    ),
  ).toThrow("incompatible");
  expect(() => validateManifest({ ...data.manifest, schemaVersion: 99 })).toThrow(
    CatalogueVersionError,
  );
  expect(() => validateManifest({ ...data.manifest, films: "/data/../secret" })).toThrow(
    "incompatible",
  );
});
it("resolves immutable paths at the same origin and rejects external or non-data paths", () => {
  expect(resolveDataUrl("https://london-cine.info", "/data/films.abc.json")).toBe(
    "https://london-cine.info/data/films.abc.json",
  );
  for (const path of ["https://evil.example/data/a.json", "/api/me", "javascript:alert(1)"])
    expect(() => resolveDataUrl("https://london-cine.info", path)).toThrow("Invalid");
});
it("checks showtime identity and structure before publishing it", () => {
  expect(() => validateShowtimes("a", { id: "b", days: {}, details: {} })).toThrow("incompatible");
  expect(() => validateShowtimes("a", { id: "a", days: { today: [{}] }, details: {} })).toThrow(
    "incompatible",
  );
});
