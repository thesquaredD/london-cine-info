import { useEffect, useRef, useState } from "preact/hooks";
import type { Film, Showtime } from "../shared/data";
import { shareUrl } from "../lib/sharing";

const COPIED = "Screening link copied";

/** Copies a link that opens this film with this screening highlighted. */
export function ShareScreening({
  film,
  row,
  venue,
}: {
  film: Pick<Film, "id" | "ti">;
  row: Pick<Showtime, "venue" | "time" | "screen" | "localTime">;
  venue: string;
}) {
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState("");
  const timers = useRef<number[]>([]);
  // Clear then re-set so screen readers announce every share (as Share film does), and drop
  // the message after a while. The button keeps its width, so "Copied" moves nothing.
  const announce = (text: string) => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setMessage("");
    timers.current = [
      window.setTimeout(() => setMessage(text), 100),
      window.setTimeout(() => setMessage(""), 5000),
    ];
  };
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  return (
    <span class="share-screening-control">
      <button
        class="share-screening"
        aria-label={`Share screening: ${film.ti} at ${venue} ${row.localTime}`}
        onClick={async () => {
          const url = shareUrl(film, location.origin, row);
          try {
            await navigator.clipboard.writeText(url);
            setFallback("");
            announce(COPIED);
          } catch {
            setFallback(url);
            announce("Copy the screening link below.");
          }
        }}
      >
        {message === COPIED ? "Copied" : "Share"}
      </button>
      <span class="sr-only" role="status">
        {message}
      </span>
      {fallback && (
        <input
          class="share-fallback"
          aria-label="Screening link"
          readOnly
          value={fallback}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </span>
  );
}
