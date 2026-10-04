import { FilmTable } from "./film-table";
import type { DataMeta, Film } from "../shared/data";
import type { ViewState } from "../lib/catalogue";
import type { DisplayState } from "../lib/display";
import { radarEntries, radarFilms } from "../lib/radar";
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
}: {
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
  return (
    <div class="radar-page">
      <p class="view-note">
        Explore the current listings snapshot. Counts cover all listed cinemas before your filters,
        include sold-out screenings, and exclude starts that have passed. Programmes may be
        incomplete or change; a small count does not mean a definitive last chance.
      </p>
      <p class="view-note">
        Updated{" "}
        {new Intl.DateTimeFormat("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/London",
        }).format(new Date(meta.generatedAt))}
        . Listing horizon: {meta.facets.day[0]?.id}–{meta.facets.day.at(-1)?.id}.
      </p>
      {(["limited", "formats"] as const).map((section) => {
        const visible = radarFilms(entries, meta, state, section, now, watched, display.titleMode);
        const labels = new Map(
          entries.map((entry) => [
            entry.film.id,
            section === "limited"
              ? `Only ${entry.screenings.length} screening${entry.screenings.length === 1 ? "" : "s"} listed · ${entry.screenings[0]?.date ?? ""}`
              : `${entry.special.length} special-format screening${entry.special.length === 1 ? "" : "s"} listed · ${entry.special[0]?.date ?? ""}`,
          ]),
        );
        return (
          <section
            key={section}
            aria-label={section === "limited" ? "Limited opportunity" : "Special formats"}
          >
            <h2>{section === "limited" ? "Limited opportunity" : "Special formats"}</h2>
            <p class="view-note">
              {section === "limited"
                ? "One to three distinct upcoming screenings across the full listing horizon."
                : "Explicitly listed 35mm, 70mm and IMAX screenings. Generic IMAX does not identify digital versus film; unspecified formats are excluded."}
            </p>
            <FilmTable
              films={visible}
              meta={meta}
              state={{ ...state, radarSection: section }}
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
          </section>
        );
      })}
    </div>
  );
}
