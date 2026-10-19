import type { ComponentChildren } from "preact";

export type ScreeningTag = { key: string; label: string; kind?: "accessibility" | "sold-out" };

/**
 * One screening line: time, venue details (name, tags, notes) and an actions column. Shared by
 * the film sheet and the How to use example so the guide always matches the real layout. Must
 * sit inside `.showtimes` (the `screenings` container) for its responsive rules to apply.
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
  /** The actions column: Book and, where offered, the calendar action. */
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
          {sharedLabel && (
            <span class="shared-screening-label" tabIndex={-1}>
              {sharedLabel}
              {/* Focus lands here, after the time, so say the time too. */}
              <span class="sr-only">, {localTime}</span>
            </span>
          )}
          <span class="screening-venue">{venue}</span>
          <div class="screening-tags">
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
          </div>
          {note && <small>{note}</small>}
        </div>
        <div class="screening-actions">{children}</div>
      </div>
      {after && <div class="screening-after">{after}</div>}
    </li>
  );
}
