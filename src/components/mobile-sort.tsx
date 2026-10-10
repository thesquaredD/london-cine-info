import { useState } from "preact/hooks";
import { Dialog } from "./dialog";
import {
  defaultSort,
  hasCustomSort,
  RATINGS,
  sortLabel,
  type SortKey,
  type ViewState,
} from "../lib/catalogue";

export function MobileSort({
  state,
  hideRatings = false,
  onChange,
}: {
  state: ViewState;
  hideRatings?: boolean;
  onChange: (changes: Partial<ViewState>) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = hasCustomSort(state);
  const keys: SortKey[] = [
    "title",
    "director",
    "year",
    "runtime",
    ...(hideRatings ? [] : RATINGS.map((rating) => rating.key)),
  ];
  const orderLabels =
    state.sort === "runtime"
      ? ["Shortest first", "Longest first"]
      : state.sort === "year"
        ? ["Oldest first", "Newest first"]
        : state.sort === "title" || state.sort === "director"
          ? ["A–Z", "Z–A"]
          : ["Lowest first", "Highest first"];
  function choose(key: string) {
    if (key === "default")
      onChange({
        ...(hideRatings
          ? { sort: "title" as const, direction: "asc" as const }
          : defaultSort(state.path)),
        sortExplicit: undefined,
        page: 1,
      });
    else {
      const sort = key as SortKey;
      onChange({
        sort,
        direction: ["title", "director", "runtime"].includes(sort) ? "asc" : "desc",
        sortExplicit: sort === defaultSort(state.path).sort ? true : undefined,
        page: 1,
      });
    }
  }
  return (
    <>
      <button
        class="mobile-sort-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Sort: ${sortLabel(state.sort)} · ${orderLabels[state.direction === "asc" ? 0 : 1]}`}
        onClick={() => setOpen(true)}
      >
        <span>Sort: {sortLabel(state.sort)}</span>
        <span class="mobile-sort-order"> · {orderLabels[state.direction === "asc" ? 0 : 1]}</span>
        <span class="control-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <Dialog
        open={open}
        title="Sort films"
        className="mobile-sort-dialog"
        onClose={() => setOpen(false)}
      >
        <label for="mobile-sort-field">Sort by</label>
        <select
          id="mobile-sort-field"
          data-initial-focus
          value={active ? state.sort : "default"}
          onChange={(event) => choose(event.currentTarget.value)}
        >
          <option value="default">
            Default · {sortLabel(hideRatings ? "title" : defaultSort(state.path).sort)}
          </option>
          {keys.map((key) => (
            <option key={key} value={key}>
              {sortLabel(key)}
            </option>
          ))}
        </select>
        <label for="mobile-sort-order">Order</label>
        <select
          id="mobile-sort-order"
          disabled={!active}
          value={state.direction}
          onChange={(event) =>
            onChange({
              direction: event.currentTarget.value as ViewState["direction"],
              sortExplicit:
                state.sort === defaultSort(state.path).sort &&
                event.currentTarget.value === defaultSort(state.path).direction
                  ? true
                  : undefined,
              page: 1,
            })
          }
        >
          <option value="asc">{orderLabels[0]}</option>
          <option value="desc">{orderLabels[1]}</option>
        </select>
        {state.path === "/calendar" && (
          <p class="filter-hint">
            Films stay grouped by release date. Sorting applies within each date.
          </p>
        )}
        <button type="button" disabled={!active} onClick={() => choose("default")}>
          Reset sort
        </button>
        <button class="view-results" type="button" onClick={() => setOpen(false)}>
          Done
        </button>
      </Dialog>
    </>
  );
}
