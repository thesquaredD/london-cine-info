import { useState } from "preact/hooks";
import type { Film, Showtime } from "../shared/data";
import { shareUrl } from "../lib/sharing";
import { showToast } from "../lib/toast";
import { CopyFallback } from "./copy-fallback";
import { LinkIcon } from "./platform-marks";

/**
 * An icon button that copies a link opening this film with this screening highlighted, and
 * confirms it with the app's toast. The chain-link icon never changes, so nothing moves.
 * Without `onFallback` a refused copy shows its own link field after the actions; with it,
 * the caller places the field (the film sheet gives it the whole screening row).
 */
export function ShareScreening({
  film,
  row,
  venue,
  onFallback,
}: {
  film: Pick<Film, "id" | "ti">;
  row: Pick<Showtime, "venue" | "time" | "screen" | "localTime">;
  venue: string;
  onFallback?: (url: string | null) => void;
}) {
  const [fallback, setFallback] = useState("");
  const show = (url: string | null) => (onFallback ? onFallback(url) : setFallback(url ?? ""));
  return (
    <span class="share-screening-control">
      <button
        class="share-screening"
        aria-label={`Share screening: ${film.ti} at ${venue} ${row.localTime}`}
        onClick={async () => {
          const url = shareUrl(film, location.origin, row);
          try {
            await navigator.clipboard.writeText(url);
            show(null);
            showToast("Screening link copied");
          } catch {
            show(url);
            showToast("Copy the screening link from the selected field.");
          }
        }}
      >
        <LinkIcon />
      </button>
      {fallback && (
        <CopyFallback label="Screening link" value={fallback} onDismiss={() => setFallback("")} />
      )}
    </span>
  );
}
