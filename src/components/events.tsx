import { Fragment } from "preact";
import { useState } from "preact/hooks";
import { EVENT_TYPES } from "../data/event-rules";
import { groupEvents } from "../lib/events";
import { clearFilters } from "../lib/filters";
import { formatDate, type ViewState } from "../lib/catalogue";
import { displayTitle, type DisplayState } from "../lib/display";
import { letterboxdSlug } from "../shared/account";
import type { DataMeta, EventOccurrence, Film } from "../shared/data";
import type { CalendarInput } from "../shared/calendar";
import type { CalendarState } from "../lib/calendar";
import { ExpandedRow } from "./expanded-row";
export function EventTypeFilter({
  state,
  onChange,
}: {
  state: ViewState;
  onChange: (changes: Partial<ViewState>) => void;
}) {
  return (
    <div class="event-type-filter">
      <label for="event-type">Event type</label>
      <select
        id="event-type"
        value={state.eventType ?? ""}
        onChange={(event) => onChange({ eventType: event.currentTarget.value, page: 1 })}
      >
        <option value="">All cinema experiences</option>
        {EVENT_TYPES.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>
    </div>
  );
}
export function Events({
  events,
  films,
  meta,
  state,
  display,
  watched,
  calendar,
  onCalendar,
  onChange,
}: {
  events: EventOccurrence[];
  films: Film[];
  meta: DataMeta;
  state: ViewState;
  display: DisplayState;
  watched?: Set<string>;
  calendar?: CalendarState;
  onCalendar?: (event: CalendarInput) => void;
  onChange: (changes: Partial<ViewState>) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const byId = new Map(films.map((film) => [film.id, film]));
  const venues = new Map(meta.venues.map((venue) => [venue.id, venue]));
  return (
    <div class="events-agenda">
      <p class="view-note">
        Special cinema experiences, in London date order. Formats alone are listed in Radar.
      </p>
      {!events.length && (
        <div class="empty-state">
          <h2>No events match these filters</h2>
          <p>Try another date, cinema or event type.</p>
          <button onClick={() => onChange(clearFilters(state.path))}>Clear filters</button>
        </div>
      )}
      {groupEvents(events).map(([date, rows]) => (
        <section key={date} aria-label={formatDate(date)}>
          <h2>
            {formatDate(date)}{" "}
            <small>
              · {rows.length} {rows.length === 1 ? "event" : "events"}
            </small>
          </h2>
          <table class="event-table" aria-label={`Events on ${formatDate(date)}`}>
            <tbody>
              {rows.map((row) => {
                const film = byId.get(row.filmId),
                  venue = venues.get(row.venue);
                const title = film ? displayTitle(film, display.titleMode) : row.title;
                const occasions = row.labels.filter(
                  (label) => !title.toLowerCase().includes(label.toLowerCase()),
                );
                const event: CalendarInput = {
                  filmId: row.filmId,
                  title: row.title,
                  venueId: row.venue,
                  venueName: venue?.name ?? row.venue,
                  address: venue?.address ?? "",
                  start: row.time,
                  end: film?.ru ? row.time + film.ru * 60000 : null,
                  bookingUrl: row.bookingUrl,
                  screen: row.screen,
                  notes: row.notes,
                  formats: row.formats,
                };
                const saved = calendar?.find(event);
                const id = `event-details-${encodeURIComponent(row.id)}`;
                return (
                  <Fragment key={row.id}>
                    <tr class="event-row">
                      <td>
                        <time dateTime={new Date(row.time).toISOString()}>{row.localTime}</time>
                      </td>
                      <td class="event-information">
                        <h3>
                          {title}
                          {occasions.length > 0 && ` — ${occasions.join(" · ")}`}
                        </h3>
                        <p>
                          {venue?.name ?? row.venue}
                          {row.screen && ` · Screen ${row.screen}`}
                        </p>
                        {row.notes && <p class="event-notes">{row.notes}</p>}
                        {watched?.has(letterboxdSlug(film?.ra.lb?.url) ?? "") && (
                          <a
                            class="badge"
                            href={film?.ra.lb?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${row.title} is on your Letterboxd watchlist`}
                          >
                            On your watchlist
                          </a>
                        )}
                        {row.soldOut && <span class="badge sold-out-badge">Sold out</span>}
                        <div class="event-actions">
                          <a
                            href={row.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${row.bookingFallback ? "Screening details for" : "Book"} ${row.title} at ${venue?.name ?? row.venue} ${row.localTime}`}
                          >
                            {row.bookingFallback ? "Screening details ↗" : "Book ↗"}
                          </a>
                          {onCalendar && (
                            <button
                              class="add-calendar"
                              aria-haspopup="dialog"
                              onClick={() => onCalendar(event)}
                            >
                              {saved ? "In my calendar" : "Add to calendar"}
                            </button>
                          )}
                          {film && (
                            <button
                              aria-expanded={expanded === row.id}
                              aria-controls={id}
                              onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                            >
                              Film details
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {film && expanded === row.id && (
                      <ExpandedRow
                        film={film}
                        meta={meta}
                        detailId={id}
                        columns={2}
                        state={state}
                        ratingOrder={display.ratingOrder}
                      />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
