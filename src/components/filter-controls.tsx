import type { ComponentChildren } from "preact";
import { YearPicker } from "./year-picker";
import { FilterIcon } from "./filter-icons";
import type { AccountState } from "../lib/account";
import { FilterPicker } from "./filter-picker";
import { clearFilters, FILTERS } from "../lib/filters";
import type { FacetKey } from "../shared/data";
import type { DataMeta } from "../shared/data";
import type { ViewState } from "../lib/catalogue";

export type FilterControlsProps = {
  account: AccountState;
  filterKeys?: (FacetKey | "year")[];
  yearDecades: number[];
  yearCounts: Map<number, number>;
  showSearch?: boolean;
  state: ViewState;
  meta: DataMeta | null;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
  idPrefix?: string;
  counts: Record<FacetKey, Map<string, number>> | null;
  resultCount: number;
  onDone?: () => void;
  /** The Watchlists row, placed first in the What group of the sheet. */
  watchlists?: ComponentChildren;
};
export function FilterControls({
  filterKeys,
  yearDecades,
  yearCounts,
  account,
  showSearch = true,
  state,
  meta,
  onChange,
  idPrefix = "desktop",
  counts,
  resultCount,
  onDone,
  watchlists,
}: FilterControlsProps) {
  const grouped = !filterKeys;
  const labels = new Map(FILTERS.map(({ key, label }) => [key, label]));
  const picker = (key: FacetKey) => {
    if (!meta) return null;
    const label = labels.get(key)!;
    return (
      <FilterPicker
        key={key}
        icon={grouped ? <FilterIcon name={key} /> : undefined}
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
            : key === "venue" && state.independent && !state.excluded.venue?.length
              ? state.filters.venue?.length
                ? `${state.filters.venue.length} selected · independent only`
                : "Independent only"
              : undefined
        }
        before={
          key === "venue" && (
            <div class="independent-filter">
              <label class="availability-filter">
                <input
                  type="checkbox"
                  checked={!!state.independent}
                  aria-describedby={`${idPrefix}-independent-hint`}
                  onChange={(event) =>
                    onChange({ independent: event.currentTarget.checked, page: 1 })
                  }
                />
                Independent cinemas only
              </label>
              <p class="filter-hint" id={`${idPrefix}-independent-hint`}>
                Shows cinemas we’ve checked that are independent, charities or run by a public or
                educational body. Chains, and cinemas we haven’t checked yet, are left out.
              </p>
            </div>
          )
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
    );
  };
  const year = () =>
    meta && (
      <YearPicker
        icon={grouped ? <FilterIcon name="year" /> : undefined}
        selection={state}
        decades={yearDecades}
        counts={yearCounts}
        idPrefix={idPrefix}
        onChange={(selection) => onChange({ ...selection, page: 1 })}
      />
    );
  if (!grouped)
    return (
      <div class="filter-controls">
        <div class="filter-fields">
          {meta &&
            FILTERS.filter(({ key }) => filterKeys.includes(key)).map(({ key }) => picker(key))}
          {filterKeys.includes("year") && year()}
        </div>
      </div>
    );
  // The Filters sheet: a search field, rows grouped by When, Where and What, the tick boxes
  // together, then a footer bar that stays in view while the body scrolls.
  const group = (id: string, title: string, rows: ComponentChildren) => (
    <section class="filter-group" aria-labelledby={`${idPrefix}-group-${id}`}>
      <h3 class="filter-group-heading" id={`${idPrefix}-group-${id}`}>
        {title}
      </h3>
      <div class="filter-group-rows">{rows}</div>
    </section>
  );
  return (
    <div class="filter-controls sheet-controls">
      <div class="sheet-body">
        {showSearch && (
          <div class="sheet-search">
            <label class="sr-only" for={`${idPrefix}-search`}>
              Search
            </label>
            <input
              id={`${idPrefix}-search`}
              type="search"
              placeholder="Film or director"
              value={state.search}
              onInput={(event) => onChange({ search: event.currentTarget.value, page: 1 })}
            />
          </div>
        )}
        {meta && (
          <>
            {group(
              "when",
              "When",
              <>
                {picker("day")}
                {picker("time")}
              </>,
            )}
            {group(
              "where",
              "Where",
              <>
                {picker("venue")}
                {picker("borough")}
                {picker("membership")}
              </>,
            )}
            {group(
              "what",
              "What",
              <>
                {watchlists}
                {picker("genre")}
                {picker("format")}
                {picker("language")}
                {year()}
                {picker("accessibility")}
              </>,
            )}
          </>
        )}
        <fieldset class="filter-group only-show">
          <legend class="filter-group-heading">Only show</legend>
          <div class="filter-group-rows">
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
            <label class="availability-filter">
              <input
                type="checkbox"
                checked={!!state.short}
                onChange={(event) => onChange({ short: event.currentTarget.checked, page: 1 })}
              />{" "}
              Under 2 hours
            </label>
          </div>
        </fieldset>
      </div>
      <div class="sheet-footer">
        <button class="reset-button" onClick={() => onChange(clearFilters(state.path))}>
          Reset all
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
      </div>
    </div>
  );
}
