import type { AccountState } from "../lib/account";
import { downloadScreening, downloadEvents, type CalendarState } from "../lib/calendar";
import type { CalendarInput } from "../shared/calendar";
import { Dialog } from "./dialog";
export const calendarDate = (time: number) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(time));
export function ScreeningCalendarDialog({
  event,
  calendar,
  account,
  onClose,
  onAccount,
  onNavigate,
}: {
  event: CalendarInput | null;
  calendar: CalendarState;
  account: AccountState;
  onClose: () => void;
  onAccount: () => void;
  onNavigate: () => void;
}) {
  const saved = event ? calendar.find(event) : undefined;
  return (
    <Dialog
      open={!!event}
      title="Add to calendar"
      className="screening-calendar-dialog"
      onClose={onClose}
    >
      {event && (
        <>
          <h3 data-initial-focus tabIndex={-1}>
            {event.title}
          </h3>
          <p>
            {calendarDate(event.start)} · London time
            <br />
            {event.venueName}
            {event.screen ? ` · Screen ${event.screen}` : ""}
          </p>
          {calendar.error && (
            <div role="alert">
              <p>{calendar.error}</p>
              <button
                disabled={calendar.busy}
                onClick={() => {
                  void calendar.reload();
                }}
              >
                Reload my calendar
              </button>
            </div>
          )}
          {calendar.notice && <p role="status">{calendar.notice}</p>}
          {calendar.loading && account.user && <p role="status">Loading your calendar…</p>}
          <div class="calendar-actions">
            {account.loading ? (
              <p role="status">Checking sign-in…</p>
            ) : account.user ? (
              saved ? (
                <>
                  <p>Saved in My calendar.</p>
                  <button
                    disabled={calendar.busy}
                    onClick={() => {
                      void calendar.remove(saved);
                    }}
                  >
                    Remove from my calendar
                  </button>
                  <button onClick={onNavigate}>View my calendar</button>
                </>
              ) : (
                <button
                  disabled={calendar.busy || calendar.loading || !calendar.ready}
                  onClick={() => {
                    void calendar.save(event);
                  }}
                >
                  {calendar.busy ? "Saving…" : "Save to my calendar"}
                </button>
              )
            ) : (
              <>
                <p>Sign in to keep your screenings across devices.</p>
                <button onClick={onAccount}>Sign in to save</button>
              </>
            )}
            <button
              onClick={() => {
                void downloadScreening(saved ?? event);
              }}
            >
              Download calendar file (.ics)
            </button>
          </div>
          <p class="filter-hint">
            Download for Apple Calendar, Google Calendar or another calendar app. Saving a screening
            does not book a ticket.
            {event.end
              ? " The end time is estimated from the film runtime."
              : " Runtime unknown; the export has no end time."}
          </p>
        </>
      )}
    </Dialog>
  );
}
export function MyCalendar({
  calendar,
  account,
  onAccount,
  now,
}: {
  calendar: CalendarState;
  account: AccountState;
  onAccount: () => void;
  now: Date;
}) {
  const upcoming = calendar.screenings.filter((event) => event.start > now.getTime());
  const past = calendar.screenings.filter((event) => event.start <= now.getTime()).reverse();
  return (
    <article class="my-calendar-page">
      <h2>My calendar</h2>
      {!account.user ? (
        <>
          {account.loading ? (
            <p role="status">Checking sign-in…</p>
          ) : (
            <>
              <p>Save screenings as you browse, then find your plans here.</p>
              <button onClick={onAccount}>Sign in to use my calendar</button>
            </>
          )}
        </>
      ) : (
        <>
          <p>Your saved screenings, synced to your account. Download them to your calendar app.</p>
          {calendar.loading && <p role="status">Loading your calendar…</p>}
          {calendar.error && (
            <div role="alert">
              <p>{calendar.error}</p>
              <button
                disabled={calendar.busy}
                onClick={() => {
                  void calendar.reload();
                }}
              >
                Reload my calendar
              </button>
            </div>
          )}
          {calendar.notice && <p role="status">{calendar.notice}</p>}
          {calendar.screenings.length > 0 && (
            <button class="calendar-export" onClick={() => downloadEvents(calendar.screenings)}>
              Download my calendar (.ics)
            </button>
          )}
          {!calendar.loading && !calendar.error && !calendar.screenings.length && (
            <p>
              No screenings saved yet. Open a film and choose Add to calendar next to a screening.
            </p>
          )}
          {(
            [
              ["Upcoming", upcoming],
              ["Past screenings", past],
            ] as const
          ).map(([label, events]) =>
            events.length ? (
              <section key={label} aria-label={label}>
                <h3>{label}</h3>
                <ul class="saved-screenings">
                  {events.map((event) => (
                    <li key={event.id}>
                      <h4>{event.title}</h4>
                      <p>
                        <time dateTime={new Date(event.start).toISOString()}>
                          {calendarDate(event.start)}
                        </time>{" "}
                        · London time
                        <br />
                        {event.venueName}
                        {event.screen ? ` · Screen ${event.screen}` : ""}
                        {event.formats.some((format) => format !== "standard")
                          ? ` · ${event.formats.filter((format) => format !== "standard").join(" · ")}`
                          : ""}
                      </p>
                      <div class="calendar-actions">
                        <a href={event.bookingUrl} target="_blank" rel="noopener noreferrer">
                          Cinema booking page ↗
                        </a>
                        <button onClick={() => downloadEvents([event])}>Download .ics</button>
                        <button
                          disabled={calendar.busy}
                          onClick={() => {
                            void calendar.remove(event);
                          }}
                        >
                          Remove
                          <span class="sr-only">
                            {" "}
                            {event.title} at {event.venueName} {calendarDate(event.start)}
                          </span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
          {calendar.screenings.length > 0 && (
            <p class="filter-hint">
              Saved details reflect the screening when you added it. Confirm programme changes with
              the cinema.
            </p>
          )}
        </>
      )}
    </article>
  );
}
