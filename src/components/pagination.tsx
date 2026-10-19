import type { Film } from "../shared/data";
import { pageRows, PAGE_SIZE, type ViewState } from "../lib/catalogue";

/** Shared page footer for the list and poster views. */
export function Pagination({
  films,
  state,
  onExpand,
  onChange,
}: {
  films: Film[];
  state: ViewState;
  onExpand: (id: string | null) => void;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
}) {
  if (!films.length) return null;
  const { rows, page, pageCount, start } = pageRows(films, state);
  function go(next: number) {
    onExpand(null);
    onChange({ page: next });
    window.scrollTo({ top: 0 });
  }
  return (
    <footer class="pagination" aria-label="Film pagination">
      <div>
        <strong>
          {films.length.toLocaleString("en-GB")} {films.length === 1 ? "film" : "films"}
        </strong>
        <span class="result-range">
          {" "}
          · {state.path === "/retrospectives" ? "rows " : ""}
          {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)}
        </span>
      </div>
      <div class="page-controls">
        <button disabled={page <= 1} aria-label="Previous page" onClick={() => go(page - 1)}>
          ‹
        </button>
        <label>
          Page{" "}
          <select
            aria-label="Page"
            value={page}
            onChange={(event) => go(Number(event.currentTarget.value))}
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <option key={index} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
          <span> of {pageCount}</span>
        </label>
        <button disabled={page >= pageCount} aria-label="Next page" onClick={() => go(page + 1)}>
          ›
        </button>
      </div>
    </footer>
  );
}
