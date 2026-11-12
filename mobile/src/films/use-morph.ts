import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  runOnJS,
  runOnUI,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { FlashListRef } from "@shopify/flash-list";
import type { FilmView } from "@readograph/core/display";
import { crossFade, duration, MORPH_STYLE } from "@/ui/motion";
import {
  anchoredOffset,
  chooseAnchor,
  gridPosterRect,
  visibleItems,
  planMorph,
  rowThumbnailRect,
  type LaidOut,
  type MorphPlan,
  type Rect,
} from "./morph";
import type { TextGhost } from "./morph-overlay";
import type { ListItem } from "./rows";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

type PendingMount = { id: number; resolve: (ready: boolean) => void };

type Run = {
  source: FilmView;
  target: FilmView;
  sourceOffset: number;
  /** 1 while heading to the target layout, 0 after a second tap reversed it. */
  heading: 0 | 1;
  /** Taps are ignored while the layouts are read ("setup"); they reverse a "flight". */
  phase: "setup" | "flight";
  total: number;
};

/**
 * Drives the List ⇄ Posters switch (plan: "List ⇄ posters morph").
 *
 * 1. Read the visible cells' layouts and the scroll offset, and pick the film at the top of the
 *    viewport as the anchor. (FlashList's `getLayout` gives each cell's rectangle from its own
 *    layout pass, so no native `measure` round trip is needed.)
 * 2. Mount the hidden overlay at the start rectangles. Its native layout event swaps the
 *    overlay and cells through one shared opacity, then the list can switch layouts.
 * 3. Two frames later, scroll so the anchor film is where it was, and read the target cells.
 * 4. Fly every poster from one shared progress value; when it reaches the end, show the cells
 *    and hide the overlay in the same UI-thread frame, then unmount the overlay.
 *
 * A second tap during the flight reverses from the current position; at the start it puts the
 * source layout and offset back. Poster taps are ignored until the morph settles (`busy`).
 * With reduced motion, or `MORPH_STYLE = "crossFade"`, the cells fade out, the layout switches
 * with the anchor kept, and they fade back in (120 ms or 160 ms in all).
 */
