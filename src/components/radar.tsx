import { useState } from "preact/hooks";
import { screeningMatcher, isFilmFormat, isImaxFormat } from "../lib/filters";
import { formatDate } from "../lib/catalogue";
import { FilmTable } from "./film-table";
import type { DataMeta, Film } from "../shared/data";
import type { ViewState } from "../lib/catalogue";
import type { DisplayState } from "../lib/display";
import { radarEntries, radarFilms } from "../lib/radar";
import type { CalendarInput } from "../shared/calendar";
import type { CalendarState } from "../lib/calendar";
export function Radar({
  films,
  meta,
  state,
  now,
  display,
  watched,
  expanded,
  onExpand,
  onChange,
  calendar,
  onCalendar,
}: {
  calendar?: CalendarState;
  onCalendar?: (event: CalendarInput) => void;
  films: Film[];
  meta: DataMeta;
  state: ViewState;
  now: Date;
  display: DisplayState;
  watched?: Set<string>;
  expanded: string | null;
  onExpand: (key: string | null) => void;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
}) {
  const entries = radarEntries(films, meta, now);
  const gauge = state.filmGauge;
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem("radar-collapsed") ?? "[]");
      return Array.isArray(value)
        ? value.filter((id) => ["limited", "film", "imax"].includes(id))
        : [];
    } catch {
      return [];
    }
  });
  function toggle(section: string) {
    const next = collapsed.includes(section)
      ? collapsed.filter((id) => id !== section)
      : [...collapsed, section];
    setCollapsed(next);
    try {
      localStorage.setItem("radar-collapsed", JSON.stringify(next));
    } catch {
      /* Storage may be unavailable. */
    }
  }
  return (
    <div class="radar-page">
      <div class="radar-intro">
        <p>Find films with few screenings left, or screenings in 35mm, 70mm and IMAX.</p>
        <details>
          <summary>How Radar works · listing coverage</summary>
          <p>
            Counts cover all listed cinemas before your filters, include sold-out screenings and
            exclude starts that have passed. Programmes may be incomplete or change; few listings do
            not mean a definitive last chance. Generic IMAX does not identify digital versus film.
          </p>
          <p>
            Updated{" "}
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/London",
            }).format(new Date(meta.generatedAt))}
            . Listing horizon: {meta.facets.day[0]?.id}–{meta.facets.day.at(-1)?.id}.
          </p>
        </details>
      </div>
      {(["limited", "film", "imax"] as const).map((section) => {
        const sectionState = {
          ...state,
          radarSection: section,
          filmGauge: section === "film" ? gauge : undefined,
        };
        const visible = radarFilms(
          entries,
          meta,
          sectionState,
          section,
          now,
          watched,
          display.titleMode,
        );
        const matcher = screeningMatcher(meta, sectionState, now);
        const title = { limited: "Limited opportunity", film: "On film", imax: "IMAX" }[section];
        const closed = collapsed.includes(section);
        const labels = new Map(
          entries.map((entry) => {
            const relevant =
              section === "limited"
                ? entry.screenings
                : entry.special.filter(
                    (row) =>
                      (section === "film"
                        ? isFilmFormat(row.formats, gauge)
                        : isImaxFormat(row.formats)) && matcher.row(row, entry.film),
                  );
            const formats = [
              ...new Set(
                relevant
                  .flatMap((row) => row.formats)
                  .filter((format) =>
                    section === "film" ? isFilmFormat([format], gauge) : isImaxFormat([format]),
                  ),
              ),
            ].map(
              (format) =>
                meta.facets.format.find((option) => option.id === format)?.label ?? format,
            );
            return [
              entry.film.id,
              `${section === "limited" ? "Only " : `${formats.join(" / ")} · `}${relevant.length} screening${relevant.length === 1 ? "" : "s"} listed · ${relevant[0] ? formatDate(relevant[0].date) : ""}`,
            ];
          }),
        );
        return (
          <section key={section} aria-label={title}>
            <h2>
              <button
                class="radar-section-toggle"
                aria-expanded={!closed}
                aria-controls={`radar-${section}`}
                onClick={() => toggle(section)}
              >
                <span>
                  {closed ? "▸" : "▾"} {title}
                </span>
                <small>
                  {visible.length} {visible.length === 1 ? "film" : "films"}
                </small>
              </button>
            </h2>
            <p class="view-note">
              {section === "limited"
                ? "1–3 upcoming screenings listed across all cinemas."
                : section === "film"
                  ? "Explicit 35mm / 70mm screenings."
                  : "Explicit IMAX screenings; generic IMAX does not identify film projection."}
            </p>
            <div id={`radar-${section}`} hidden={closed}>
              {section === "film" && (
                <div class="gauge-filter">
                  <label for="radar-gauge">Film format</label>
                  <select
                    id="radar-gauge"
                    value={gauge ?? ""}
                    onChange={(event) =>
                      onChange({
                        filmGauge:
                          event.currentTarget.value === "35mm"
                            ? "35mm"
                            : event.currentTarget.value === "70mm"
                              ? "70mm"
                              : undefined,
                        page: 1,
                      })
                    }
                  >
                    <option value="">35mm & 70mm</option>
                    <option value="35mm">35mm</option>
                    <option value="70mm">70mm</option>
                  </select>
                </div>
              )}
              <FilmTable
                films={visible}
                calendar={calendar}
                onCalendar={onCalendar}
                meta={meta}
                state={sectionState}
                now={now}
                display={display}
                watched={watched}
                labels={labels}
                expanded={
                  expanded?.startsWith(`${section}:`) ? expanded.slice(section.length + 1) : null
                }
                onExpand={(key) => onExpand(key ? `${section}:${key}` : null)}
                onChange={onChange}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
