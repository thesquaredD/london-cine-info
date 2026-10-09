import { expect, it } from "vitest";
import { distanceMiles, withinRadius } from "./distance";
it("computes known distances symmetrically and rejects missing coordinates", () => {
  const london = { lat: 51.5074, lon: -0.1278 },
    paris = { lat: 48.8566, lon: 2.3522 };
  expect(distanceMiles(london, paris)).toBeCloseTo(213.48, 0);
  expect(distanceMiles(london, paris)).toBe(distanceMiles(paris, london));
  expect(distanceMiles(london, london)).toBe(0);
  expect(distanceMiles(london, { lat: 0, lon: 0 })).toBeNull();
  expect(distanceMiles(london, { lat: NaN, lon: 0 })).toBeNull();
});
it("includes radius boundaries while excluding unknown coordinates", () => {
  expect(withinRadius(1, 1)).toBe(true);
  expect(withinRadius(1.00001, 1)).toBe(false);
  expect(withinRadius(null, 1)).toBe(false);
  expect(withinRadius(null, 0)).toBe(true);
});
