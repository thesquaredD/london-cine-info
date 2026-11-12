import { addDays, DATE_SHORTCUTS } from "@readograph/core/filters";

/** A complete Monday-first grid, with empty cells outside this month. UTC noon avoids DST. */
export function monthCells(month: string): (string | null)[] {
  const first = `${month}-01`;
  const next = addDays(first, 32).slice(0, 7) + "-01";
  const length = Number(addDays(next, -1).slice(8));
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  return Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, i) =>
    i < offset || i >= offset + length ? null : addDays(first, i - offset),
  );
}

export function adjacentMonth(month: string, direction: -1 | 1): string {
  const first = `${month}-01`;
  return addDays(first, direction === -1 ? -1 : 32).slice(0, 7);
}

/** Match the website's exact-date and shortcut include/exclude rules, using the same IDs. */
export function toggleDate(
  selected: string[],
  excluded: string[],
  id: string,
  excludeMode: boolean,
): { selected: string[]; excluded: string[] } {
  if (DATE_SHORTCUTS.includes(id)) {
    if (!excludeMode)
      return { selected: selected.length === 1 && selected[0] === id ? [] : [id], excluded: [] };
    return {
      selected: selected.filter((value) => value !== id),
      excluded: excluded.includes(id)
        ? excluded.filter((value) => value !== id)
        : [...excluded, id],
    };
  }
  const included = selected.filter(
    (value) => value !== id && (excludeMode || !DATE_SHORTCUTS.includes(value)),
  );
  const rejected = excluded.filter((value) => value !== id);
  if (selected.includes(id) || excluded.includes(id))
    return { selected: included, excluded: rejected };
  return excludeMode
    ? { selected: included, excluded: [...rejected, id] }
    : { selected: [...included, id], excluded: rejected };
}
