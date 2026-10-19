import { ExternalLinkIcon } from "./external-link-icon";
import { filmProviderLinks } from "../lib/film-links";
import { findSharedScreening, shareUrl } from "../lib/sharing";
import { CopyFallback } from "./copy-fallback";
import { Notice } from "./notice";
import { ShareScreening } from "./share-screening";
import { capture } from "../lib/analytics";
import { screeningMatcher } from "../lib/filters";
import type { ViewState } from "../lib/catalogue";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { DataMeta, Film, FilmShowtimes, RatingKey, Showtime } from "../shared/data";
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
  const [shareFallback, setShareFallback] = useState("");
  // A screening link the clipboard refused, shown across that screening's row.
  const [rowFallback, setRowFallback] = useState<{ row: Showtime; url: string } | null>(null);
  // The shared link this sheet last scrolled to, so later renders leave the reader in place.
  const arrived = useRef("");
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
  // Local "Find a screening" choices and the page belong to one film under one set of
  // global filters; `key` records which, so a stale choice reads as empty.
  const [choice, setChoice] = useState({ key: "", date: "", venue: "" });
  const [paging, setPaging] = useState<{ key: string; page: number } | null>(null);
  const programme = useRef<HTMLDivElement>(null);
  const programmeStatus = useRef<HTMLParagraphElement>(null);
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
  const stateKey = JSON.stringify(state);
  // The clock ticks every 15 seconds; the programme only needs refiltering once a minute.
  const nowMinute = now ? Math.floor(now.getTime() / 60000) : null;
  const { days, venues, venueName, allRows, programmeVenues } = useMemo(() => {
    const matcher = screeningMatcher(meta, state, now);
    const days = data
      ? Object.entries(data.days)
          .map(([date, rows]) => [date, rows.filter((row) => matcher.showtime(date, row))] as const)
          .filter(([, rows]) => rows.length)
      : [];
    const venues = new Map(meta.venues.map((venue) => [venue.id, venue]));
    const venueName = (id: string) => venues.get(id)?.name ?? id;
    // Days are keyed by London date, so sorting by time keeps each day's rows together;
    // screenings at the same time read in cinema-name order.
    const allRows = days
      .flatMap(([date, rows]) => rows.map((row) => ({ date, row })))
      .sort(
        (a, b) =>
          a.row.time - b.row.time || venueName(a.row.venue).localeCompare(venueName(b.row.venue)),
      );
    const programmeVenues = [...new Set(allRows.map(({ row }) => row.venue))].sort((a, b) =>
      venueName(a).localeCompare(venueName(b)),
    );
    return { days, venues, venueName, allRows, programmeVenues };
    // `now` is read through nowMinute; `state` through its serialised key.
  }, [data, meta, stateKey, nowMinute]);
  const pageSize = 12;
  const findable = allRows.length > pageSize;
  // Any change of film or global filters drops the local choices and the page. The key
  // check does it on the same render; the effect forgets them so that returning to an
  // earlier key (Back, or undoing a filter) does not bring them back.
  const choiceKey = `${film.id}|${stateKey}`;
  useEffect(() => {
    setChoice({ key: "", date: "", venue: "" });
    setPaging(null);
  }, [choiceKey]);
  const local = findable && choice.key === choiceKey ? choice : { date: "", venue: "" };
  const chosenDate = days.some(([date]) => date === local.date) ? local.date : "";
  const chosenVenue = allRows.some(({ row }) => row.venue === local.venue) ? local.venue : "";
  const choose = (date: string, venue: string) => {
    setChoice({ key: choiceKey, date, venue });
    setPaging(null);
  };
  const { matchingRows, dateCounts, venueCounts } = useMemo(() => {
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
    return { matchingRows, dateCounts, venueCounts };
  }, [allRows, chosenDate, chosenVenue]);
  const programmePage: number | null = paging?.key === choiceKey ? paging.page : null;
  const pageCount = Math.max(1, Math.ceil(matchingRows.length / pageSize));
  // The shared screening, looked up in the whole programme so filters cannot change which
  // one it is. It opens on its own page; a reset (no chosen page) returns there too.
  const shared = useMemo(
    () => findSharedScreening(state.screening, data ? Object.values(data.days).flat() : []),
    [data, state.screening],
  );
  const sharedRow = shared?.row;
  const sharedIndex = sharedRow ? matchingRows.findIndex(({ row }) => row === sharedRow) : -1;
  const sharedPage = sharedIndex < 0 ? 0 : Math.floor(sharedIndex / pageSize);
  const currentPage = Math.min(programmePage ?? sharedPage, pageCount - 1);
  const start = currentPage * pageSize;
  const visibleRows = matchingRows.slice(start, start + pageSize);
  const visibleDays = [...new Set(visibleRows.map(({ date }) => date))].map(
    (date) =>
      [date, visibleRows.filter((entry) => entry.date === date).map(({ row }) => row)] as const,
  );
  const count = (value: number) => value.toLocaleString("en-GB");
  const turnPage = (page: number) => {
    setPaging({ key: choiceKey, page });
    // Bring the programme top back only when it is out of view or low on the screen, then
    // move focus to the count so it does not stay on an off-screen or disabled button.
    const node = programme.current;
    if (node) {
      const top = node.getBoundingClientRect().top;
      const margin = parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
      if (top < margin || top > window.innerHeight / 3) node.scrollIntoView({ block: "start" });
    }
    programmeStatus.current?.focus({ preventScroll: true });
  };
  // Listed but outside the matching rows: hidden by the local date/cinema choice, or else by
  // the global filters.
  const sharedHiddenLocally = sharedIndex < 0 && allRows.some(({ row }) => row === sharedRow);
  useEffect(() => {
    // The slug may be corrected after arrival; that is still the same arrival.
    const named = state.filmSlug !== undefined;
    const link = `${film.id}|${state.screening ?? (named ? "named" : "")}`;
    if (!data || (!state.screening && !named) || arrived.current === link) return;
    arrived.current = link;
    const target = programme.current?.querySelector<HTMLElement>(".shared-screening");
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.querySelector<HTMLElement>(".shared-screening-label")?.focus({ preventScroll: true });
    } else if (state.screening) programme.current?.scrollIntoView({ block: "start" });
    else
      programme.current
        ?.closest(".expanded-row")
        ?.previousElementSibling?.scrollIntoView({ block: "start" });
  }, [data, state.screening, state.filmSlug !== undefined]);
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
              <div class="film-actions" role="group" aria-label="Film links">
                {film.tr && (
                  <a
                    class="trailer-link"
                    href={film.tr}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Watch trailer"
                  >
                    Trailer <ExternalLinkIcon />
                  </a>
                )}
                {filmProviderLinks(film).map((provider) => (
                  <a
                    key={provider.name}
                    href={provider.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={provider.label}
                  >
                    {provider.name} <ExternalLinkIcon />
                  </a>
                ))}
                <button
                  class="share-film"
                  onClick={async () => {
                    // A clean named link: the sender's filters, page and sort stay behind.
                    const url = shareUrl(film, location.origin);
                    try {
                      await navigator.clipboard.writeText(url);
                      setShareFallback("");
                      announceShare("Film link copied");
                    } catch {
                      setShareFallback(url);
                      announceShare("Copy the film link from the selected field.");
                    }
                  }}
                >
                  Share film
                </button>
              </div>
              <div class="film-links">
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
              {shareFallback && (
                <CopyFallback
                  label="Film link"
                  value={shareFallback}
                  onDismiss={() => setShareFallback("")}
                />
              )}
            </div>
          </div>
          <div class="showtimes" ref={programme} tabIndex={-1}>
            {data && state.screening && sharedIndex < 0 && (
              <Notice
                kind="status"
                heading
                title={
                  sharedRow ? "Shared screening is hidden" : "Shared screening is no longer listed"
                }
                actions={
                  sharedHiddenLocally ? (
                    <button onClick={() => choose("", "")}>Show all dates and cinemas</button>
                  ) : sharedRow ? (
                    <a href={shareUrl(film, location.origin, sharedRow)}>
                      Show the shared screening
                    </a>
                  ) : undefined
                }
              >
                <p>
                  {sharedHiddenLocally
                    ? "The date or cinema chosen below leaves it out."
                    : sharedRow
                      ? "Your current filters leave it out. The shared link shows it without them."
                      : "It may have ended or changed since the link was shared. The film’s other screenings are below."}
                </p>
              </Notice>
            )}
            {data && findable && (
              <div class="programme-controls" role="group" aria-label="Find a screening">
                <label>
                  Date
                  <select
                    value={chosenDate}
                    onChange={(event) => choose(event.currentTarget.value, chosenVenue)}
                  >
                    <option value="">All dates</option>
                    {days.map(([date]) => (
                      <option key={date} value={date} disabled={!dateCounts.get(date)}>
                        {formatDate(date)} · {count(dateCounts.get(date) ?? 0)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cinema
                  <select
                    value={chosenVenue}
                    onChange={(event) => choose(chosenDate, event.currentTarget.value)}
                  >
                    <option value="">All cinemas</option>
                    {programmeVenues.map((id) => (
                      <option key={id} value={id} disabled={!venueCounts.get(id)}>
                        {venueName(id)} · {count(venueCounts.get(id) ?? 0)}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={!chosenDate && !chosenVenue} onClick={() => choose("", "")}>
                  Reset
                </button>
                <p
                  role="status"
                  class="programme-count prose-small"
                  ref={programmeStatus}
                  tabIndex={-1}
                >
                  {matchingRows.length
                    ? `${count(start + 1)}–${count(start + visibleRows.length)} of ${count(matchingRows.length)} screenings`
                    : "No screenings for this date and cinema."}
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
                          sharedLabel={
                            row === sharedRow
                              ? `Shared screening${shared?.timeChanged ? " (time changed)" : ""} · ${film.ti}`
                              : undefined
                          }
                          after={
                            rowFallback?.row === row && (
                              <CopyFallback
                                label="Screening link"
                                value={rowFallback.url}
                                onDismiss={() => setRowFallback(null)}
                              />
                            )
                          }
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
                          <ShareScreening
                            film={film}
                            row={row}
                            venue={venue?.name ?? row.venue}
                            onFallback={(url) => setRowFallback(url ? { row, url } : null)}
                          />
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
