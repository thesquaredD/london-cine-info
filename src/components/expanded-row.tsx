import { screeningMatcher } from "../lib/filters";
import type { ViewState } from "../lib/catalogue";
import { useEffect, useState } from "preact/hooks";
import type { DataMeta, Film, FilmShowtimes, RatingKey } from "../shared/data";
import { RATINGS, formatDate, runtime } from "../lib/catalogue";
import { loadShowtimes } from "../lib/data";

import type { CalendarInput } from "../shared/calendar";
import type { CalendarState } from "../lib/calendar";
export function ExpandedRow({
  film,
  meta,
  detailId,
  columns = 7,
  state,
  ratingOrder,
  now,
  calendar,
  onCalendar,
}: {
  calendar?: CalendarState;
  onCalendar?: (event: CalendarInput) => void;
  now?: Date;
  film: Film;
  meta: DataMeta;
  detailId: string;
  columns?: number;
  state: ViewState;
  ratingOrder: RatingKey[];
}) {
  const [data, setData] = useState<FilmShowtimes | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    loadShowtimes(film.id)
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [film.id, attempt]);
  const matcher = screeningMatcher(meta, state, now);
  const days = data
    ? Object.entries(data.days)
        .map(([date, rows]) => [date, rows.filter((row) => matcher.showtime(date, row))] as const)
        .filter(([, rows]) => rows.length)
    : [];
  const venues = new Map(meta.venues.map((venue) => [venue.id, venue]));
  const genres = film.ge.map(
    (id) => meta.facets.genre.find((genre) => genre.id === id)?.label ?? id,
  );
  return (
    <tr class="expanded-row">
      <td colSpan={columns}>
        <section id={detailId} class="film-expanded" aria-label={`Screenings for ${film.ti}`}>
          <div class="film-info">
            <figure class="poster" tabIndex={0} aria-label={`Film information for ${film.ti}`}>
              {film.po && !posterFailed ? (
                <img
                  src={film.po}
                  alt={`${film.ti} poster`}
                  loading="lazy"
                  onError={() => setPosterFailed(true)}
                />
              ) : (
                <div class="poster-placeholder">
                  {film.ti}
                  <span>Poster unavailable</span>
                </div>
              )}
              <figcaption>
                {film.rd ? formatDate(film.rd) : (film.ye ?? "Year unknown")}
                <br />
                {runtime(film.ru)}
                {film.cl && ` · ${film.cl}`}
              </figcaption>
              <div class="poster-overlay">
                {data?.details.actors.length ? (
                  <p>{data.details.actors.map((actor) => actor.name).join(", ")}</p>
                ) : null}
                <div class="genre-pills">
                  <span>
                    {meta.facets.language.find((option) => option.id === film.la)?.label ?? film.la}
                  </span>
                  {genres.map((genre) => (
                    <span key={genre}>{genre}</span>
                  ))}
                </div>
                {data?.details.overview && <p class="overview">{data.details.overview}</p>}
              </div>
            </figure>
            <div class="rating-cards">
              {ratingOrder.map((key) => {
                const source = RATINGS.find((rating) => rating.key === key)!;
                const rating = film.ra[source.key];
                const content = (
                  <>
                    <span>{source.name}</span>
                    <strong>
                      {rating?.value ?? "?"}
                      <small>
                        {rating?.value !== null && rating?.value !== undefined ? source.scale : ""}
                      </small>
                    </strong>
                  </>
                );
                return rating ? (
                  <a
                    key={source.key}
                    class="rating-card"
                    href={rating.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${source.name} rating for ${film.ti}`}
                  >
                    {content}
                  </a>
                ) : (
                  <div key={source.key} class="rating-card missing">
                    {content}
                  </div>
                );
              })}
            </div>
            {film.tr && (
              <a class="trailer-link" href={film.tr} target="_blank" rel="noopener noreferrer">
                Watch trailer ↗
              </a>
            )}
          </div>
          <div class="showtimes">
            {!data && !error && (
              <p role="status" class="details-status">
                Loading screenings…
              </p>
            )}
            {error && (
              <div role="alert" class="details-status">
                <p>Screening details could not be loaded.</p>
                <button onClick={() => setAttempt((value) => value + 1)}>Try again</button>
              </div>
            )}
            {data && !days.length && (
              <p class="details-status">No screenings match these filters.</p>
            )}
            {data &&
              days.map(([date, rows]) => (
                <section class="showtime-day" key={date} aria-label={formatDate(date)}>
                  <h3>
                    {new Intl.DateTimeFormat("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "Europe/London",
                    }).format(new Date(`${date}T12:00:00Z`))}
                  </h3>
                  <ul>
                    {rows.map((row, index) => {
                      const venue = venues.get(row.venue);
                      const event: CalendarInput = {
                        filmId: film.id,
                        title: film.ti,
                        venueId: row.venue,
                        venueName: venue?.name ?? row.venue,
                        address: venue?.address ?? "",
                        start: row.time,
                        end: film.ru && film.ru > 0 ? Math.round(row.time + film.ru * 60000) : null,
                        bookingUrl: row.bookingUrl,
                        screen: row.screen,
                        notes: row.notes,
                        formats: row.formats,
                      };
                      const saved = calendar?.find(event);
                      return (
                        <li
                          key={`${row.time}-${row.venue}-${index}`}
                          class={row.soldOut ? "sold-out" : ""}
                        >
                          <time dateTime={new Date(row.time).toISOString()}>{row.localTime}</time>
                          <span class="time-dot" aria-hidden="true" />
                          <div class="screening-info">
                            <a
                              href={row.bookingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`${row.bookingFallback ? "Screening details for" : "Book"} ${film.ti} at ${venue?.name ?? row.venue} ${row.localTime}`}
                            >
                              {venue?.name ?? row.venue}
                            </a>
                            {row.bookingFallback && <span class="badge">Screening details</span>}
                            {row.soldOut && <span class="badge sold-out-badge">Sold out</span>}
                            {row.formats
                              .filter((format) => format !== "standard")
                              .map((format) => (
                                <span class="badge" key={format}>
                                  {meta.facets.format.find((option) => option.id === format)
                                    ?.label ?? format}
                                </span>
                              ))}
                            {row.accessibility.map((flag) => (
                              <span class="badge accessibility" key={flag}>
                                {meta.facets.accessibility.find((option) => option.id === flag)
                                  ?.label ?? flag}
                              </span>
                            ))}
                            {onCalendar && (
                              <button
                                class="add-calendar"
                                aria-haspopup="dialog"
                                aria-label={`${saved ? "View saved screening" : "Add to calendar"}: ${film.ti} at ${venue?.name ?? row.venue} ${date} ${row.localTime}`}
                                onClick={() => onCalendar(event)}
                              >
                                {saved ? "In my calendar" : "Add to calendar"}
                              </button>
                            )}
                            {(row.notes || row.screen) && (
                              <small>
                                {[row.screen && `Screen ${row.screen}`, row.notes]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
          </div>
        </section>
      </td>
    </tr>
  );
}
