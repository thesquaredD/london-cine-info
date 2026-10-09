import { capture } from "../lib/analytics";
import { FilmFriends } from "./friends";
import { displayTitle, type DisplayState } from "../lib/display";
import { letterboxdSlug } from "../shared/account";
import { clearFilters } from "../lib/filters";
import { Fragment } from "preact";
import type { DataMeta, Film } from "../shared/data";
import {
  hasCustomSort,
  sortLabel,
  PAGE_SIZE,
  RATINGS,
  tableRows,
  nextSort,
  type SortKey,
  type ViewState,
} from "../lib/catalogue";
import { ExpandedRow } from "./expanded-row";

import type { CalendarInput } from "../shared/calendar";
import type { CalendarState } from "../lib/calendar";
type Props = {
  calendar?: CalendarState;
  onCalendar?: (event: CalendarInput) => void;
  showEmpty?: boolean;
  films: Film[];
  display: DisplayState;
  now?: Date;
  labels?: Map<string, string>;
  watched?: Set<string>;
  meta: DataMeta;
  state: ViewState;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
};
export function FilmTable({
  films,
  meta,
  state,
  expanded,
  onExpand,
  onChange,
  watched,
  display,
  now,
  labels,
  calendar,
  onCalendar,
  showEmpty = true,
}: Props) {
  const mobileColumn =
    hasCustomSort(state) &&
    state.sort !== "title" &&
    state.sort !== "director" &&
    state.sort !== "opportunity"
      ? state.sort
      : null;
  const marked = (film: Film) => !!watched?.has(letterboxdSlug(film.ra.lb?.url) ?? "");
  const ratings = display.ratingOrder.map((key) => RATINGS.find((rating) => rating.key === key)!);
  const rows = tableRows(films, state);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(state.page, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  function heading(key: SortKey, label: string, compact = false, extraClass = "") {
    const selected = state.sort === key;
    return (
      <th
        scope="col"
        class={`${key}-column ${compact ? "mobile-hidden" : ""} ${extraClass}`}
        aria-sort={selected ? (state.direction === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          onClick={() =>
            onChange({
              ...nextSort(state, key),
              page: 1,
            })
          }
          aria-label={key === "watchlist" ? "Sort watchlist first" : `Sort by ${label}`}
        >
          <span
            title={
              key === "watchlist"
                ? "Letterboxd watchlist"
                : RATINGS.find((rating) => rating.key === key)?.name
            }
          >
            {label}
          </span>
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
              {watched && heading("watchlist", "▣")}
              {heading("title", "Title")}
              {mobileColumn &&
                heading(mobileColumn, sortLabel(mobileColumn), false, "mobile-sort-column")}
              {heading("director", "Director", !!mobileColumn)}
              {ratings.map((rating) => heading(rating.key, rating.short, true))}
              {state.path === "/events"
                ? heading("event", "Event", true)
                : heading("year", "Year", true)}
            </tr>
          </thead>
          <tbody>
            {rows.slice(start, start + PAGE_SIZE).map(({ film, group, key }, index) => (
              <Fragment key={key}>
                {group && (index === 0 || group.id !== rows[start + index - 1]?.group?.id) && (
                  <tr class={state.path === "/calendar" ? "release-group" : "director-group"}>
                    <td colSpan={(watched ? 4 : 3) + ratings.length + (mobileColumn ? 1 : 0)}>
                      <h3>{group.name}</h3>{" "}
                      <small>
                        {group.count} {group.count === 1 ? "film" : "films"}
                        {index === 0 && start > 0 && rows[start - 1]?.group?.id === group.id
                          ? " · continued"
                          : ""}
                      </small>
                    </td>
                  </tr>
                )}
                <tr class={`film-row ${expanded === key ? "is-expanded" : ""}`}>
                  {watched && (
                    <td class="watchlist-column">
                      {marked(film) && (
                        <a
                          href={film.ra.lb!.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${film.ti} is on your Letterboxd watchlist`}
                        >
                          ▣
                        </a>
                      )}
                    </td>
                  )}
                  <td class="title-column">
                    <button
                      class="film-title"
                      aria-expanded={expanded === key}
                      aria-controls={`details-${state.radarSection ?? ""}${key}`}
                      onClick={() => {
                        if (expanded !== key)
                          capture("film_opened", {
                            film_id: film.id,
                            path: state.path,
                            on_watchlist: marked(film),
                            watchlist: state.path === "/watchlist" || !!state.watchlist,
                          });
                        onExpand(expanded === key ? null : key);
                      }}
                    >
                      <span class="expansion-icon" aria-hidden="true">
                        {expanded === key ? "▾" : "▸"}
                      </span>
                      <span>
                        {displayTitle(film, display.titleMode)}
                        {display.titleMode === "both" && film.o_ti && <i>{film.o_ti}</i>}
                      </span>
                    </button>
                    <FilmFriends film={film} />
                    {labels?.has(film.id) && <p class="radar-label">{labels.get(film.id)}</p>}
                    {state.path === "/events" && (
                      <div class="mobile-event-labels">
                        {(film.ev?.length ? film.ev : ["Special screening"]).join(" · ")}
                      </div>
                    )}
                  </td>
                  {mobileColumn && (
                    <td class="mobile-sort-column">
                      {mobileColumn === "year" ? (
                        (film.ye ?? <span class="missing">?</span>)
                      ) : mobileColumn === "runtime" ? (
                        film.ru === null ? (
                          <span class="missing">?</span>
                        ) : (
                          `${film.ru} min`
                        )
                      ) : mobileColumn === "watchlist" ? (
                        marked(film) ? (
                          "▣"
                        ) : (
                          "—"
                        )
                      ) : mobileColumn === "event" ? (
                        film.ev?.join(" · ") || "Special screening"
                      ) : (
                        <span
                          class={`rating-chip ${film.ra[mobileColumn]?.value == null ? "missing" : ""}`}
                          aria-label={`${sortLabel(mobileColumn)}: ${film.ra[mobileColumn]?.value ?? "unrated"}`}
                        >
                          {film.ra[mobileColumn]?.value ?? "?"}
                          {film.ra[mobileColumn]?.value != null && (
                            <small>
                              {RATINGS.find((rating) => rating.key === mobileColumn)?.scale}
                            </small>
                          )}
                        </span>
                      )}
                    </td>
                  )}
                  <td class={`director-column ${mobileColumn ? "mobile-hidden" : ""}`}>
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
                  {ratings.map((source) => {
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
                  {state.path === "/events" ? (
                    <td class="event-column mobile-hidden">
                      {(film.ev?.length ? film.ev : ["Special screening"]).map((label) => (
                        <span key={label} class="badge">
                          {label}
                        </span>
                      ))}
                    </td>
                  ) : (
                    <td class="year-column mobile-hidden">
                      {film.ye ?? <span class="missing">?</span>}
                    </td>
                  )}
                </tr>
                {expanded === key && (
                  <ExpandedRow
                    key={`details-${key}`}
                    detailId={`details-${state.radarSection ?? ""}${key}`}
                    now={now}
                    calendar={calendar}
                    onCalendar={onCalendar}
                    columns={(watched ? 4 : 3) + ratings.length + (mobileColumn ? 1 : 0)}
                    film={film}
                    ratingOrder={display.ratingOrder}
                    meta={meta}
                    state={state}
                  />
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      ) : showEmpty ? (
        <div class="empty-state">
          <h2>No films match these filters</h2>
          <p>Try removing a filter or choosing another day or cinema.</p>
          <button onClick={() => onChange(clearFilters(state.path))}>Clear filters</button>
        </div>
      ) : null}
      {films.length > 0 && (
        <footer class="pagination" aria-label="Film pagination">
          <div>
            <strong>
              {films.length.toLocaleString("en-GB")} {films.length === 1 ? "film" : "films"}
            </strong>
            {films.length > 0 && (
              <span class="result-range">
                {" "}
                · {state.path === "/retrospectives" ? "rows " : ""}
                {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)}
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
      )}
    </>
  );
}
