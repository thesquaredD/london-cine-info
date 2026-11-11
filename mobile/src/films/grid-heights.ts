/** The part of a FlashList layout this module touches. */
type MutableLayout = { minHeight?: number };

/**
 * Lets the list rows take their own heights again after the Posters grid.
 *
 * FlashList 2's grid layout manager equalises each row by giving its shorter cells a
 * `minHeight` of the tallest poster. When `numColumns` goes back to 1, the linear layout manager
 * keeps the grid's layout objects, `minHeight` included, and only clears it for horizontal
 * lists, so those cells stayed 187 points tall with a gap under each 100-point row (seen on the
 * Android emulator, FlashList 2.3.2 and 2.3.3). `getLayout` returns FlashList's own layout
 * objects, so clearing `minHeight` on them before the switch hands the linear manager clean
 * layouts; the switch re-renders every cell (their width changes), so the style follows.
 *
 * Remove this once FlashList resets `minHeight` when the layout manager changes.
 */
export function releaseGridRowHeights(
  list: { getLayout(index: number): MutableLayout | undefined } | null,
  count: number,
): void {
  if (!list) return;
  for (let index = 0; index < count; index++) {
    const layout = list.getLayout(index);
    if (layout && layout.minHeight !== undefined) layout.minHeight = undefined;
  }
}
