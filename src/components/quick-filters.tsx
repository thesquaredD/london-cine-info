import type { ComponentChildren } from "preact";
import { Dialog } from "./dialog";
export function QuickFilters({
  children,
  open,
  onOpen,
  onClose,
  activeCount,
  resultCount,
  resultLabel = "film",
  hideMobileTrigger = false,
}: {
  children: ComponentChildren;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  activeCount: number;
  resultCount: number;
  resultLabel?: "film" | "event";
  hideMobileTrigger?: boolean;
}) {
  return (
    <>
      <div class="quick-filters-desktop">{children}</div>
      {!hideMobileTrigger && (
        <QuickFilterTrigger open={open} onOpen={onOpen} activeCount={activeCount} />
      )}
      <Dialog open={open} onClose={onClose} title="Quick filters" className="quick-filter-dialog">
        <p class="filter-hint">Choose shortcuts, then return to the results.</p>
        {children}
        <button class="view-results" onClick={onClose}>
          Show {resultCount.toLocaleString("en-GB")}{" "}
          {resultCount === 1 ? resultLabel : `${resultLabel}s`}
        </button>
      </Dialog>
    </>
  );
}

export function QuickFilterTrigger({
  open,
  onOpen,
  activeCount,
}: {
  open: boolean;
  onOpen: () => void;
  activeCount: number;
}) {
  return (
    <button
      class="quick-filters-mobile"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
    >
      <span>Quick filters</span>
      <span class="shortcut-count" style={{ visibility: activeCount ? "visible" : "hidden" }}>
        {" "}
        · {activeCount || 0}
      </span>
      <span class="control-caret" aria-hidden="true">
        ▾
      </span>
    </button>
  );
}
