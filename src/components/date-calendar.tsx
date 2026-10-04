import { useRef, useState } from "preact/hooks";
import type { DataMeta } from "../shared/data";
import { addDays, DATE_SHORTCUTS, filterLabel, londonDate } from "../lib/filters";

export function DateCalendar({
  selected,
  excluded,
  meta,
  counts,
  excludeMode,
  onChange,
}: {
  selected: string[];
  excluded: string[];
  meta: DataMeta;
  counts: Map<string, number>;
  excludeMode: boolean;
  onChange: (included: string[], excluded: string[]) => void;
}) {
  const today = londonDate();
  const [month, setMonth] = useState(
    (selected.find((id) => /^\d{4}-\d{2}-\d{2}$/.test(id)) ?? today).slice(0, 7),
  );
  const [focus, setFocus] = useState(today);
  const grid = useRef<HTMLDivElement>(null);
  const start = `${month}-01`;
  const next = addDays(start, 32).slice(0, 7) + "-01";
  const last = addDays(next, -1);
  const offset = (new Date(`${start}T12:00:00Z`).getUTCDay() + 6) % 7;
  const days = Array.from({ length: Number(last.slice(8)) }, (_, i) => addDays(start, i));
  const focused = days.includes(focus) ? focus : start;
  const label = (date: string) =>
    new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" }).format(
      new Date(`${date}T12:00:00Z`),
    );
  function move(date: string) {
    setFocus(date);
    setMonth(date.slice(0, 7));
    requestAnimationFrame(() =>
      grid.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus(),
    );
  }
  function toggle(date: string) {
    const included = selected.filter(
      (id) => id !== date && (excludeMode || !DATE_SHORTCUTS.includes(id)),
    );
    const rejected = excluded.filter((id) => id !== date);
    if (selected.includes(date) || excluded.includes(date)) onChange(included, rejected);
    else if (excludeMode) onChange(included, [...rejected, date]);
    else onChange([...included, date], rejected);
  }
  return (
    <div class="date-calendar">
      <div class="date-shortcuts">
        {DATE_SHORTCUTS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={selected.includes(id) || excluded.includes(id)}
            class={excluded.includes(id) ? "excluded-option" : ""}
            onClick={() => {
              if (excludeMode)
                onChange(
                  selected.filter((value) => value !== id),
                  excluded.includes(id)
                    ? excluded.filter((value) => value !== id)
                    : [...excluded, id],
                );
              else onChange(selected.length === 1 && selected[0] === id ? [] : [id], []);
            }}
          >
            {excluded.includes(id) ? "NOT " : ""}
            {filterLabel("day", id, meta)} <small>{counts.get(id) ?? 0}</small>
          </button>
        ))}
      </div>
      <div class="calendar-heading">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth(addDays(start, -1).slice(0, 7))}
        >
          ‹
        </button>
        <span aria-live="polite">
          {new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "Europe/London",
          }).format(new Date(`${start}T12:00:00Z`))}
        </span>
        <button type="button" aria-label="Next month" onClick={() => setMonth(next.slice(0, 7))}>
          ›
        </button>
      </div>
      <div class="calendar-grid" ref={grid} role="group" aria-label="Choose screening dates">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day} class="calendar-weekday" aria-hidden="true">
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((date) => (
          <button
            type="button"
            key={date}
            data-date={date}
            tabIndex={date === focused ? 0 : -1}
            class={`${!counts.get(date) ? "zero-count" : ""} ${excluded.includes(date) ? "excluded-option" : ""}`}
            aria-pressed={selected.includes(date) || excluded.includes(date)}
            aria-current={date === today ? "date" : undefined}
            aria-label={`${label(date)} · ${counts.get(date) ?? 0} matching films${excluded.includes(date) ? " · excluded" : ""}`}
            onFocus={() => setFocus(date)}
            onClick={() => toggle(date)}
            onKeyDown={(event) => {
              const deltas: Record<string, number> = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -7,
                ArrowDown: 7,
              };
              if (event.key in deltas) {
                event.preventDefault();
                move(addDays(date, deltas[event.key]!));
              } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
                move(addDays(date, event.key === "Home" ? -weekday : 6 - weekday));
              } else if (event.key === "PageUp" || event.key === "PageDown") {
                event.preventDefault();
                const value = new Date(`${date}T12:00:00Z`);
                const day = value.getUTCDate();
                value.setUTCDate(1);
                value.setUTCMonth(value.getUTCMonth() + (event.key === "PageUp" ? -1 : 1));
                const targetMonth = value.toISOString().slice(0, 7);
                const end = Number(
                  addDays(addDays(`${targetMonth}-01`, 32).slice(0, 7) + "-01", -1).slice(8),
                );
                move(`${targetMonth}-${String(Math.min(day, end)).padStart(2, "0")}`);
              }
            }}
          >
            {excluded.includes(date) ? "−" : ""}
            {Number(date.slice(8))}
          </button>
        ))}
      </div>
      <p class="filter-hint">
        Listed dates: {meta.facets.day[0]?.id ?? "unknown"}–
        {meta.facets.day.at(-1)?.id ?? "unknown"}. Faded dates have no matching listed screenings;
        cinema programmes may be incomplete. Use Exclude options to omit dates.
      </p>
    </div>
  );
}
