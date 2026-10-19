import { ExternalLinkIcon } from "./external-link-icon";
import { filmProviderLinks } from "../lib/film-links";
import { capture } from "../lib/analytics";
import { screeningMatcher } from "../lib/filters";
import type { ViewState } from "../lib/catalogue";
import { useEffect, useRef, useState } from "preact/hooks";
import type { DataMeta, Film, FilmShowtimes, RatingKey } from "../shared/data";
import { RATINGS, formatDate, runtime } from "../lib/catalogue";
import { loadShowtimes } from "../lib/data";
import { openFeedback } from "../lib/feedback";
import { ScreeningRow } from "./screening-row";

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
  const [shareMessage, setShareMessage] = useState("");
  const shareTimers = useRef<number[]>([]);
  // Clear then re-set so screen readers announce every share, and drop the message after a
  // while; the status region keeps its height, so nothing around it moves.
  const announceShare = (message: string) => {
    shareTimers.current.forEach((timer) => window.clearTimeout(timer));
    setShareMessage("");
    shareTimers.current = [
      window.setTimeout(() => setShareMessage(message), 100),
      window.setTimeout(() => setShareMessage(""), 5000),
    ];
  };
  useEffect(() => () => shareTimers.current.forEach((timer) => window.clearTimeout(timer)), []);
  // Local "Find a screening" choices belong to one film; the page also to one programme.
  const [choice, setChoice] = useState({ film: film.id, date: "", venue: "" });
  const [paging, setPaging] = useState<{ key: string; page: number } | null>(null);
  const programme = useRef<HTMLDivElement>(null);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [overviewOverflow, setOverviewOverflow] = useState(false);
  const synopsis = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const node = synopsis.current;
    if (!node || overviewExpanded) return;
    const measure = () => setOverviewOverflow(node.scrollHeight > node.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [data, overviewExpanded]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    loadShowtimes(film.id)
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) {
          setError(true);
          capture("showtimes_load_failed", { film_id: film.id });
        }
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
  const venueName = (id: string) => venues.get(id)?.name ?? id;
  // Days are keyed by London date, so sorting by time keeps each day's rows together.
  const allRows = days
    .flatMap(([date, rows]) => rows.map((row) => ({ date, row })))
    .sort(
      (a, b) =>
        a.row.time - b.row.time || venueName(a.row.venue).localeCompare(venueName(b.row.venue)),
    );
  const pageSize = 12;
  const findable = allRows.length > pageSize;
  // Choices apply only while the controls show, and drop out when global filters remove them.
  const local = findable && choice.film === film.id ? choice : { date: "", venue: "" };
  const chosenDate = days.some(([date]) => date === local.date) ? local.date : "";
  const chosenVenue = allRows.some(({ row }) => row.venue === local.venue) ? local.venue : "";
  const matchingRows = allRows.filter(
    ({ date, row }) =>
      (!chosenDate || date === chosenDate) && (!chosenVenue || row.venue === chosenVenue),
  );
  const dateCounts = new Map<string, number>();
  const venueCounts = new Map<string, number>();
  for (const { date, row } of allRows) {
    if (!chosenVenue || row.venue === chosenVenue)
      dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
    if (!chosenDate || date === chosenDate)
      venueCounts.set(row.venue, (venueCounts.get(row.venue) ?? 0) + 1);
  }
  const programmeVenues = [...new Set(allRows.map(({ row }) => row.venue))].sort((a, b) =>
    venueName(a).localeCompare(venueName(b)),
  );
  // Any change of film, global filters or local choices starts the programme again at page 1.
  const pageKey = `${film.id}|${chosenDate}|${chosenVenue}|${JSON.stringify(state)}`;
  // The key check resets on the same render; the effect forgets the old page so that
  // returning to an earlier key (Reset, or undoing a filter) does not bring it back.
  const programmePage: number | null = paging?.key === pageKey ? paging.page : null;
  useEffect(() => setPaging(null), [pageKey]);
  const pageCount = Math.max(1, Math.ceil(matchingRows.length / pageSize));
  const currentPage = Math.min(programmePage ?? 0, pageCount - 1);
  const start = currentPage * pageSize;
  const visibleRows = matchingRows.slice(start, start + pageSize);
  const visibleDays = [...new Set(visibleRows.map(({ date }) => date))].map(
    (date) =>
      [date, visibleRows.filter((entry) => entry.date === date).map(({ row }) => row)] as const,
  );
  const turnPage = (page: number) => {
    setPaging({ key: pageKey, page });
    programme.current?.scrollIntoView({ block: "start" });
  };
  const genres = film.ge.map(
    (id) => meta.facets.genre.find((genre) => genre.id === id)?.label ?? id,
  );
  return (
    <tr class="expanded-row">
      <td colSpan={columns}>
        <section id={detailId} class="film-expanded" aria-label={`Screenings for ${film.ti}`}>
          <div class="film-info">
            <figure class="poster" aria-label={`${film.ti} poster`}>
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
            </figure>
            <div class="film-description">
              <h3 class="film-detail-title">{film.ti}</h3>
              <p class="film-facts">
                {film.ye ?? "Year unknown"} · {runtime(film.ru)}
                {film.cl && ` · ${film.cl}`}
              </p>
              <p class="film-genres">
                {[
                  meta.facets.language.find((option) => option.id === film.la)?.label ?? film.la,
                  ...genres,
                ].join(" · ")}
              </p>
              {ratingOrder.length > 0 && (
                <div class="rating-cards">
                  {ratingOrder.map((key) => {
                    const source = RATINGS.find((rating) => rating.key === key)!;
                    const rating = film.ra[source.key];
                    const content = (
                      <>
                        <span>{source.short}</span>
                        <strong>
                          {rating?.value ?? "?"}
                          <small>
                            {rating?.value !== null && rating?.value !== undefined
                              ? source.scale
                              : ""}
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
              )}
              <div class="film-provider-links" role="group" aria-label="Film websites">
                {filmProviderLinks(film).map((provider) => (
                  <a
                    key={provider.name}
                    href={provider.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {provider.label} <ExternalLinkIcon />
                  </a>
                ))}
              </div>
              <div class="film-links">
                {film.tr && (
                  <a class="trailer-link" href={film.tr} target="_blank" rel="noopener noreferrer">
                    Watch trailer <ExternalLinkIcon />
                  </a>
                )}
                <button
                  class="share-film"
                  onClick={async () => {
                    try {
                      const url = new URL(window.location.href);
                      if (url.pathname === "/events") {
                        url.pathname = "/";
                        url.searchParams.delete("eventType");
                        url.searchParams.set("film", film.id);
                      } else if (!url.searchParams.has("film"))
                        url.searchParams.set("film", film.id);
                      await navigator.clipboard.writeText(url.href);
                      announceShare("Film link copied");
                    } catch {
                      announceShare("Copy the address bar to share.");
                    }
                  }}
                >
                  Share film
                </button>
                <button
                  class="feedback-link"
                  onClick={() =>
                    openFeedback({ category: "listing", context: { filmId: film.id } })
                  }
                >
                  Report a listing problem
                </button>
              </div>
              <div role="status" class="share-status">
                {shareMessage}
              </div>
            </div>
          </div>
          <div class="showtimes" ref={programme}>
            {data && findable && (
              <div class="programme-controls" role="group" aria-label="Find a screening">
                <label>
                  Date
                  <select
                    aria-label="Screening date"
                    value={chosenDate}
                    onChange={(event) =>
                      setChoice({
                        film: film.id,
                        date: event.currentTarget.value,
                        venue: chosenVenue,
                      })
                    }
                  >
                    <option value="">All dates</option>
                    {days.map(([date]) => (
                      <option key={date} value={date} disabled={!dateCounts.get(date)}>
                        {formatDate(date)} · {dateCounts.get(date) ?? 0}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cinema
                  <select
                    aria-label="Screening cinema"
                    value={chosenVenue}
                    onChange={(event) =>
                      setChoice({
                        film: film.id,
                        date: chosenDate,
                        venue: event.currentTarget.value,
                      })
                    }
                  >
                    <option value="">All cinemas</option>
                    {programmeVenues.map((id) => (
                      <option key={id} value={id} disabled={!venueCounts.get(id)}>
                        {venueName(id)} · {venueCounts.get(id) ?? 0}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={!chosenDate && !chosenVenue}
                  onClick={() => setChoice({ film: film.id, date: "", venue: "" })}
                >
                  Reset
                </button>
                <p role="status" class="programme-count">
                  {matchingRows.length
                    ? `${start + 1}–${start + visibleRows.length} of ${matchingRows.length} screenings`
                    : "No screenings for this date and cinema"}
                </p>
              </div>
            )}
            {!data && !error && (
              <p role="status" class="details-status">
                Loading screenings…
              </p>
            )}
            {error && (
              <div role="alert" class="details-status">
                <p>Screening details could not be loaded.</p>
                <button onClick={() => setAttempt((value) => value + 1)}>Try again</button>
                <button
                  class="feedback-link"
                  onClick={() =>
                    openFeedback({ context: { filmId: film.id, errorCode: "showtimes_load" } })
                  }
                >
                  Report this problem
                </button>
              </div>
            )}
            {data && !days.length && (
              <p class="details-status">No screenings match these filters.</p>
            )}
            {data &&
              visibleDays.map(([date, rows]) => (
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
                        <ScreeningRow
                          key={`${row.time}-${row.venue}-${index}`}
                          dateTime={new Date(row.time).toISOString()}
                          localTime={row.localTime}
                          venue={venue?.name ?? row.venue}
                          soldOut={row.soldOut}
                          tags={[
                            ...(row.soldOut
                              ? [{ key: "sold-out", label: "Sold out", kind: "sold-out" as const }]
                              : []),
                            ...row.formats
                              .filter((format) => format !== "standard")
                              .map((format) => ({
                                key: format,
                                label:
                                  meta.facets.format.find((option) => option.id === format)
                                    ?.label ?? format,
                              })),
                            ...row.accessibility.map((flag) => ({
                              key: flag,
                              label:
                                meta.facets.accessibility.find((option) => option.id === flag)
                                  ?.label ?? flag,
                              kind: "accessibility" as const,
                            })),
                          ]}
                          note={
                            [row.screen && `Screen ${row.screen}`, row.notes]
                              .filter(Boolean)
                              .join(" · ") || undefined
                          }
                        >
                          <a
                            class="booking-action"
                            href={row.bookingUrl}
                            onClick={() =>
                              capture(
                                row.bookingFallback
                                  ? "screening_details_clicked"
                                  : "booking_clicked",
                                {
                                  film_id: film.id,
                                  venue_id: row.venue,
                                  sold_out: row.soldOut,
                                  booking_fallback: row.bookingFallback,
                                  path: state.path,
                                  watchlist: state.path === "/watchlist" || !!state.watchlist,
                                },
                              )
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${row.bookingFallback || row.soldOut ? "Screening details for" : "Book"} ${film.ti} at ${venue?.name ?? row.venue} ${row.localTime}`}
                          >
                            {row.bookingFallback || row.soldOut ? "Details" : "Book"}{" "}
                            <ExternalLinkIcon />
                          </a>
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
                        </ScreeningRow>
                      );
                    })}
                  </ul>
                </section>
              ))}
            {data && pageCount > 1 && (
              <nav class="programme-pagination" aria-label="Screening pages">
                <button disabled={currentPage === 0} onClick={() => turnPage(currentPage - 1)}>
                  Previous screenings
                </button>
                <span>
                  Page {currentPage + 1} of {pageCount}
                </span>
                <button
                  disabled={currentPage + 1 === pageCount}
                  onClick={() => turnPage(currentPage + 1)}
                >
                  Next screenings
                </button>
              </nav>
            )}
          </div>
          <details class="film-about">
            <summary>More details</summary>
            <div class="film-description">
              {data?.details.overview && (
                <>
                  <p ref={synopsis} class={`film-synopsis ${overviewExpanded ? "full" : ""}`}>
                    {data.details.overview}
                  </p>
                  {(overviewOverflow || overviewExpanded) && (
                    <button
                      class="synopsis-toggle"
                      aria-expanded={overviewExpanded}
                      onClick={() => setOverviewExpanded(!overviewExpanded)}
                    >
                      {overviewExpanded ? "Less" : "Read more"}
                    </button>
                  )}
                </>
              )}
              {data?.details.actors.length ? (
                <details class="film-cast">
                  <summary>Cast</summary>
                  <p>{data.details.actors.map((actor) => actor.name).join(", ")}</p>
                </details>
              ) : null}
            </div>
          </details>
        </section>
      </td>
    </tr>
  );
}
