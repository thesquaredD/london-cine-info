import { useRef, useState } from "preact/hooks";
import { capture } from "../lib/analytics";
import { displayTitle, type DisplayState, type FilmView } from "../lib/display";
import { pageRows, RATINGS, runtime, type TableRow, type ViewState } from "../lib/catalogue";
import { letterboxdSlug } from "../shared/account";
import type { DataMeta, Film } from "../shared/data";
import type { CalendarInput } from "../shared/calendar";
import type { CalendarState } from "../lib/calendar";
import { Dialog } from "./dialog";
import { EmptyState } from "./empty-state";
import { ExpandedRow } from "./expanded-row";
import { Pagination } from "./pagination";

/** TMDB serves the catalogue's w342 posters at smaller widths too. */
function posterSources(url: string) {
  const match = /^(https:\/\/image\.tmdb\.org\/t\/p\/)w342(\/.+)$/.exec(url);
  if (!match) return {};
  return {
    srcset: `${match[1]}w185${match[2]} 185w, ${match[1]}w342${match[2]} 342w`,
    sizes: "(max-width: 479px) 46vw, (max-width: 599px) 31vw, (max-width: 1099px) 25vw, 200px",
  };
}

/** The first rows are visible straight away, so they skip lazy loading. */
const EAGER_POSTERS = 12;
export function PosterArt({
  film,
  title,
  eager = false,
}: {
  film: Film;
  title: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return film.po && !failed ? (
    <img
      class="poster-art"
      src={film.po}
      {...posterSources(film.po)}
      alt=""
      width={342}
      height={513}
      loading={eager ? "eager" : "lazy"}
      fetchpriority={eager ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : (
    <span class="poster-art poster-fallback">
      <span class="poster-fallback-title">{title}</span>
      <span class="poster-fallback-note">{film.ye ?? ""}</span>
    </span>
  );
}

export function ViewSwitch({
  value,
  onChange,
}: {
  value: FilmView;
  onChange: (view: FilmView) => void;
}) {
  return (
    <div class="view-switch" role="group" aria-label="Show films as">
      <button type="button" aria-pressed={value === "list"} onClick={() => onChange("list")}>
        <svg class="view-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M1 3h14M1 8h14M1 13h14" fill="none" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <span class="view-switch-label">List</span>
      </button>
      <button type="button" aria-pressed={value === "posters"} onClick={() => onChange("posters")}>
        <svg class="view-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <rect x="1" y="1" width="6" height="6" rx="0.75" />
          <rect x="9" y="1" width="6" height="6" rx="0.75" />
          <rect x="1" y="9" width="6" height="6" rx="0.75" />
          <rect x="9" y="9" width="6" height="6" rx="0.75" />
        </svg>
        <span class="view-switch-label">Posters</span>
      </button>
    </div>
  );
}

type Props = {
  films: Film[];
  meta: DataMeta;
  state: ViewState;
  display: DisplayState;
  now?: Date;
  watched?: Set<string>;
  directorName?: string;
  showEmpty?: boolean;
  calendar?: CalendarState;
  onCalendar?: (event: CalendarInput) => void;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
};

/** Groups consecutive rows that share a director or release-date heading. */
function sections(rows: TableRow[]) {
  const result: { group: TableRow["group"]; rows: TableRow[] }[] = [];
  for (const row of rows) {
    const last = result.at(-1);
    if (last && last.group?.id === row.group?.id) last.rows.push(row);
    else result.push({ group: row.group, rows: [row] });
  }
  return result;
}

export function PosterGrid({
  films,
  meta,
  state,
  display,
  now,
  watched,
  directorName,
  showEmpty = true,
  calendar,
  onCalendar,
  expanded,
  onExpand,
  onChange,
}: Props) {
  const { rows, start, visible } = pageRows(films, state);
  const marked = (film: Film) => !!watched?.has(letterboxdSlug(film.ra.lb?.url) ?? "");
  const rating = display.ratingOrder.length
    ? RATINGS.find((source) => source.key === display.ratingOrder[0])
    : undefined;
  const active = visible.find((row) => row.key === expanded);
  // Remember the last open film so focus can return to its poster after the dialog closes,
  // including when it was opened from a link or by a click that did not focus the poster.
  const lastOpen = useRef<string | null>(null);
  if (active) lastOpen.current = active.key;
  const order = new Map(visible.map((row, index) => [row.key, index]));
  function open(row: TableRow) {
    capture("film_opened", {
      film_id: row.film.id,
      path: state.path,
      on_watchlist: marked(row.film),
      watchlist: state.path === "/watchlist" || !!state.watchlist,
    });
    onExpand(row.key);
  }
  // Replace rather than push, so Back does not reopen a film the reader just closed.
  const close = () => onChange({ film: undefined }, false);
  if (!films.length)
    return showEmpty ? (
      <EmptyState directorName={directorName} state={state} meta={meta} onChange={onChange} />
    ) : null;
  return (
    <>
      <div class="poster-view">
        {sections(visible).map(({ group, rows: entries }, index) => (
          <section
            key={`${group?.id ?? "all"}-${index}`}
            class="poster-section"
            aria-label={group?.name ?? "Films"}
          >
            {group && (
              <h3 class="poster-group">
                {group.name}{" "}
                <small>
                  {group.count} {group.count === 1 ? "film" : "films"}
                  {index === 0 && start > 0 && rows[start - 1]?.group?.id === group.id
                    ? " · continued"
                    : ""}
                </small>
              </h3>
            )}
            <ul class="poster-grid" role="list">
              {entries.map((row) => {
                const { film, key } = row;
                const title = displayTitle(film, display.titleMode);
                const original = display.titleMode === "both" && film.o_ti ? film.o_ti : null;
                const score = rating ? film.ra[rating.key]?.value : null;
                const venues = new Set(film.sc.map((screening) => screening[2])).size;
                const facts = [
                  film.ye,
                  film.ru ? runtime(film.ru) : null,
                  rating
                    ? `${rating.short} ${score != null ? `${score}${rating.scale}` : "–"}`
                    : null,
                ].filter(Boolean);
                const count = `${film.sc.length} ${film.sc.length === 1 ? "screening" : "screenings"} · ${venues} ${venues === 1 ? "cinema" : "cinemas"}`;
                const describe = `poster-facts-${key}`;
                return (
                  <li key={key} class="poster-item" data-film-key={key}>
                    <button
                      type="button"
                      class="poster-card"
                      aria-haspopup="dialog"
                      aria-label={`${title}${marked(film) ? ", on your watchlist" : ""}`}
                      aria-describedby={describe}
                      onClick={() => open(row)}
                    >
                      <span class="poster-frame">
                        <PosterArt
                          film={film}
                          title={title}
                          eager={(order.get(key) ?? EAGER_POSTERS) < EAGER_POSTERS}
                        />
                        {marked(film) && (
                          <span class="poster-mark" aria-hidden="true">
                            ▣
                          </span>
                        )}
                        <span class="poster-info" aria-hidden="true">
                          <span class="poster-info-title">{title}</span>
                          <span class="poster-info-facts">{facts.join(" · ")}</span>
                        </span>
                      </span>
                    </button>
                    <span id={describe} class="sr-only">
                      {[original, ...facts, count].filter(Boolean).join(", ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <Pagination films={films} state={state} onExpand={onExpand} onChange={onChange} />
      <Dialog
        open={!!active}
        title={active ? displayTitle(active.film, display.titleMode) : "Film screenings"}
        className="modal-dialog poster-film-dialog"
        onClose={close}
        restoreTo={() =>
          lastOpen.current
            ? document.querySelector<HTMLElement>(
                `[data-film-key="${CSS.escape(lastOpen.current)}"] .poster-card`,
              )
            : null
        }
      >
        {active && (
          <table class="film-table poster-detail-table">
            <tbody>
              <ExpandedRow
                film={active.film}
                meta={meta}
                state={state}
                detailId={`details-${active.key}`}
                columns={1}
                ratingOrder={display.ratingOrder}
                now={now}
                calendar={calendar}
                onCalendar={onCalendar}
              />
            </tbody>
          </table>
        )}
      </Dialog>
    </>
  );
}
