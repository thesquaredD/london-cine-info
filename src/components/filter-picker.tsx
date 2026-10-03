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
  const visible = options.filter((option) =>
    normalize(`${option.label} ${option.id}`).includes(normalize(search)),
  );
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
  return (
    <details
      name={`${idPrefix}-filters`}
      class={`filter-picker ${selected.length || excluded.length || summaryValue ? "has-selection" : ""}`}
    >
      <summary>
        <span>{label}</span>
        <small>
          {excluded.length > 0
            ? `${selected.length} included · ${excluded.length} excluded`
            : (summaryValue ??
              (selected.length
                ? selected.length === 1
                  ? filterLabel(filterKey, selected[0]!, meta)
                  : `${selected.length} selected`
                : `Any ${filterKey === "venue" ? "cinema" : filterKey === "language" ? "language" : label.toLowerCase()}`))}
        </small>
      </summary>
      <div class="picker-content">
        {options.length > 8 && (
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
          <span>Click: include → exclude → clear</span>
          {(selected.length > 0 || excluded.length > 0) && (
            <button type="button" onClick={() => onChange([], [])}>
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
        <fieldset class="filter-options">
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
                        if (selected.includes(option.id))
                          onChange(
                            selected.filter((id) => id !== option.id),
                            [...excluded, option.id],
                          );
                        else if (excluded.includes(option.id))
                          onChange(
                            selected,
                            excluded.filter((id) => id !== option.id),
                          );
                        else onChange([...selected, option.id], excluded);
                      }}
                    />
                    <span>
                      {excluded.includes(option.id) && <b class="not-label">NOT </b>}
                      {option.label}
                    </span>
                    <small>{counts.get(option.id) ?? 0}</small>
                  </label>
                ))}
              </div>
            ))}
          {!visible.length && <p>No options match “{search}”.</p>}
        </fieldset>
        {children}
      </div>
    </details>
  );
}
