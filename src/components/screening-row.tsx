import type { ComponentChildren } from "preact";

export type ScreeningTag = { key: string; label: string; kind?: "accessibility" | "sold-out" };

/**
 * One screening line: time, venue details (name, tags, notes) and an actions column. Shared by
 * the film sheet and the How to use example so the guide always matches the real layout. Must
 * sit inside `.showtimes` (the `screenings` container) for its responsive rules to apply.
 */
export function ScreeningRow({
  highlighted,
  sharedTitle,
  dateTime,
  localTime,
  venue,
  soldOut,
  tags,
  note,
  children,
}: {
  /** The screening a shared link points at: labelled, tinted and focusable for the link. */
  highlighted?: boolean;
  sharedTitle?: string;
  dateTime?: string;
  localTime: string;
  venue: string;
  soldOut?: boolean;
  tags: ScreeningTag[];
  note?: string;
  /** The actions column: Book and, where offered, the calendar action. */
  children: ComponentChildren;
}) {
  return (
    <li
      class={[soldOut && "sold-out", highlighted && "shared-screening"].filter(Boolean).join(" ")}
      tabIndex={highlighted ? -1 : undefined}
      aria-label={
        highlighted
          ? `Shared screening${sharedTitle ? `: ${sharedTitle}` : ""}, ${localTime} at ${venue}`
          : undefined
      }
    >
      <time dateTime={dateTime}>{localTime}</time>
      <span class="time-dot" aria-hidden="true" />
      <div class="screening-info">
        <div class="screening-details">
          {highlighted && (
            <span class="shared-screening-label">
              Shared screening{sharedTitle ? ` · ${sharedTitle}` : ""}
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
    </li>
  );
}
