import { Fragment } from "preact";
import type { DataMeta, Film } from "../shared/data";
import { PAGE_SIZE, RATINGS, type SortKey, type ViewState } from "../lib/catalogue";
import { ExpandedRow } from "./expanded-row";

type Props = {
  films: Film[];
  meta: DataMeta;
  state: ViewState;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
};
export function FilmTable({ films, meta, state, expanded, onExpand, onChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(films.length / PAGE_SIZE));
  const page = Math.min(state.page, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  function heading(key: SortKey, label: string, compact = false) {
    const selected = state.sort === key;
    return (
      <th
        scope="col"
        class={`${key}-column ${compact ? "mobile-hidden" : ""}`}
        aria-sort={selected ? (state.direction === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          onClick={() =>
            onChange({
              sort: key,
              direction:
                selected && state.direction === "desc"
                  ? "asc"
                  : selected
                    ? "desc"
                    : key === "title" || key === "director"
                      ? "asc"
                      : "desc",
              page: 1,
            })
          }
          aria-label={`Sort by ${label}`}
        >
          <span title={RATINGS.find((rating) => rating.key === key)?.name}>{label}</span>
          <span class={`sort-arrow ${selected ? "selected" : ""}`} aria-hidden="true">
            {selected && state.direction === "desc" ? "▾" : "▴"}
          </span>
        </button>
      </th>
    );
  }
  return (
    <>
      {films.length ? (
        <table class="film-table" aria-label="Films">
          <thead>
            <tr>
              {heading("title", "Title")}
              {heading("director", "Director")}
              {RATINGS.map((rating) => heading(rating.key, rating.short, true))}
              {heading("year", "Year", true)}
            </tr>
          </thead>
          <tbody>
            {films.slice(start, start + PAGE_SIZE).map((film) => (
              <Fragment key={film.id}>
                <tr class={`film-row ${expanded === film.id ? "is-expanded" : ""}`}>
                  <td class="title-column">
                    <button
                      class="film-title"
                      aria-expanded={expanded === film.id}
                      aria-controls={`details-${film.id}`}
                      onClick={() => onExpand(expanded === film.id ? null : film.id)}
                    >
                      <span class="expansion-icon" aria-hidden="true">
                        {expanded === film.id ? "▾" : "▸"}
                      </span>
                      <span>
                        {film.ti}
                        {film.o_ti && <i>{film.o_ti}</i>}
                      </span>
                    </button>
                  </td>
                  <td class="director-column">
                    {film.di.length ? (
                      film.di.map((director, index) => (
                        <Fragment key={director.id}>
                          {index > 0 && ", "}
                          <a
                            class={film.retro.includes(director.id) ? "retrospective-director" : ""}
                            href={`/?director=${encodeURIComponent(director.id)}`}
                            onClick={(event) => {
                              if (
                                event.button ||
                                event.metaKey ||
                                event.ctrlKey ||
                                event.shiftKey ||
                                event.altKey
                              )
                                return;
                              event.preventDefault();
                              onChange({ path: "/", director: director.id, page: 1 }, true);
                            }}
                          >
                            {director.name}
                          </a>
                        </Fragment>
                      ))
                    ) : (
                      <span class="missing">Unknown</span>
                    )}
                  </td>
                  {RATINGS.map((source) => {
                    const rating = film.ra[source.key];
                    return (
                      <td key={source.key} class="rating-column mobile-hidden">
                        {rating ? (
                          <a
                            class={`rating-chip ${rating.value === null ? "missing" : ""}`}
                            href={rating.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${source.name}: ${rating.value ?? "unrated"} for ${film.ti}`}
                          >
                            {rating.value ?? "?"}
                          </a>
                        ) : (
                          <span class="rating-chip missing" aria-label={`${source.name}: unrated`}>
                            ?
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td class="year-column mobile-hidden">
                    {film.ye ?? <span class="missing">?</span>}
                  </td>
                </tr>
                {expanded === film.id && (
                  <ExpandedRow key={`details-${film.id}`} film={film} meta={meta} />
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      ) : (
        <div class="empty-state">
          <h2>No films match these filters</h2>
          <p>Try another title, director or language.</p>
          <button onClick={() => onChange({ search: "", language: "", director: "", page: 1 })}>
            Clear filters
          </button>
        </div>
      )}
      <footer class="pagination" aria-label="Film pagination">
        <div>
          <strong>{films.length.toLocaleString("en-GB")} films</strong>
          {films.length > 0 && (
            <span class="result-range">
              {" "}
              · {start + 1}–{Math.min(start + PAGE_SIZE, films.length)}
            </span>
          )}
        </div>
        <div class="page-controls">
          <button
            disabled={page <= 1}
            aria-label="Previous page"
            onClick={() => {
              onExpand(null);
              onChange({ page: page - 1 });
              window.scrollTo({ top: 0 });
            }}
          >
            ‹
          </button>
          <label>
            Page{" "}
            <select
              aria-label="Page"
              value={page}
              onChange={(event) => {
                onExpand(null);
                onChange({ page: Number(event.currentTarget.value) });
                window.scrollTo({ top: 0 });
              }}
            >
              {Array.from({ length: pageCount }, (_, index) => (
                <option key={index} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
            <span> of {pageCount}</span>
          </label>
          <button
            disabled={page >= pageCount}
            aria-label="Next page"
            onClick={() => {
              onExpand(null);
              onChange({ page: page + 1 });
              window.scrollTo({ top: 0 });
            }}
          >
            ›
          </button>
        </div>
      </footer>
    </>
  );
}
