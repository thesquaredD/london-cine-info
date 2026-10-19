import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { DataMeta } from "../shared/data";
import {
  DEFAULT_NEARBY_RANGE,
  LocationError,
  NEARBY_RANGES,
  createRequestGate,
  locateDevice,
  lookupPostcode,
  milesLabel,
  nearbyVenues,
  selectedVenues,
  setAllExcluded,
  statusMessage,
  toggleExcluded,
  type FoundLocation,
  type NearbyStatus,
} from "../lib/nearby";
import { Dialog } from "./dialog";

export const NEARBY_TITLE = "Find nearby cinemas";

/**
 * One screen: postcode or device location → range → optionally uncheck cinemas → Show films.
 * The choice is applied as a temporary cinema filter; saved My cinemas are never written here.
 */
export function NearbyCinemas({
  meta,
  open,
  onClose,
  onApply,
}: {
  meta: DataMeta;
  open: boolean;
  onClose: () => void;
  onApply: (venues: string[]) => void;
}) {
  // State lives outside the dialog body so reopening "Near me" resumes the last search.
  const [postcode, setPostcode] = useState("");
  const [origin, setOrigin] = useState<FoundLocation | null>(null);
  const [range, setRange] = useState(DEFAULT_NEARBY_RANGE);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());
  const [status, setStatus] = useState<NearbyStatus>({ kind: "idle" });
  const gate = useRef(createRequestGate());
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => () => gate.current.cancel(), []);
  useEffect(() => {
    if (open) return;
    // Closing abandons any lookup still in flight; the last good result stays.
    gate.current.cancel();
    setStatus((current) =>
      current.kind === "checking" || current.kind === "locating"
        ? origin
          ? { kind: "found", label: origin.label }
          : { kind: "idle" }
        : current,
    );
  }, [open]);
  useKeyboardInset(open, dialog);

  const venues = useMemo(
    () => nearbyVenues(meta, origin?.point ?? null, range),
    [meta, origin, range],
  );
  const selected = selectedVenues(venues, excluded);
  const busy = status.kind === "checking" || status.kind === "locating";
  const message = statusMessage(status, venues.length, range);
  const boroughs = useMemo(
    () => new Map(meta.boroughs.map((borough) => [borough.id, borough.name])),
    [meta],
  );

  async function run(
    kind: "checking" | "locating",
    find: (signal: AbortSignal) => Promise<FoundLocation>,
  ) {
    const { id, signal } = gate.current.start();
    setStatus({ kind });
    try {
      const found = await find(signal);
      if (!gate.current.isCurrent(id)) return;
      setOrigin(found);
      setStatus({ kind: "found", label: found.label });
      if (found.source === "postcode") setPostcode(found.label);
      // On touch screens, close the keyboard so the list and Show films are in view.
      const active = document.activeElement as HTMLElement | null;
      if (active?.id === "nearby-postcode" && matchMedia("(pointer: coarse)").matches)
        active.blur();
    } catch (failure) {
      if (!gate.current.isCurrent(id)) return;
      setStatus(
        failure instanceof LocationError
          ? { kind: "failed", error: failure.kind, source: failure.source }
          : {
              kind: "failed",
              error: "service",
              source: kind === "locating" ? "device" : "postcode",
            },
      );
    }
  }
  function cancel() {
    gate.current.cancel();
    setStatus(origin ? { kind: "found", label: origin.label } : { kind: "idle" });
  }
  const failedPostcode = status.kind === "failed" && status.source === "postcode";
  const allSelected = venues.length > 0 && selected.length === venues.length;

  return (
    <Dialog
      className="cinema-dialog nearby-finder"
      open={open}
      title={NEARBY_TITLE}
      onClose={onClose}
      restoreTo={() =>
        document.querySelector<HTMLElement>(".nearby-context button") ??
        document.querySelector<HTMLElement>(".shortcut-strip button") ??
        document.querySelector<HTMLElement>(".menu-button")
      }
    >
      <div class="nearby-finder-body" ref={dialog}>
        <div class="nearby-finder-controls">
          <form
            class="nearby-finder-postcode"
            onSubmit={(event) => {
              event.preventDefault();
              void run("checking", (signal) => lookupPostcode(postcode, signal));
            }}
          >
            <label for="nearby-postcode">Postcode</label>
            <div class="nearby-finder-field">
              <input
                id="nearby-postcode"
                class="ph-no-capture"
                data-initial-focus={!origin || undefined}
                placeholder="e.g. SW1A 2AA"
                autoComplete="postal-code"
                autoCapitalize="characters"
                enterKeyHint="search"
                spellcheck={false}
                value={postcode}
                aria-invalid={failedPostcode}
                aria-describedby="nearby-status"
                onInput={(event) => setPostcode(event.currentTarget.value)}
              />
              <button type="submit">Find</button>
            </div>
          </form>
          <button
            type="button"
            class="nearby-finder-device"
            aria-describedby="nearby-status"
            onClick={() =>
              void run("locating", () =>
                locateDevice("geolocation" in navigator ? navigator.geolocation : undefined),
              )
            }
          >
            Use my location
          </button>
          <div class="nearby-finder-range">
            <label for="nearby-range">Range</label>
            <select
              id="nearby-range"
              value={range}
              onChange={(event) => setRange(Number(event.currentTarget.value))}
            >
              {NEARBY_RANGES.map((value) => (
                <option key={value} value={value}>
                  {milesLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <div class={`nearby-finder-status is-${message.tone}`}>
            <p id="nearby-status" role="status" aria-live="polite">
              {message.text}
            </p>
            {busy && (
              <button type="button" class="nearby-finder-link" onClick={cancel}>
                Cancel
              </button>
            )}
          </div>
        </div>
        <div class="nearby-finder-heading">
          <span id="nearby-list-label">
            {origin ? `Cinemas within ${milesLabel(range)} · nearest first` : "Nearby cinemas"}
          </span>
          {venues.length > 1 && (
            <button
              type="button"
              class="nearby-finder-link"
              onClick={() => setExcluded(setAllExcluded(excluded, venues, allSelected))}
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          )}
        </div>
        <div
          class="nearby-finder-list"
          role="group"
          aria-labelledby="nearby-list-label"
          tabIndex={origin ? 0 : -1}
          data-initial-focus={origin ? true : undefined}
          aria-busy={busy}
        >
          {!origin ? (
            <p class="nearby-finder-empty">Cinemas near you will appear here, nearest first.</p>
          ) : !venues.length ? (
            <p class="nearby-finder-empty">
              No cinemas with listings within {milesLabel(range)}. Choose a wider range.
            </p>
          ) : (
            venues.map((venue, index) => (
              <label class="nearby-finder-choice" key={venue.id}>
                <input
                  type="checkbox"
                  aria-label={venue.name}
                  aria-describedby={`nearby-where-${index}`}
                  checked={!excluded.has(venue.id)}
                  onChange={() => setExcluded(toggleExcluded(excluded, venue.id))}
                />
                <span class="nearby-finder-name">
                  <span>{venue.name}</span>
                  <small>{boroughs.get(venue.borough) ?? ""}</small>
                </span>
                <span class="nearby-finder-distance">
                  {venue.distance.toFixed(1)} mi
                  <span class="sr-only" id={`nearby-where-${index}`}>
                    {venue.distance.toFixed(1)} miles, {boroughs.get(venue.borough) ?? ""}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
        <footer class="nearby-finder-footer">
          <p aria-live="polite">
            {origin
              ? `${selected.length} of ${venues.length} ${venues.length === 1 ? "cinema" : "cinemas"} selected`
              : "Straight-line distances. Postcodes are checked with Postcodes.io."}
          </p>
          <button
            type="button"
            class="booking-action"
            disabled={!selected.length || busy}
            onClick={() => onApply(selected)}
          >
            Show films
          </button>
        </footer>
      </div>
    </Dialog>
  );
}

/**
 * Phones overlay the on-screen keyboard on the page. Lift the bottom sheet above it so the
 * selection count and Show films stay reachable while typing a postcode.
 */
function useKeyboardInset(open: boolean, body: { current: HTMLElement | null }) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport) return;
    const update = () => {
      const sheet = body.current?.closest("dialog");
      if (!sheet) return;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      sheet.style.setProperty("--nearby-keyboard", `${Math.round(inset)}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [open]);
}
