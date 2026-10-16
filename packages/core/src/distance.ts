export type Coordinates = { lat: number; lon: number };
export function validCoordinates(point: Coordinates): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lon) <= 180 &&
    !(point.lat === 0 && point.lon === 0)
  );
}
/** Haversine straight-line distance in miles; unknown locations never count as zero. */
export function distanceMiles(a: Coordinates, b: Coordinates): number | null {
  if (!validCoordinates(a) || !validCoordinates(b)) return null;
  const radians = (value: number) => (value * Math.PI) / 180;
  const lat = radians(b.lat - a.lat),
    lon = radians(b.lon - a.lon);
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lon / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function withinRadius(distance: number | null, radius: number): boolean {
  return radius === 0 || (distance !== null && distance <= radius);
}
