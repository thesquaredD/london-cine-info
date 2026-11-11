import { duration, morphDelay } from "../ui/motion-values";
import { space, thumbnail } from "../ui/tokens";

/**
 * The pure half of the List ⇄ Posters morph (plan: "List ⇄ posters morph"): where each poster
 * is in either layout, which film anchors the scroll position, and how one shared progress
 * value turns into each poster's staggered flight. The React half is `morph-overlay.tsx`.
 *
 * Coordinates: a FlashList layout (`getLayout(index)`) is in content coordinates; a `Rect` is in
 * the list's viewport, so it is the layout minus the scroll offset.
 */

export type Rect = { x: number; y: number; width: number; height: number };

/** The poster grid (mock-up 1): 3 columns, 16 at the screen edges, 8 between posters, 2:3. */
export const GRID = { columns: 3, edge: space.l, gap: space.s } as const;

/** The poster size in the grid for a list `width` points wide. */
export function gridPoster(width: number): { width: number; height: number } {
  const posterWidth = (width - 2 * GRID.edge - (GRID.columns - 1) * GRID.gap) / GRID.columns;
  return { width: posterWidth, height: posterWidth * 1.5 };
}

/**
 * FlashList gives each of the 3 columns an equal third of the width. A left inset of 16, 8 and
 * 0 points in the three columns puts the posters 16 from both edges and 8 apart.
 */
export function gridInset(column: number): number {
  return [GRID.edge, GRID.gap, 0][column] ?? 0;
}

/** The column of a grid cell from its layout's x, for a list `width` points wide. */
export function gridColumn(cellX: number, width: number): number {
  return Math.max(0, Math.min(GRID.columns - 1, Math.round(cellX / (width / GRID.columns))));
}

/** The grid cell's own height: the poster plus the 8-point gap above it. */
export function gridCellHeight(width: number): number {
  return gridPoster(width).height + GRID.gap;
}

/** The poster inside a grid cell, in viewport coordinates. */
export function gridPosterRect(cell: Rect, width: number, scrollY: number): Rect {
  const poster = gridPoster(width);
  return {
    x: cell.x + gridInset(gridColumn(cell.x, width)),
    y: cell.y + GRID.gap - scrollY,
    width: poster.width,
    height: poster.height,
  };
}

/** The list row's top padding above its thumbnail (film-row.tsx). */
export const ROW_PADDING_TOP = 14;

/** The 48×72 thumbnail inside a list row, in viewport coordinates. */
export function rowThumbnailRect(row: Rect, scrollY: number): Rect {
  return {
    x: row.x + space.l,
    y: row.y + ROW_PADDING_TOP - scrollY,
    width: thumbnail.width,
    height: thumbnail.height,
  };
}

export type LaidOut = { key: string; layout: Rect };

/**
 * The film at the top of the viewport: the first film (in list order) whose cell still shows
 * more than `minVisible` points below the top edge. `delta` is its distance from that edge, so
 * the other layout can put the same film at the same place.
 */
export function chooseAnchor(
  items: readonly LaidOut[],
  scrollY: number,
  minVisible = 8,
): { key: string; delta: number } | null {
  for (const item of items)
    if (item.layout.y + item.layout.height - scrollY > minVisible)
      return { key: item.key, delta: item.layout.y - scrollY };
  return null;
}

/** The scroll offset that puts the anchor `delta` points from the top, within the content. */
export function anchoredOffset(anchorY: number, delta: number, maxOffset: number): number {
  return Math.max(0, Math.min(Math.max(0, maxOffset), anchorY - delta));
}

/** The items whose cell intersects the viewport `[offset, offset + height)`. */
export function visibleItems(items: readonly LaidOut[], offset: number, height: number): LaidOut[] {
  return items.filter(
    (item) => item.layout.y < offset + height && item.layout.y + item.layout.height > offset,
  );
}

export type Flight = {
  key: string;
  from: Rect;
  to: Rect;
  /** Milliseconds after the morph starts that this poster leaves. */
  delay: number;
  /** "in": appears where it lands; "out": fades where it was; "none": flies. */
  fade: "none" | "in" | "out";
};

export type MorphPlan = { flights: Flight[]; total: number; toPosters: boolean };

/**
 * Pairs the posters visible before the switch with those visible after it. A film visible in
 * both flies; one visible only before fades out in place; one visible only after fades in in
 * place. The stagger runs in reading order of the grid (top row first, left to right) going to
 * posters, and in reverse going back to the list.
 */
export function planMorph(
  start: ReadonlyMap<string, Rect>,
  end: ReadonlyMap<string, Rect>,
  toPosters: boolean,
): MorphPlan {
  const keys = [...new Set([...start.keys(), ...end.keys()])];
  const grid = (key: string) =>
    (toPosters ? (end.get(key) ?? start.get(key)) : (start.get(key) ?? end.get(key)))!;
  keys.sort((a, b) => grid(a).y - grid(b).y || grid(a).x - grid(b).x || a.localeCompare(b));
  const flights = keys.map((key, index): Flight => {
    const from = start.get(key);
    const to = end.get(key);
    return {
      key,
      from: from ?? to!,
      to: to ?? from!,
      delay: morphDelay(index, keys.length, toPosters),
      fade: from && to ? "none" : from ? "out" : "in",
    };
  });
  return {
    flights,
    total: flights.length ? duration.morph + (flights.length - 1) * duration.morphStagger : 0,
    toPosters,
  };
}

/**
 * One poster's own linear progress (0 to 1) at the shared `progress` of a morph lasting
 * `total` ms. The caller applies the easing. Runs on the UI thread.
 */
export function flightProgress(progress: number, total: number, delay: number): number {
  "worklet";
  if (total <= 0) return 1;
  const t = (progress * total - delay) / duration.morph;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * The row text's opacity: it fades out over the first 160 ms going to posters and fades in
 * over the last 160 ms coming back to the list. Runs on the UI thread.
 */
export function rowTextOpacity(progress: number, total: number, toPosters: boolean): number {
  "worklet";
  const elapsed = progress * total;
  const span = duration.morphText;
  const t = toPosters ? 1 - elapsed / span : (elapsed - (total - span)) / span;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Linear interpolation between two rectangles. Runs on the UI thread. */
export function mixRect(from: Rect, to: Rect, t: number): Rect {
  "worklet";
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}
