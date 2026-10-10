import { DateCalendar } from "./date-calendar";
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { DataMeta, FacetKey } from "../shared/data";
import { filterLabel } from "../lib/filters";
type Props = {
  filterKey: FacetKey;
  label: string;
  selected: string[];
  excluded: string[];
  meta: DataMeta;
  counts: Map<string, number>;
  onChange: (values: string[], excluded: string[]) => void;
  idPrefix: string;
  children?: ComponentChildren;
  summaryValue?: string;
};
export function FilterPicker({
  filterKey,
  label,
  selected,
  excluded,
  meta,
  counts,
  onChange,
  idPrefix,
  children,
  summaryValue,
}: Props) {
  const [open, setOpen] = useState(false);
  const [excludeMode, setExcludeMode] = useState(false);
  const [search, setSearch] = useState("");
  const options =
    filterKey === "day"
      ? [
          ...["today", "tomorrow", "weekend", "week", "beyond"].map((id) => ({
            id,
            label: filterLabel(filterKey, id, meta),
            count: 0,
          })),
          ...meta.facets.day.map((option) => ({
            ...option,
            label: filterLabel(filterKey, option.id, meta),
          })),
        ]
      : meta.facets[filterKey];
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const visible = open
    ? options.filter((option) =>
        normalize(`${option.label} ${option.id}`).includes(normalize(search)),
      )
    : [];
  const grouped = new Map<string, typeof options>();
  for (const option of visible) {
    const venue =
      filterKey === "venue" ? meta.venues.find((venue) => venue.id === option.id) : null;
    const borough = meta.boroughs.find((borough) => borough.id === (venue?.borough ?? option.id));
    const group =
      filterKey === "venue"
        ? (borough?.name ?? "Other cinemas")
        : filterKey === "borough"
          ? borough?.region === "inner"
            ? "Inner London"
            : borough?.region === "outer"
              ? "Outer London"
              : "Other places"
          : "";
    grouped.set(group, [...(grouped.get(group) ?? []), option]);
  }
  const id = `${idPrefix}-${filterKey}`;
  const summary =
    excluded.length > 0
      ? `${selected.length} included · ${excluded.length} excluded`
      : (summaryValue ??
        (selected.length
          ? selected.length === 1
            ? filterLabel(filterKey, selected[0]!, meta)
            : `${selected.length} selected`
          : `Any ${filterKey === "venue" ? "cinema" : filterKey === "language" ? "language" : label.toLowerCase()}`));
  return (
    <details
      onToggle={(event) => setOpen(event.currentTarget.open)}
      data-filter={filterKey}
      name={`${idPrefix}-filters`}
      class={`filter-picker ${selected.length || excluded.length || summaryValue ? "has-selection" : ""}`}
    >
      <summary>
        <span>{label}</span>
        <small title={summary}>{summary} </small>
      </summary>
      {open && (
        <div class="picker-content">
          {filterKey !== "day" && options.length > 8 && (
            <>
              <label class="sr-only" for={`${id}-search`}>
                Find {label.toLowerCase()}
              </label>
              <input
                id={`${id}-search`}
                type="search"
                value={search}
                placeholder={`Find ${label.toLowerCase()}…`}
                onInput={(event) => setSearch(event.currentTarget.value)}
              />
            </>
          )}
          <div class="picker-actions">
            <button
              type="button"
              aria-pressed={excludeMode}
              onClick={() => setExcludeMode(!excludeMode)}
            >
              Exclude options
            </button>
            <button
              type="button"
              disabled={!selected.length && !excluded.length}
              onClick={() => onChange([], [])}
            >
              Clear {label.toLowerCase()}
            </button>
          </div>
          {filterKey === "day" ? (
            <DateCalendar
              selected={selected}
              excluded={excluded}
              meta={meta}
              counts={counts}
              excludeMode={excludeMode}
              onChange={onChange}
            />
          ) : (
            <fieldset class={`filter-options ${options.length > 8 ? "searchable" : ""}`}>
              <legend class="sr-only">{label}</legend>
              {[...grouped]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([group, items]) => (
                  <div key={group}>
                    {group && <p class="option-group">{group}</p>}
                    {items.map((option) => (
                      <label
                        key={option.id}
                        class={
                          excluded.includes(option.id)
                            ? "excluded-option"
                            : (counts.get(option.id) ?? 0) === 0
                              ? "zero-count"
                              : ""
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(option.id)}
                          aria-checked={
                            excluded.includes(option.id) ? "mixed" : selected.includes(option.id)
                          }
                          ref={(input) => {
                            if (input) input.indeterminate = excluded.includes(option.id);
                          }}
                          onChange={() => {
                            const included = selected.filter((id) => id !== option.id);
                            const rejected = excluded.filter((id) => id !== option.id);
                            if (selected.includes(option.id) || excluded.includes(option.id))
                              onChange(included, rejected);
                            else if (excludeMode) onChange(included, [...rejected, option.id]);
                            else onChange([...included, option.id], rejected);
                          }}
                        />
                        <span class="option-label">
                          <b class={`not-label ${excluded.includes(option.id) ? "" : "inactive"}`}>
                            NOT{" "}
                          </b>
                          <span>{option.label}</span>
                        </span>
                        <small>{counts.get(option.id) ?? 0}</small>
                      </label>
                    ))}
                  </div>
                ))}
              {!visible.length && <p>No options match “{search}”.</p>}
            </fieldset>
          )}
          {children}
        </div>
      )}
    </details>
  );
}
