import { WatchlistsButton } from "./friends";
import { useEffect, useRef, useState } from "preact/hooks";
import { FilterControls, type FilterControlsProps } from "./filter-controls";
import type { FacetKey } from "../shared/data";

export function FilterBar(
  props: FilterControlsProps & {
    yearOpenRequest: number;
    hideRatings?: boolean;
  },
) {
  const [category, setCategory] = useState<FacetKey | "year" | "all" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.yearOpenRequest) return;
    setCategory("year");
  }, [props.yearOpenRequest]);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (category) {
      if (!node.open) node.showModal();
      node.querySelectorAll<HTMLDetailsElement>(".filter-picker").forEach((picker) => {
        picker.open = picker.dataset.filter === category;
      });
      if (category !== "all") {
        const picker = node.querySelector<HTMLDetailsElement>(`[data-filter="${category}"]`);
        picker?.querySelector<HTMLElement>("summary")?.focus();
        if (picker) {
          const heading = node.querySelector<HTMLElement>(".sheet-heading");
          node.scrollTop = picker.offsetTop - (heading?.offsetHeight ?? 0) - 12;
        }
      }
    } else if (node.open) node.close();
  }, [category]);
  useEffect(() => {
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") return;
      if (event.type === "pointerdown" && bar.current?.contains(event.target as Node)) return;
      const openPickers = bar.current?.querySelectorAll<HTMLDetailsElement>(
        ".desktop-filters details[open]",
      );
      const activePicker =
        event.type === "keydown"
          ? [...(openPickers ?? [])].find(
              (picker) =>
                picker.name === "desktop-filters" && picker.contains(event.target as Node),
            )
          : null;
      openPickers?.forEach((picker) => {
        picker.open = false;
      });
      activePicker?.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const count = (keys: FacetKey[]) =>
    keys.reduce(
      (n, key) =>
        n + (props.state.filters[key]?.length ?? 0) + (props.state.excluded[key]?.length ?? 0),
      0,
    );
  const moreCount =
    count([
      "day",
      "time",
      "venue",
      "genre",
      "language",
      "borough",
      "format",
      "accessibility",
      "membership",
    ]) +
    (props.state.years?.length ?? 0) +
    (props.state.decades?.length ?? 0) +
    Number(!!(props.state.from || props.state.to)) +
    Number(!!props.state.short) +
    Number(!!props.state.available) +
    Number(!!props.state.watchlist);
  const countLabel = (value: number) => (
    <span class="shortcut-count" style={{ visibility: value ? "visible" : "hidden" }}>
      {" "}
      · {value || 0}
    </span>
  );
  return (
    <div class="filter-bar" ref={bar}>
      <label class="sr-only" for="bar-search">
        Search
      </label>
      <input
        id="bar-search"
        class="bar-search"
        type="search"
        placeholder="What do you want to see?"
        value={props.state.search}
        onInput={(event) => props.onChange({ search: event.currentTarget.value, page: 1 })}
      />
      <div class="desktop-filters">
        <FilterControls
          {...props}
          showSearch={false}
          filterKeys={["venue", "genre"]}
          idPrefix="desktop"
        />
      </div>
      <button
        class="all-filters"
        aria-label="Filters"
        data-active={moreCount > 0}
        aria-haspopup="dialog"
        onClick={() => setCategory("all")}
      >
        <span>Filters</span>
        {countLabel(moreCount)}
        <span class="control-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <dialog
        ref={dialog}
        class="filter-sheet"
        aria-label="Filters"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setCategory(null);
          }
        }}
        onClose={() => setCategory(null)}
        onCancel={() => setCategory(null)}
        onClick={(event) => {
          if (event.target === dialog.current) setCategory(null);
        }}
      >
        <div class="sheet-heading">
          <h2>Filters</h2>
          <button aria-label="Close filters" onClick={() => setCategory(null)}>
            ×
          </button>
        </div>
        <div class="sheet-watchlists" onClickCapture={() => setCategory(null)}>
          <WatchlistsButton />
        </div>
        <FilterControls {...props} idPrefix="sheet" onDone={() => setCategory(null)} />
      </dialog>
    </div>
  );
}
