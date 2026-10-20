import type { ComponentChildren } from "preact";
import { CalendarIcon, CheckIcon } from "./platform-marks";

export type ScreeningTag = { key: string; label: string; kind?: "accessibility" | "sold-out" };

/**
 * One screening line: time, venue details (the name, then one meta line of tags and notes) and
 * the actions. Shared by the film sheet (list view and poster dialog) and the How to use
 * example so the guide always matches the real layout. Must sit inside `.showtimes` (the
 * `screenings` container) for its responsive rules to apply.
 */
export function ScreeningRow({
  sharedLabel,
  dateTime,
  localTime,
  venue,
  soldOut,
  tags,
  note,
  children,
  after,
}: {
  /**
   * Marks the screening a shared link points at: the row is tinted and this visible label,
   * which takes focus on arrival, is read before the row's own content.
   */
  sharedLabel?: string;
  dateTime?: string;
  localTime: string;
  venue: string;
  soldOut?: boolean;
  tags: ScreeningTag[];
  note?: string;
  /** The actions: Book, the calendar action where offered, and Share. */
  children: ComponentChildren;
  /** A line across the whole row below it, such as a link to copy by hand. */
  after?: ComponentChildren;
}) {
  return (
    <li
      class={[soldOut && "sold-out", sharedLabel && "shared-screening"].filter(Boolean).join(" ")}
    >
      <time dateTime={dateTime}>{localTime}</time>
      <span class="time-dot" aria-hidden="true" />
      <div class="screening-info">
        <div class="screening-details">
          <span class="screening-venue">{venue}</span>
          {/* Always present, empty or not, so every row has the same height. */}
          <div class="screening-meta">
            {sharedLabel && (
              <span class="shared-screening-label" tabIndex={-1}>
                {sharedLabel}
                {/* Focus lands here, after the time and venue, so say them too. */}
                <span class="sr-only">
                  , {localTime} at {venue}
                </span>
              </span>
            )}
            {tags.map((tag) => (
              <span
                class={
                  tag.kind === "sold-out"
                    ? "badge sold-out-badge"
                    : tag.kind === "accessibility"
                      ? "badge accessibility"
                      : "badge"
                }
                key={tag.key}
              >
                {tag.label}
              </span>
            ))}
            {note && <small>{note}</small>}
          </div>
        </div>
        <div class="screening-actions">{children}</div>
      </div>
      {after && <div class="screening-after">{after}</div>}
    </li>
  );
}

/**
 * The calendar action's face: a glyph and a short label, which hides on narrow lists. The
 * button's accessible name says the full action ("Add to calendar: …").
 */
export function CalendarActionLabel({ saved = false }: { saved?: boolean }) {
  return (
    <>
      {saved ? <CheckIcon /> : <CalendarIcon />}
      <span class="action-label">{saved ? "In calendar" : "Calendar"}</span>
    </>
  );
}