export function useMorph({
  listRef,
  items,
  width,
  onLayoutChange,
  onSettled,
}: {
  listRef: RefObject<FlashListRef<ListItem> | null>;
  items: readonly ListItem[];
  width: number;
  /** Switches the list's own layout (numColumns 1 or 3). */
  onLayoutChange: (view: FilmView) => void;
  /** The layout the reader ended on, to store. */
  onSettled: (view: FilmView) => void;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);
  const cellsOpacity = useSharedValue(1);
  const [overlay, setOverlay] = useState<{
    mountId: number;
    plan: MorphPlan;
    texts: TextGhost[];
  } | null>(null);
  const mountId = useRef(0);
  const pendingMount = useRef<PendingMount | null>(null);
  const alive = useRef(true);
  const run = useRef<Run | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      run.current = null;
      pendingMount.current?.resolve(false);
      pendingMount.current = null;
      cancelAnimation(progress);
    };
  }, [progress]);

  const overlayReady = useCallback(
    (id: number) => {
      const pending = pendingMount.current;
      if (!pending || pending.id !== id) return;
      pendingMount.current = null;
      runOnUI((resolve: (ready: boolean) => void) => {
        "worklet";
        // The overlay uses the complement of this opacity: both swap in the same UI frame.
        cellsOpacity.value = 0;
        // Give that UI frame its commit before asking React to re-lay out the cells.
        requestAnimationFrame(() => runOnJS(resolve)(true));
      })(pending.resolve);
    },
    [cellsOpacity],
  );

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const widthRef = useRef(width);
  widthRef.current = width;
  // FlashList's own `getAbsoluteLastScrollOffset` only follows native scroll events, so a list
  // that has not scrolled yet reports the header's height. The screen passes `onScroll` here and
  // the morph keeps its own offset, set again whenever it scrolls the list itself.
  const offsetRef = useRef(0);
  const onScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    offsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  /** Each visible film's cell, in content coordinates (the list header included). */
  const visibleCells = useCallback((): { offset: number; cells: LaidOut[] } | null => {
    const list = listRef.current;
    if (!list) return null;
    const offset = offsetRef.current;
    const top = list.getFirstItemOffset();
    const cells: LaidOut[] = [];
    itemsRef.current.forEach((item, index) => {
      const layout = item.type === "film" ? list.getLayout(index) : undefined;
      if (layout) cells.push({ key: item.key, layout: { ...layout, y: layout.y + top } });
    });
    return { offset, cells: visibleItems(cells, offset, list.getWindowSize().height) };
  }, [listRef]);

  const posterRect = (view: FilmView, cell: Rect, offset: number) =>
    view === "list"
      ? rowThumbnailRect(cell, offset)
      : gridPosterRect(cell, widthRef.current, offset);

  /** Scrolls the new layout so the anchor film keeps its distance from the top. */
  const restoreAnchor = useCallback(
    (anchor: { key: string; delta: number } | null): number => {
      const list = listRef.current;
      if (!list || !anchor) return 0;
      const index = itemsRef.current.findIndex((item) => item.key === anchor.key);
      const layout = index >= 0 ? list.getLayout(index) : undefined;
      if (!layout) return offsetRef.current;
      const top = list.getFirstItemOffset();
      const content = list.getChildContainerDimensions().height + top;
      const offset = anchoredOffset(
        layout.y + top,
        anchor.delta,
        content - list.getWindowSize().height,
      );
      list.scrollToOffset({ offset, animated: false });
      offsetRef.current = offset;
      return offset;
    },
    [listRef],
  );

  const settle = useCallback(
    (view: FilmView) => {
      if (!alive.current) return;
      run.current = null;
      // The overlay stays at opacity 0 until it unmounts; the next morph sets it back to 1.
      setOverlay(null);
      onSettled(view);
    },
    [onSettled],
  );

  /** Any failure mid-morph: show the cells, drop the overlay and land on `view`. */
  const recover = useCallback(
    (view: FilmView) => {
      cancelAnimation(progress);
      cellsOpacity.value = 1;
      overlayOpacity.value = 0;
      run.current = null;
      setOverlay(null);
      onLayoutChange(view);
      onSettled(view);
    },
    [cellsOpacity, onLayoutChange, onSettled, overlayOpacity, progress],
  );

  /** The reversed morph is back at its start: put the source layout and offset back. */
  const unwind = useCallback(async () => {
    const current = run.current;
    if (!current) return;
    try {
      onLayoutChange(current.source);
      await nextFrame();
      await nextFrame();
      listRef.current?.scrollToOffset({ offset: current.sourceOffset, animated: false });
      offsetRef.current = current.sourceOffset;
      await nextFrame();
      cellsOpacity.value = 1;
      overlayOpacity.value = 0;
      settle(current.source);
    } catch {
      recover(current.source);
    }
  }, [cellsOpacity, listRef, onLayoutChange, overlayOpacity, recover, settle]);

  const animateTo = useCallback(
    (to: 0 | 1, total: number) => {
      const current = run.current;
      if (!current) return;
      current.heading = to;
      const remaining = Math.abs(to - progress.value) * total;
      const target = current.target;
      progress.value = withTiming(
        to,
        { duration: remaining, easing: Easing.linear, reduceMotion: ReduceMotion.System },
        (finished) => {
          if (!finished) return;
          if (to === 1) {
            // Cells and overlay swap in the same UI frame; the images match, so nothing blinks.
            cellsOpacity.value = 1;
            overlayOpacity.value = 0;
            runOnJS(settle)(target);
          } else runOnJS(unwind)();
        },
      );
    },
    [cellsOpacity, overlayOpacity, progress, settle, unwind],
  );

  const fadeSteps = useCallback(
    async (source: FilmView, target: FilmView, ms: number) => {
      const before = visibleCells();
      const anchor = before ? chooseAnchor(before.cells, before.offset) : null;
      run.current = {
        source,
        target,
        sourceOffset: before?.offset ?? 0,
        heading: 1,
        phase: "setup",
        total: 0,
      };
      const half = { ...crossFade, duration: ms / 2 };
      await new Promise<void>((resolve) => {
        cellsOpacity.value = withTiming(0, half, () => runOnJS(resolve)());
      });
      onLayoutChange(target);
      await nextFrame();
      await nextFrame();
      restoreAnchor(anchor);
      await nextFrame();
      restoreAnchor(anchor);
      cellsOpacity.value = withTiming(1, half);
      run.current = null;
      onSettled(target);
    },
    [cellsOpacity, onLayoutChange, onSettled, restoreAnchor, visibleCells],
  );

  const fadeSwitch = useCallback(
    async (source: FilmView, target: FilmView, ms: number) => {
      try {
        await fadeSteps(source, target, ms);
      } catch {
        recover(target);
      }
    },
    [fadeSteps, recover],
  );

  const flip = useCallback(
    async (source: FilmView, target: FilmView) => {
      const before = visibleCells();
      if (!before) {
        onLayoutChange(target);
        onSettled(target);
        return;
      }
      const anchor = chooseAnchor(before.cells, before.offset);
      const films = new Map(
        itemsRef.current.flatMap((item) => (item.type === "film" ? [[item.key, item.film]] : [])),
      );
      const start = new Map(
        before.cells.map((cell) => [cell.key, posterRect(source, cell.layout, before.offset)]),
      );
      const texts: TextGhost[] =
        source === "list"
          ? before.cells.map((cell) => ({
              key: cell.key,
              film: films.get(cell.key)!,
              rect: { ...cell.layout, y: cell.layout.y - before.offset },
            }))
          : [];
      run.current = {
        source,
        target,
        sourceOffset: before.offset,
        heading: 1,
        phase: "setup",
        total: 0,
      };
      progress.value = 0;
      overlayOpacity.value = 1;
      // React state alone does not mean the overlay exists on the native screen yet.
      const current = run.current;
      const id = ++mountId.current;
      const ready = await new Promise<boolean>((resolve) => {
        pendingMount.current = { id, resolve };
        setOverlay({ mountId: id, plan: planMorph(start, start, target === "posters"), texts });
      });
      if (!ready || !alive.current || run.current !== current) return;
      onLayoutChange(target);
      await nextFrame();
      await nextFrame();
      // Step 3: anchor, then read the target cells. The second pass corrects the offset once the
      // anchor's real cell (not FlashList's estimate) has been measured.
      restoreAnchor(anchor);
      await nextFrame();
      restoreAnchor(anchor);
      await nextFrame();
      const after = visibleCells();
      const end = new Map(
        (after?.cells ?? []).map((cell) => [
          cell.key,
          posterRect(target, cell.layout, after!.offset),
        ]),
      );
      const plan = planMorph(start, end, target === "posters");
      const textsFor =
        target === "list"
          ? (after?.cells ?? []).map((cell) => ({
              key: cell.key,
              film: films.get(cell.key)!,
              rect: { ...cell.layout, y: cell.layout.y - after!.offset },
            }))
          : texts;
      setOverlay({ mountId: id, plan, texts: textsFor });
      // Step 4.
      await nextFrame();
      if (!run.current) return;
      run.current.phase = "flight";
      run.current.total = plan.total;
      animateTo(1, plan.total);
    },
    [animateTo, onLayoutChange, onSettled, overlayOpacity, progress, restoreAnchor, visibleCells],
  );

  const toggle = useCallback(
    async (source: FilmView, target: FilmView) => {
      const current = run.current;
      if (current) {
        // A second tap: reverse from wherever the flight is (or resume after a reversal).
        if (current.phase !== "flight") return;
        if (target === current.source && current.heading === 1) {
          cancelAnimation(progress);
          animateTo(0, current.total);
        } else if (target === current.target && current.heading === 0) {
          cancelAnimation(progress);
          animateTo(1, current.total);
        }
        return;
      }
      if (source === target) return;
      if (reduced) return fadeSwitch(source, target, duration.crossFade);
      if (MORPH_STYLE === "crossFade") return fadeSwitch(source, target, duration.morphCrossFade);
      try {
        await flip(source, target);
      } catch {
        recover(target);
      }
    },
    [animateTo, fadeSwitch, flip, progress, recover, reduced],
  );

  return {
    mountId: overlay?.mountId ?? 0,
    overlayReady,
    plan: overlay?.plan ?? null,
    texts: overlay?.texts ?? [],
    progress,
    overlayOpacity,
    cellsOpacity,
    toggle,
    onScroll,
    /** True while a morph runs: poster taps wait until it settles. */
    busy: useCallback(() => run.current !== null, []),
  };
}
