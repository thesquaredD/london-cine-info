// Line icons for the filter bar, drawn like the feedback icon: 24 box, 1.6 stroke, round caps.
const LINE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.6",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
  focusable: "false",
} as const;

/** Three sliders: opens the Filters sheet. */
export function SlidersIcon() {
  return (
    <svg class="sliders-icon" width="22" height="22" {...LINE}>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

/** Up and down arrows: the current sort. */
export function SortIcon() {
  return (
    <svg class="sort-icon" width="18" height="18" {...LINE}>
      <path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" />
    </svg>
  );
}
