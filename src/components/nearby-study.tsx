import { useEffect, useRef, useState } from "preact/hooks";
import type { DataMeta, Film } from "../shared/data";
import { distanceMiles, validCoordinates, type Coordinates } from "../lib/distance";
import { readView, sortFilms } from "../lib/catalogue";
import { filterFilms } from "../lib/filters";
import { DEFAULT_DISPLAY } from "../lib/display";
import { FilmTable } from "./film-table";

export function NearbyStudy({
  meta,
  films,
  startVenue,
}: {
  meta: DataMeta;
  films: Film[];
  startVenue: string | null;
}) {
  const [applied, setApplied] = useState<string[] | null>(startVenue ? [startVenue] : null);
  const [postcode, setPostcode] = useState("");
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [originLabel, setOriginLabel] = useState("");
  const [range, setRange] = useState(3);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("Enter a postcode, or use your current location.");
  const [error, setError] = useState(false);
  const [tableState, setTableState] = useState(() => readView(new URL(location.origin)));
  const [expanded, setExpanded] = useState<string | null>(null);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current++;
      controller.current?.abort();
    },
    [],
  );
  const nearby = origin
    ? meta.venues
        .map((v) => ({ ...v, distance: distanceMiles(origin, v) }))
        .filter((v) => v.distance !== null && v.distance <= range)
        .sort((a, b) => a.distance! - b.distance!)
    : [];
  const selected = nearby.filter((v) => !excluded.includes(v.id)).map((v) => v.id);
  function accept(point: Coordinates, label: string, id: number) {
    if (id !== request.current) return;
    if (!validCoordinates(point)) {
      setError(true);
      setMessage("Location is unavailable. Try a postcode instead.");
      setBusy(false);
      return;
    }
    setOrigin(point);
    setOriginLabel(label);
    setExcluded([]);
    setBusy(false);
    setError(false);
    setMessage(`Location found: ${label}.`);
  }
  async function lookup() {
    setLocating(false);
    if (!postcode.trim()) {
      setError(true);
      setMessage("Enter a full UK postcode.");
      return;
    }
    const id = ++request.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setBusy(true);
    setError(false);
    setMessage("Checking postcode…");
    try {
      const response = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`,
        {
          referrerPolicy: "no-referrer",
          signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(10000)]),
        },
      );
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "Postcode not found. Check it and try again."
            : "Postcode lookup is unavailable. Please try again.",
        );
      const data = await response.json();
      accept(
        { lat: data.result?.latitude, lon: data.result?.longitude },
        data.result?.postcode ?? postcode.trim().toUpperCase(),
        id,
      );
    } catch (e) {
      if (id === request.current) {
        setBusy(false);
        setError(true);
        setMessage(
          e instanceof Error && e.name === "TimeoutError"
            ? "The lookup timed out. Please try again."
            : e instanceof TypeError
              ? "Couldn’t reach the postcode service. Check your connection and try again."
              : e instanceof Error
                ? e.message
                : "Postcode lookup is unavailable. Please try again.",
        );
      }
    }
  }
  function locate() {
    setLocating(true);
    const id = ++request.current;
    controller.current?.abort();
    setBusy(true);
    setError(false);
    setMessage("Waiting for your location…");
    if (!navigator.geolocation) {
      setBusy(false);
      setError(true);
      setMessage("Location is unavailable. Enter a postcode instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => accept({ lat: p.coords.latitude, lon: p.coords.longitude }, "your location", id),
      (e) => {
        if (id === request.current) {
          setBusy(false);
          setError(true);
          setMessage(
            e.code === 1
              ? "Location access is blocked. Enter a postcode instead."
              : "Couldn’t get your location. Enter a postcode instead.",
          );
        }
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  const view = { ...tableState, filters: { venue: applied ?? [] } };
  const matching = applied
    ? sortFilms(
        filterFilms(films, meta, view, new Date(meta.generatedAt)),
        view.sort,
        view.direction,
      )
    : [];
  return applied ? (
    <>
      <article class="prose nearby-films-head">
        <button class="nearby-link" onClick={() => setApplied(null)}>
          Change cinemas
        </button>
        <h2>
          {applied.length === 1
            ? meta.venues.find((v) => v.id === applied[0])?.name
            : "Films at your selected cinemas"}
        </h2>
        <p class="prose-lede">
          {matching.length} films · {applied.length} cinemas
        </p>
        <p class="prose-small">Cached programme from 10 October · not current availability</p>
      </article>
      <FilmTable
        films={matching}
        meta={meta}
        state={view}
        now={new Date(meta.generatedAt)}
        display={DEFAULT_DISPLAY}
        expanded={expanded}
        onExpand={setExpanded}
        onChange={(changes) => setTableState((s) => ({ ...s, ...changes }))}
      />
    </>
  ) : (
    <article class="prose nearby-simple">
      <h2>Cinemas near me</h2>
      <p class="prose-lede">Choose a location and range. Uncheck any cinemas you don’t want.</p>
      <div class="nearby-simple-controls">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
        >
          <label for="nearby-postcode">Postcode</label>
          <div class="nearby-simple-input">
            <input
              id="nearby-postcode"
              placeholder="e.g. N1 8XX"
              autoComplete="postal-code"
              value={postcode}
              aria-invalid={error && !locating}
              aria-describedby="nearby-status"
              onInput={(e) => setPostcode(e.currentTarget.value)}
            />
            <button type="submit" disabled={busy}>
              {busy && !locating ? "Finding…" : "Find"}
            </button>
          </div>
        </form>
        <button class="nearby-device" disabled={busy} onClick={locate}>
          {busy && locating ? "Locating…" : "Use my location"}
        </button>
        <label class="nearby-range">
          Range
          <select
            aria-label="Range"
            value={range}
            onChange={(e) => setRange(Number(e.currentTarget.value))}
          >
            {[1, 3, 5, 10].map((n) => (
              <option value={n}>
                {n} {n === 1 ? "mile" : "miles"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div id="nearby-status" class="nearby-simple-status" role={error ? "alert" : "status"}>
        <p>{message}</p>
        <button
          class="nearby-link"
          style={{ visibility: busy ? "visible" : "hidden" }}
          tabIndex={busy ? 0 : -1}
          aria-hidden={!busy}
          onClick={() => {
            request.current++;
            controller.current?.abort();
            setBusy(false);
            setMessage(
              origin
                ? `Location found: ${originLabel}.`
                : "Enter a postcode, or use your current location.",
            );
          }}
        >
          Cancel
        </button>
      </div>
      <div class="nearby-list-heading">
        <span>
          {origin
            ? `${nearby.length} cinemas within ${range} ${range === 1 ? "mile" : "miles"}`
            : "Nearby cinemas"}
        </span>
        <span>Nearest first</span>
      </div>
      <div class="nearby-all-results" role="region" aria-label="Nearby cinema choices" tabIndex={0}>
        {!origin ? (
          <div class="nearby-list-placeholder">
            <p>Your nearby cinemas will appear here.</p>
          </div>
        ) : !nearby.length ? (
          <div class="nearby-list-placeholder">
            <p>No listed cinemas within this range. Try a wider range.</p>
          </div>
        ) : (
          nearby.map((v) => (
            <label class="nearby-choice" key={v.id}>
              <input
                type="checkbox"
                checked={!excluded.includes(v.id)}
                onChange={() =>
                  setExcluded(
                    excluded.includes(v.id)
                      ? excluded.filter((id) => id !== v.id)
                      : [...excluded, v.id],
                  )
                }
              />
              <span>
                <strong>{v.name}</strong>
                <small>{meta.boroughs.find((b) => b.id === v.borough)?.name}</small>
              </span>
              <span>{v.distance!.toFixed(1)} mi</span>
            </label>
          ))
        )}
      </div>
      <footer class="prose-footer nearby-simple-footer">
        <p role="status">
          {selected.length} of {nearby.length} cinemas selected
        </p>
        <button
          class="booking-action"
          disabled={!selected.length || busy}
          onClick={() => setApplied(selected)}
        >
          Show films
        </button>
      </footer>
      <p class="prose-small">
        Distances are straight-line miles. Postcodes are sent to Postcodes.io for this search.
      </p>
    </article>
  );
}
