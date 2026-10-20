// Brand marks for the film-links row. Each is reproduced in its owner's colours, which are
// the only hex values allowed here: they are not theme tokens and never change with the theme.

export function YouTubeMark() {
  return (
    <svg class="youtube-mark" viewBox="0 0 24 17" aria-hidden="true" focusable="false">
      <rect width="24" height="17" rx="4" fill="#ff0000" />
      <path d="M9.5 4.5v8l7-4z" fill="#ffffff" />
    </svg>
  );
}

export function LetterboxdMark() {
  return (
    <svg class="letterboxd-mark" viewBox="0 0 26 14" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="6.5" fill="#ff8000" />
      <circle cx="19" cy="7" r="6.5" fill="#40bcf4" />
      <circle cx="13" cy="7" r="6.5" fill="#00e054" />
    </svg>
  );
}

export function ImdbMark() {
  return (
    <svg class="imdb-mark" viewBox="0 0 40 18" aria-hidden="true" focusable="false">
      <rect width="40" height="18" rx="3" fill="#f5c518" />
      <text
        x="20"
        y="13"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="11.5"
        font-weight="700"
        fill="#000000"
      >
        IMDb
      </text>
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg
      class="link-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}
