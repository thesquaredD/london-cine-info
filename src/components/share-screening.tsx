import { useEffect, useRef, useState } from "preact/hooks";
import type { Film, Showtime } from "../shared/data";
import { shareUrl } from "../lib/sharing";
import { CopyFallback } from "./copy-fallback";
import { ShareIcon } from "./share-icon";

const COPIED = "Screening link copied";

/**
 * An icon button that copies a link opening this film with this screening highlighted.
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
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState("");
  const timers = useRef<number[]>([]);
  // Clear then re-set so screen readers announce every share (as Share film does), and drop
  // the message after a while. The icon swaps at the same size, so nothing moves.
  const announce = (text: string) => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setMessage("");
    timers.current = [
      window.setTimeout(() => setMessage(text), 100),
      window.setTimeout(() => setMessage(""), 5000),
    ];
  };
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
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
            announce(COPIED);
          } catch {
            show(url);
            announce("Copy the screening link from the selected field.");
          }
        }}
      >
        <ShareIcon copied={message === COPIED} />
      </button>
      <span class="sr-only" role="status">
        {message}
      </span>
      {fallback && (
        <CopyFallback label="Screening link" value={fallback} onDismiss={() => setFallback("")} />
      )}
    </span>
  );
}
