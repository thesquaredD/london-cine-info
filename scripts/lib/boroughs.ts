import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Borough } from "../../src/shared/data";

const point = z.tuple([z.number(), z.number()]);
const polygon = z.array(z.array(point));
const featureSchema = z.object({
  properties: z.object({ code: z.string(), name: z.string(), region: z.enum(["inner", "outer"]) }),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  geometry: z.discriminatedUnion("type", [
    z.object({ type: z.literal("Polygon"), coordinates: polygon }),
    z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(polygon) }),
  ]),
});
type Feature = z.infer<typeof featureSchema>;
type Point = [number, number];

// 0 = boundary, 1 = interior, -1 = exterior. Polygon holes stay outside.
function ringContains([x, y]: Point, ring: Point[]): number {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (
      Math.abs(cross) < 1e-12 &&
      x >= Math.min(xi, xj) &&
      x <= Math.max(xi, xj) &&
      y >= Math.min(yi, yj) &&
      y <= Math.max(yi, yj)
    )
      return 0;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? 1 : -1;
}
export function polygonContains(point: Point, rings: Point[][]): boolean {
  const exterior = ringContains(point, rings[0] ?? []);
  if (exterior === -1) return false;
  if (exterior === 0) return true;
  for (const hole of rings.slice(1)) {
    const position = ringContains(point, hole);
    if (position === 0) return true;
    if (position === 1) return false;
  }
  return true;
}
export class BoroughIndex {
  constructor(private features: Feature[]) {}
  get boroughs(): Borough[] {
    return this.features.map((f) => ({
      id: f.properties.code,
      name: f.properties.name,
      region: f.properties.region,
    }));
  }
  locate(lon: number, lat: number): string {
    for (const feature of this.features) {
      const [minX, minY, maxX, maxY] = feature.bbox;
      if (lon < minX || lon > maxX || lat < minY || lat > maxY) continue;
      const polygons =
        feature.geometry.type === "Polygon"
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      if (polygons.some((rings) => polygonContains([lon, lat], rings)))
        return feature.properties.code;
    }
    return "outside-london";
  }
}
export async function loadBoroughs(): Promise<BoroughIndex> {
  const content: unknown = JSON.parse(
    await readFile(new URL("../../src/data/london-boroughs.geojson", import.meta.url), "utf8"),
  );
  const data = z
    .object({ type: z.literal("FeatureCollection"), features: z.array(featureSchema).length(33) })
    .parse(content);
  return new BoroughIndex(data.features);
}
