import type { AccountState } from "../lib/account";
import { FilterPicker } from "./filter-picker";
import { clearFilters, FILTERS } from "../lib/filters";
import type { FacetKey } from "../shared/data";
import type { DataMeta } from "../shared/data";
import type { ViewState } from "../lib/catalogue";

export type FilterControlsProps = {
  account: AccountState;
  filterKeys?: FacetKey[];
  showSearch?: boolean;
  state: ViewState;
  meta: DataMeta | null;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
  idPrefix?: string;
  counts: Record<FacetKey, Map<string, number>> | null;
  resultCount: number;
  onDone?: () => void;
};
export function FilterControls({
  filterKeys,
  account,
  showSearch = true,
  state,
  meta,
  onChange,
  idPrefix = "desktop",
  counts,
  resultCount,
  onDone,
}: FilterControlsProps) {
  return (
    <div class="filter-controls">
      {showSearch && <h2 class="section-label">Filters</h2>}
      <div class="filter-fields">
        {showSearch && (
          <>
            <label for={`${idPrefix}-search`}>Search</label>
            <input
              id={`${idPrefix}-search`}
              type="search"
              placeholder="Film or director…"
              value={state.search}
              onInput={(event) => onChange({ search: event.currentTarget.value, page: 1 })}
            />
          </>
        )}
        {meta &&
          FILTERS.filter(({ key }) => !filterKeys || filterKeys.includes(key)).map(
            ({ key, label }) => (
              <FilterPicker
                key={key}
                filterKey={key}
                label={label}
                selected={state.filters[key] ?? []}
                excluded={state.excluded[key] ?? []}
                meta={meta}
                counts={counts?.[key] ?? new Map()}
                idPrefix={idPrefix}
                summaryValue={
                  key === "time" && (state.from || state.to)
                    ? `Starts ${state.from || "00:00"}–${state.to || "23:59"}`
                    : undefined
                }
                onChange={(values, excluded) =>
                  onChange({
                    filters: { ...state.filters, [key]: values },
                    excluded: { ...state.excluded, [key]: excluded },
                    page: 1,
                  })
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
                    <p class="filter-hint">
                      Times use London time. An end earlier than the start includes screenings after
                      midnight.
                    </p>
                  </>
                )}
                {key === "membership" && (
                  <p class="filter-hint">
                    Memberships show eligible venues. Check exclusions with the cinema.
                  </p>
                )}
              </FilterPicker>
            ),
          )}
        {!filterKeys && (
          <>
            {account.user && account.watchlist?.fetchedAt && (
              <label class="availability-filter">
                <input
                  type="checkbox"
                  checked={!!state.watchlist}
                  onChange={(event) =>
                    onChange({ watchlist: event.currentTarget.checked, page: 1 })
                  }
                />{" "}
                Only my watchlist
              </label>
            )}
            <label class="availability-filter">
              <input
                type="checkbox"
                checked={state.available}
                onChange={(event) => onChange({ available: event.currentTarget.checked, page: 1 })}
              />{" "}
              Hide sold-out screenings
            </label>
            <button class="reset-button" onClick={() => onChange(clearFilters(state.path))}>
              Reset all filters
            </button>
            {onDone && (
              <button class="view-results" onClick={onDone}>
                Show {resultCount.toLocaleString("en-GB")}{" "}
                {state.path === "/events"
                  ? resultCount === 1
                    ? "event"
                    : "events"
                  : resultCount === 1
                    ? "film"
                    : "films"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
