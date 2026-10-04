import type { Film, RatingKey } from "../shared/data";
export type TitleMode = "both" | "title" | "original";
export type DisplayState = { titleMode: TitleMode; ratingOrder: RatingKey[] };
export const DEFAULT_DISPLAY: DisplayState = {
  titleMode: "both",
  ratingOrder: ["lb", "im", "mc", "rt"],
};
export function displayTitle(film: Film, mode: TitleMode): string {
  return mode === "original" ? film.o_ti || film.ti : film.ti;
}
export function moveRating(
  order: RatingKey[],
  source: RatingKey,
  destination: number,
): RatingKey[] {
  const result = order.filter((key) => key !== source);
  result.splice(Math.max(0, Math.min(result.length, destination)), 0, source);
  return result;
}
