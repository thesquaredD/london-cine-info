import { useMemo, useRef, useState } from "preact/hooks";
import {
  decadeOf,
  decadeYears,
  hasYears,
  toggleDecade,
  toggleYear,
  yearMatches,
  yearSummary,
  type YearSelection,
} from "../lib/years";

type Props = {
  selection: YearSelection;
  decades: number[];
  counts: Map<number, number>;
  idPrefix: string;
  onChange: (selection: Required<YearSelection>) => void;
};
export function YearPicker({ selection, decades, counts, idPrefix, onChange }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const picker = useRef<HTMLDetailsElement>(null);
  const options = useMemo(
    () =>
      [
        ...new Set([
          ...decades,
          ...(selection.decades ?? []),
          ...(selection.years ?? []).map(decadeOf),
        ]),
      ].sort((a, b) => b - a),
    [decades, selection.decades, selection.years],
  );
  const summary = yearSummary(selection);
  return (
    <details
      ref={picker}
      data-filter="year"
      name={`${idPrefix}-filters`}
      class={`filter-picker year-picker ${hasYears(selection) ? "has-selection" : ""}`}
    >
      <summary>
        <span>Year</span>
        <small title={summary}>{summary}</small>
      </summary>
      <div class="picker-content">
        <p class="filter-hint">
          Film release year. Select several decades or expand one to choose years.
        </p>
        <div class="picker-actions">
          <button
            type="button"
            disabled={!hasYears(selection)}
            onClick={() => onChange({ decades: [], years: [] })}
          >
            Clear year
          </button>
        </div>
        <fieldset class="year-options">
          <legend class="sr-only">Film release year</legend>
          {options.map((decade) => {
            const whole = (selection.decades ?? []).includes(decade);
            const partial =
              !whole && (selection.years ?? []).some((year) => decadeOf(year) === decade);
            const count = decadeYears(decade).reduce(
              (sum, year) => sum + (counts.get(year) ?? 0),
              0,
            );
            const id = `${idPrefix}-years-${decade}`;
            return (
              <div key={decade} class="decade-group">
                <div class="decade-row">
                  <label class={count ? "" : "zero-count"}>
                    <input
                      type="checkbox"
                      checked={whole}
                      aria-checked={partial ? "mixed" : whole}
                      ref={(input) => {
                        if (input) input.indeterminate = partial;
                      }}
                      onChange={() => onChange(toggleDecade(selection, decade))}
                    />
                    <span>{decade}s</span>
                    <small>{count}</small>
                  </label>
                  <button
                    type="button"
                    aria-label={`${expanded === decade ? "Collapse" : "Expand"} ${decade}s years`}
                    aria-expanded={expanded === decade}
                    aria-controls={expanded === decade ? id : undefined}
                    onClick={() => setExpanded(expanded === decade ? null : decade)}
                  >
                    {expanded === decade ? "▴" : "▾"}
                  </button>
                </div>
                {expanded === decade && (
                  <div id={id} class="year-grid" role="group" aria-label={`${decade}s years`}>
                    {decadeYears(decade)
                      .reverse()
                      .map((year) => (
                        <label key={year} class={counts.get(year) ? "" : "zero-count"}>
                          <input
                            type="checkbox"
                            checked={hasYears(selection) && yearMatches(year, selection)}
                            onChange={() => onChange(toggleYear(selection, year))}
                          />
                          <span>{year}</span>
                          <small>{counts.get(year) ?? 0}</small>
                        </label>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
          {!options.length && <p>No dated films in this catalogue.</p>}
        </fieldset>
        <button
          class="year-done"
          type="button"
          onClick={() => {
            if (picker.current) {
              picker.current.open = false;
              picker.current.querySelector<HTMLElement>("summary")?.focus();
            }
          }}
        >
          Done
        </button>
      </div>
    </details>
  );
}
