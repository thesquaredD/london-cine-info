import type { FacetKey } from "@readograph/core/data";

// One line icon per Filters sheet row: 20px, 1.6 stroke, round caps, drawn on a 24 box like
// the feedback and sliders icons. Decorative; the row title names the filter.
const PATHS: Record<FacetKey | "year" | "watchlists", preact.JSX.Element> = {
  day: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  venue: (
    <>
      <path d="M3 5.5c6-1.5 12-1.5 18 0v9c-6-1.5-12-1.5-18 0z" />
      <path d="M8 19.5h8M12 15v4.5" />
    </>
  ),
  borough: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  membership: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3 9.5h18M6.5 14.5h4" />
    </>
  ),
  watchlists: <path d="M6.5 3.5h11v17L12 16l-5.5 4.5z" />,
  genre: (
    <>
      <path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </>
  ),
  format: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="1" />
      <path d="M8 3.5v17M16 3.5v17M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4" />
    </>
  ),
  language: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" />
    </>
  ),
  year: (
    <>
      <path d="M6.5 3.5h11M6.5 20.5h11" />
      <path d="M7.5 3.5c0 5 9 5 9 8.5s-9 3.5-9 8.5M16.5 3.5c0 5-9 5-9 8.5s9 3.5 9 8.5" />
    </>
  ),
  accessibility: (
    <>
      <circle cx="12" cy="4.5" r="1.75" />
      <path d="M5 8.5l7 1.5 7-1.5M12 10v4.5M12 14.5l-3.5 6M12 14.5l3.5 6" />
    </>
  ),
};

export function FilterIcon({ name }: { name: FacetKey | "year" | "watchlists" }) {
  return (
    <svg
      class="filter-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
