import type { ComponentChildren } from "preact";
import { Dialog } from "./dialog";
export function QuickFilters({
  children,
  open,
  onOpen,
  onClose,
  activeCount,
  resultCount,
}: {
  children: ComponentChildren;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  activeCount: number;
  resultCount: number;
}) {
  return (
    <>
      <div class="quick-filters-desktop">{children}</div>
      <button
        class="quick-filters-mobile"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onOpen}
      >
        Quick filters{activeCount ? ` · ${activeCount}` : ""} ▾
      </button>
      <Dialog open={open} onClose={onClose} title="Quick filters" className="quick-filter-dialog">
        <p class="filter-hint">Choose shortcuts, then return to the results.</p>
        {children}
        <button class="view-results" onClick={onClose}>
          Show {resultCount.toLocaleString("en-GB")} {resultCount === 1 ? "film" : "films"}
        </button>
      </Dialog>
    </>
  );
}
