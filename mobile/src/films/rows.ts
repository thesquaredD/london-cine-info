import { tableRows, type ViewState } from "@readograph/core/catalogue";
import type { Film } from "@readograph/core/data";

/**
 * The Films list's items: the website's `tableRows` (release-date groups on the Release
 * calendar, director groups on Retrospectives, plain rows elsewhere) with a heading item
 * wherever the group changes. Both the list and the poster grid render these items; in the grid
 * a heading spans all three columns.
 */
export type ListItem =
  | { type: "group"; key: string; name: string; count: number }
  | { type: "film"; key: string; film: Film };

export function listItems(films: Film[], state: ViewState): ListItem[] {
  const items: ListItem[] = [];
  let group: string | null = null;
  for (const row of tableRows(films, state)) {
    if (row.group && row.group.id !== group)
      items.push({
        type: "group",
        key: `group:${row.group.id}`,
        name: row.group.name,
        count: row.group.count,
      });
    group = row.group?.id ?? null;
    items.push({ type: "film", key: row.key, film: row.film });
  }
  return items;
}

/** "3 films" under a group heading. */
export function filmCount(count: number): string {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? "film" : "films"}`;
}

/**
 * Each film's column in the poster grid: headings span the whole row, so the column count
 * starts again after each one.
 */
export function gridColumns(items: readonly ListItem[], columns = 3): Map<string, number> {
  const result = new Map<string, number>();
  let column = 0;
  for (const item of items) {
    if (item.type === "group") {
      column = 0;
      continue;
    }
    result.set(item.key, column);
    column = (column + 1) % columns;
  }
  return result;
}
