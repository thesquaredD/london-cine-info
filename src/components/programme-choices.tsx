import { useRef, useState } from "preact/hooks";
import { dayMatches } from "../lib/filters";
import { dayLabel, MonthGrid } from "./date-calendar";

const count = (value: number) => value.toLocaleString("en-GB");
const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export type CinemaChoice = { id: string; name: string; group: string; count: number };

/**
 * The Cinema panel: All cinemas, then the programme's cinemas grouped by borough, each with
 * its screenings under the current date choice. A cinema with none is shown but cannot be
 * chosen. Arrow keys move, Enter or Space chooses; a Find field narrows a long list.
 */
export function CinemaChoices({
  options,
  total,
  chosen,
  onChoose,
}: {
  options: CinemaChoice[];
  total: number;
  chosen: string;
  onChoose: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const searchable = options.length > 8;
  const list = useRef<HTMLDivElement>(null);
  const visible = options.filter((option) => normalize(option.name).includes(normalize(search)));
  const groups = new Map<string, CinemaChoice[]>();
  for (const option of visible)
    groups.set(option.group, [...(groups.get(option.group) ?? []), option]);
  const ordered = [...groups].sort(([a], [b]) => a.localeCompare(b));
  // Keyboard order: All cinemas, then each group in turn.
  const sequence = [{ id: "", count: total }, ...ordered.flatMap(([, items]) => items)].filter(
    (option) => option.count > 0,
  );
  const [focus, setFocus] = useState(chosen);
  const focused = sequence.some((option) => option.id === focus) ? focus : (sequence[0]?.id ?? "");
  const move = (id: string) => {
    setFocus(id);
    requestAnimationFrame(() =>
      list.current?.querySelector<HTMLElement>(`[data-option="${CSS.escape(id)}"]`)?.focus(),
    );
  };
  const option = (id: string, name: string, value: number) => (
    <div
      key={id || "all"}
      role="option"
      data-option={id}
      class={`choice-option ${value ? "" : "zero-count"}`}
      aria-selected={chosen === id}
      aria-disabled={value ? undefined : true}
      tabIndex={value && id === focused ? 0 : -1}
      data-autofocus={!searchable && id === focused ? "" : undefined}
      onFocus={() => setFocus(id)}
      onClick={() => {
        if (value) onChoose(id);
      }}
    >
      <span class="choice-option-name">{name}</span> <small>{count(value)}</small>
    </div>
  );
  return (
    <div class="cinema-choices">
      {searchable && (
        <input
          type="search"
          aria-label="Find a cinema"
          placeholder="Find a cinema…"
          value={search}
          data-autofocus=""
          onInput={(event) => setSearch(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && sequence[0]) {
              event.preventDefault();
              move(sequence[0].id);
            }
          }}
        />
      )}
      <div
        class="choice-list"
        role="listbox"
        aria-label="Cinemas"
        ref={list}
        onKeyDown={(event) => {
          const index = sequence.findIndex((item) => item.id === focused);
          const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
          if (event.key in step) {
            event.preventDefault();
            const next = sequence[index + step[event.key]!];
            if (next) move(next.id);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            const next = event.key === "Home" ? sequence[0] : sequence.at(-1);
            if (next) move(next.id);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (sequence[index]) onChoose(focused);
          }
        }}
      >
        {!search && option("", "All cinemas", total)}
        {ordered.map(([group, items]) => (
          <div role="group" aria-label={group} key={group}>
            <p class="option-group" aria-hidden="true">
              {group}
            </p>
            {items.map((item) => option(item.id, item.name, item.count))}
          </div>
        ))}
        {!visible.length && <p class="choice-empty">No cinemas match “{search}”.</p>}
      </div>
    </div>
  );
}

/** A local date choice: one day, or Today, Tomorrow or This weekend. */
export const DATE_CHOICES = ["today", "tomorrow", "weekend"] as const;
const SHORTCUT_NAMES: Record<string, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "This weekend",
};
const shortDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});
/** The field value for a date choice: "All dates", "This weekend" or "Sat 10 Oct". */
export function dateChoiceName(choice: string) {
  if (!choice) return "All dates";
  return SHORTCUT_NAMES[choice] ?? shortDate.format(new Date(`${choice}T12:00:00Z`));
}

/**
 * The Date panel: All dates and the shortcuts that have screenings, then a month of days, each
 * with its screenings under the current cinema choice. Days without any cannot be chosen.
 */
export function DateChoices({
  counts,
  total,
  today,
  chosen,
  onChoose,
}: {
  counts: Map<string, number>;
  total: number;
  today: string;
  chosen: string;
  onChoose: (choice: string) => void;
}) {
  const dates = [...counts.keys()].sort();
  const shortcuts = DATE_CHOICES.map((id) => ({
    id,
    count: dates
      .filter((date) => dayMatches(date, [id], today))
      .reduce((sum, date) => sum + (counts.get(date) ?? 0), 0),
  })).filter((shortcut) => shortcut.count > 0);
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(chosen);
  const first = dates.find((date) => counts.get(date)) ?? dates[0] ?? today;
  const chip = (id: string, name: string, value: number) => (
    <button
      type="button"
      key={id || "all"}
      aria-pressed={chosen === id}
      onClick={() => onChoose(id)}
    >
      {name} <small>{count(value)}</small>
    </button>
  );
  return (
    <div class="date-calendar date-choices">
      <div class="date-shortcuts">
        {chip("", "All dates", total)}
        {shortcuts.map((shortcut) =>
          chip(shortcut.id, SHORTCUT_NAMES[shortcut.id]!, shortcut.count),
        )}
      </div>
      <MonthGrid
        initial={isDay ? chosen : first}
        label="Choose a date"
        pressed={(date) => chosen === date}
        disabled={(date) => !counts.get(date)}
        dayClass={(date) => (counts.get(date) ? "" : "zero-count")}
        dayName={(date) => {
          const value = counts.get(date) ?? 0;
          return `${dayLabel(date)} · ${value ? count(value) : "no"} screening${value === 1 ? "" : "s"}`;
        }}
        dayContent={(date) => (
          <>
            <span>{Number(date.slice(8))}</span>
            <small>{counts.get(date) ? count(counts.get(date)!) : ""}</small>
          </>
        )}
        onPick={onChoose}
      />
    </div>
  );
}

/** Whether a programme day falls within a local date choice. */
export function inDateChoice(date: string, choice: string, today: string) {
  return !choice || dayMatches(date, [choice], today);
}
