import { FilterPicker } from "./filter-picker";
import { CLEAR_FILTERS, FILTERS } from "../lib/filters";
import type { FacetKey } from "../shared/data";
import type { DataMeta } from "../shared/data";
import { PAGES, type ViewState } from "../lib/catalogue";

type Props = {
  state: ViewState;
  meta: DataMeta | null;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
  dark: boolean;
  onTheme: () => void;
  idPrefix?: string;
  counts: Record<FacetKey, Map<string, number>> | null;
  resultCount: number;
  onDone: () => void;
};
export function Sidebar({
  state,
  meta,
  onChange,
  dark,
  onTheme,
  idPrefix = "desktop",
  counts,
  resultCount,
  onDone,
}: Props) {
  return (
    <div class="sidebar-content">
      <h2 class="section-label">Pages</h2>
      <nav aria-label="Film pages">
        {PAGES.map((page) => (
          <a
            key={page.path}
            href={page.path}
            aria-current={state.path === page.path ? "page" : undefined}
            onClick={(event) => {
              if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                return;
              event.preventDefault();
              onChange({ path: page.path, page: 1, director: "" }, true);
            }}
          >
            {page.name}
          </a>
        ))}
      </nav>
      <h2 class="section-label">Filters</h2>
      <div class="sidebar-fields">
        <label for={`${idPrefix}-search`}>Search</label>
        <input
          id={`${idPrefix}-search`}
          type="search"
          placeholder="Film or director…"
          value={state.search}
          onInput={(event) => onChange({ search: event.currentTarget.value, page: 1 })}
        />
        <p class="filter-hint">Choose any values within a filter. Counts show matching films.</p>
        {meta &&
          FILTERS.map(({ key, label }) => (
            <FilterPicker
              key={key}
              filterKey={key}
              label={label}
              selected={state.filters[key] ?? []}
              meta={meta}
              counts={counts?.[key] ?? new Map()}
              idPrefix={idPrefix}
              summaryValue={
                key === "time" && (state.from || state.to)
                  ? `Starts ${state.from || "00:00"}–${state.to || "23:59"}`
                  : undefined
              }
              onChange={(values) =>
                onChange({ filters: { ...state.filters, [key]: values }, page: 1 })
              }
            >
              {key === "time" && (
                <>
                  <p class="filter-hint">
                    Morning: before 12:00. Afternoon: 12:00–16:59. Evening: from 17:00.
                  </p>
                  <fieldset class="time-range">
                    <legend>Screening starts between</legend>
                    <label for={`${idPrefix}-from`}>From</label>
                    <input
                      id={`${idPrefix}-from`}
                      type="time"
                      value={state.from}
                      onInput={(event) => onChange({ from: event.currentTarget.value, page: 1 })}
                    />
                    <label for={`${idPrefix}-to`}>Until</label>
                    <input
                      id={`${idPrefix}-to`}
                      type="time"
                      value={state.to}
                      onInput={(event) => onChange({ to: event.currentTarget.value, page: 1 })}
                    />
                  </fieldset>
                  {state.from && state.to && state.from > state.to && (
                    <p class="filter-hint">Includes screenings after midnight.</p>
                  )}
                </>
              )}
            </FilterPicker>
          ))}
        <label class="availability-filter">
          <input
            type="checkbox"
            checked={state.available}
            onChange={(event) => onChange({ available: event.currentTarget.checked, page: 1 })}
          />{" "}
          Hide sold-out screenings
        </label>
        {Boolean(state.filters.membership?.length) && (
          <p class="filter-hint">
            Memberships show eligible venues. Check exclusions with the cinema.
          </p>
        )}
        <button class="reset-button" onClick={() => onChange(CLEAR_FILTERS)}>
          Reset all filters
        </button>
        <button class="view-results" onClick={onDone}>
          Show {resultCount.toLocaleString("en-GB")} {resultCount === 1 ? "film" : "films"}
        </button>
      </div>
      <div class="sidebar-bottom">
        <button class="theme-button" onClick={onTheme}>
          {dark ? "☀" : "☾"} <span>{dark ? "Light mode" : "Dark mode"}</span>
        </button>
        <a
          class="about-link"
          href="/about"
          aria-current={state.path === "/about" ? "page" : undefined}
          onClick={(event) => {
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
              return;
            event.preventDefault();
            onChange({ path: "/about", page: 1 }, true);
          }}
        >
          About & sources
        </a>
        {meta && (
          <p class="update-note">
            Updated{" "}
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/London",
            }).format(new Date(meta.generatedAt))}
            <br />
            London time
          </p>
        )}
      </div>
    </div>
  );
}
