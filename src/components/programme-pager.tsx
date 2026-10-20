/**
 * Previous / Next for a film's screenings. The programme renders it twice, on the count line
 * above the first row and in a bar after the last, so a reader turns the page from wherever
 * they are. Turning swaps the rows in place; nothing scrolls.
 */
export function ProgrammePager({
  page,
  pageCount,
  onTurn,
  label,
  class: className = "",
}: {
  /** Zero-based current page. */
  page: number;
  pageCount: number;
  onTurn: (page: number) => void;
  label: string;
  class?: string;
}) {
  return (
    <nav class={className ? `programme-pager ${className}` : "programme-pager"} aria-label={label}>
      <button
        type="button"
        aria-label="Previous screenings"
        disabled={page === 0}
        onClick={() => onTurn(page - 1)}
      >
        ‹ Previous
      </button>
      <span class="programme-page">
        Page {page + 1} of {pageCount}
      </span>
      <span class="programme-page-short">
        {page + 1} / {pageCount}
      </span>
      <button
        type="button"
        aria-label="Next screenings"
        disabled={page + 1 === pageCount}
        onClick={() => onTurn(page + 1)}
      >
        Next ›
      </button>
    </nav>
  );
}
