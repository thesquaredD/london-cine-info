/** Share glyph: an arrow leaving a tray. `copied` swaps it for a check at the same size. */
export function ShareIcon({ copied = false }: { copied?: boolean }) {
  return (
    <svg
      class="share-icon"
      viewBox="0 0 20 20"
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
      {copied ? <path d="M4 10.5 8 14.5 16 5.5" /> : <path d="M10 3v10M6 7l4-4 4 4M4 11v6h12v-6" />}
    </svg>
  );
}
