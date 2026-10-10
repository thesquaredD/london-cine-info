import { useEffect, useRef, useState } from "preact/hooks";
import type { DataMeta } from "../shared/data";
import type { CinemasState } from "../lib/cinemas";
import { distanceMiles, validCoordinates, withinRadius, type Coordinates } from "../lib/distance";
import { Dialog } from "./dialog";
export function MyCinemas({
  cinemas,
  meta,
  open,
  onClose,
  nearby,
}: {
  nearby?: { onApply: (venues: string[]) => void };
  cinemas: CinemasState;
  meta: DataMeta;
  open: boolean;
  onClose: () => void;
}) {
  const draft = cinemas.venues;
  const setDraft = (value: string[] | ((current: string[]) => string[])) => {
    void cinemas.save(typeof value === "function" ? value(cinemas.venues) : value);
  };
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (open) {
      setSearch("");
      setLocationOpen(!!nearby);
      if (nearby)
        requestAnimationFrame(() => {
          if (locationTrigger.current) positionTool(locationTrigger.current);
        });
    }
  }, [open]);
  const [boroughs, setBoroughs] = useState<string[]>([]);
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [originLabel, setOriginLabel] = useState("my location");
  const [panelLeft, setPanelLeft] = useState(0);
  const [panelTop, setPanelTop] = useState(0);
  const tools = useRef<HTMLDivElement>(null);
  const locationTrigger = useRef<HTMLButtonElement>(null);
  const boroughDisclosure = useRef<HTMLDetailsElement>(null);
  const [postcode, setPostcode] = useState("");
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(false);
  const [nearest, setNearest] = useState(false);
  const [radius, setRadius] = useState(nearby ? 3 : 0);
  const [locationOpen, setLocationOpen] = useState(false);
  const locationRequest = useRef(0);
  function positionTool(trigger: HTMLElement) {
    const host = tools.current?.getBoundingClientRect();
    if (!host) return;
    setPanelTop(trigger.getBoundingClientRect().bottom - host.top + 4);
    setPanelLeft(
      Math.max(
        0,
        Math.min(
          trigger.getBoundingClientRect().left - host.left,
          host.width - Math.min(360, host.width),
        ),
      ),
    );
  }
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (tools.current?.contains(event.target as Node)) return;
      setLocationOpen(false);
      if (boroughDisclosure.current) boroughDisclosure.current.open = false;
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [open]);
  function acceptLocation(point: Coordinates, request: number, label = "my location") {
    if (request !== locationRequest.current) return;
    if (!validCoordinates(point)) {
      setLocationError("Location is unavailable. Try another postcode.");
      setLocating(false);
      return;
    }
    setOrigin(point);
    setOriginLabel(label);
    setLocationOpen(false);
    setNearest(true);
    setLocationError("");
    setLocating(false);
  }
  async function lookup() {
    const request = ++locationRequest.current;
    const requestedPostcode = postcode.trim();
    setLocating(true);
    setLocationError("");
    try {
      const response = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(requestedPostcode)}`,
        { referrerPolicy: "no-referrer", signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "Enter a valid UK postcode."
            : "Postcode lookup is unavailable. Try again.",
        );
      const data = await response.json();
      acceptLocation(
        { lat: data.result?.latitude, lon: data.result?.longitude },
        request,
        requestedPostcode,
      );
    } catch (failure) {
      if (request === locationRequest.current) {
        setLocationError(failure instanceof Error ? failure.message : "Postcode lookup failed.");
        setLocating(false);
      }
    }
  }
  function locate() {
    const request = ++locationRequest.current;
    if (!navigator.geolocation) {
      setLocationError("Location is unavailable. Enter a postcode instead.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (result) =>
        acceptLocation({ lat: result.coords.latitude, lon: result.coords.longitude }, request),
      () => {
        if (request === locationRequest.current) {
          setLocationError(
            "Location permission was denied or location is unavailable. Enter a postcode or browse by borough.",
          );
          setLocating(false);
        }
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  const distances = new Map(
    meta.venues.map((venue) => [venue.id, origin ? distanceMiles(origin, venue) : null]),
  );
  const groups = new Map<string, typeof meta.venues>();
  for (const venue of meta.venues) {
    const borough =
      meta.boroughs.find((value) => value.id === venue.borough)?.name ?? "Other cinemas";
    if (!`${venue.name} ${borough}`.toLowerCase().includes(search.toLowerCase())) continue;
    if (boroughs.length && !boroughs.includes(venue.borough)) continue;
    if (origin && !withinRadius(distances.get(venue.id) ?? null, radius)) continue;
    groups.set(search ? "Search results" : nearest && origin ? "Nearest cinemas" : borough, [
      ...(groups.get(search ? "Search results" : nearest && origin ? "Nearest cinemas" : borough) ??
        []),
      venue,
    ]);
  }
  return (
    <Dialog
      className={nearby ? "cinema-dialog nearby-dialog" : "cinema-dialog"}
      open={open}
      title={nearby ? "Find nearby cinemas" : "Manage my cinemas"}
      onClose={onClose}
      restoreTo={() =>
        document.querySelector<HTMLElement>(".empty-state button") ??
        document.querySelector<HTMLElement>(".desktop-sidebar .account-panel button") ??
        document.querySelector<HTMLElement>(".menu-button")
      }
    >
      {!nearby && cinemas.loading && <p role="status">Loading saved cinemas…</p>}
      {!nearby && (cinemas.error || cinemas.storageError) && (
        <div role="alert">
          <p>{cinemas.error || cinemas.storageError}</p>
          {cinemas.conflict ? (
            <>
              <p>
                Your choices are kept here. Another device changed the saved choices. Reloading
                discards your pending edits.
              </p>
              <button onClick={() => void cinemas.reload()}>Use saved choices</button>
            </>
          ) : (
            <button onClick={() => void cinemas.retry()}>Retry</button>
          )}
        </div>
      )}
      <div class="cinema-browse-controls">
        <label for="my-cinema-search">Find cinemas</label>
        <input
          data-initial-focus
          id="my-cinema-search"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          onFocus={() => {
            setLocationOpen(false);
            if (boroughDisclosure.current) boroughDisclosure.current.open = false;
          }}
          type="search"
          value={search}
          onInput={(event) => setSearch(event.currentTarget.value)}
        />

        <div
          class="cinema-tools"
          ref={tools}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || (!locationOpen && !boroughDisclosure.current?.open))
              return;
            event.preventDefault();
            event.stopPropagation();
            if (locationOpen) {
              setLocationOpen(false);
              locationTrigger.current?.focus();
            } else if (boroughDisclosure.current) {
              boroughDisclosure.current.open = false;
              boroughDisclosure.current.querySelector<HTMLElement>("summary")?.focus();
            }
          }}
        >
          <div class="cinema-location-control ph-no-capture">
            <button
              type="button"
              ref={locationTrigger}
              aria-expanded={locationOpen}
              aria-controls="cinema-location-panel"
              onClick={(event) => {
                positionTool(event.currentTarget);
                if (boroughDisclosure.current) boroughDisclosure.current.open = false;
                setLocationOpen(!locationOpen);
              }}
            >
              {origin ? `Near ${originLabel}` : "Location"} ▾
            </button>
            {locationOpen && (
              <div
                id="cinema-location-panel"
                class="cinema-tool-panel cinema-geography"
                style={{
                  "--cinema-panel-left": `${panelLeft}px`,
                  "--cinema-panel-top": `${panelTop}px`,
                }}
              >
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void lookup();
                  }}
                >
                  <label for="cinema-postcode">Your postcode</label>
                  <div class="cinema-postcode-row">
                    <input
                      id="cinema-postcode"
                      class="ph-no-capture"
                      autoComplete="off"
                      placeholder="e.g. SW1A 2AA"
                      value={postcode}
                      onInput={(event) => setPostcode(event.currentTarget.value)}
                    />
                    <button type="submit" disabled={locating || !postcode.trim()}>
                      Find location
                    </button>
                  </div>
                </form>
                <button disabled={locating} onClick={locate}>
                  Use my location
                </button>
                {locating && <p role="status">Finding location…</p>}
                {locationError && <p role="alert">{locationError}</p>}
                {origin && (
                  <>
                    <label class="checkbox-choice">
                      <input
                        type="checkbox"
                        checked={nearest}
                        onChange={(event) => setNearest(event.currentTarget.checked)}
                      />{" "}
                      Nearest first
                    </label>
                    <button
                      onClick={() => {
                        locationRequest.current++;
                        setOrigin(null);
                        setRadius(nearby ? 3 : 0);
                        setNearest(false);
                        setLocationOpen(false);
                      }}
                    >
                      Clear location
                    </button>
                  </>
                )}
                <p class="filter-hint">
                  Approximate straight-line distances. Postcodes are sent to Postcodes.io; your
                  location stays in this chooser.
                </p>
                <button class="cinema-panel-close" onClick={() => setLocationOpen(false)}>
                  Back to cinemas
                </button>
              </div>
            )}
          </div>
          {origin && (
            <>
              <label class="sr-only" for="cinema-radius">
                Radius
              </label>
              <select
                id="cinema-radius"
                value={radius}
                onChange={(event) => setRadius(Number(event.currentTarget.value))}
              >
                <option value="0">Any distance</option>
                {[1, 3, 5, 10].map((value) => (
                  <option value={value}>
                    {value} {value === 1 ? "mile" : "miles"}
                  </option>
                ))}
              </select>
            </>
          )}
          <details ref={boroughDisclosure} class="cinema-borough-control">
            <summary
              onClick={(event) => {
                positionTool(event.currentTarget);
                setLocationOpen(false);
              }}
            >
              Borough · {boroughs.length ? `${boroughs.length} selected` : "All"}
            </summary>
            <div
              class="cinema-tool-panel"
              style={{
                "--cinema-panel-left": `${panelLeft}px`,
                "--cinema-panel-top": `${panelTop}px`,
              }}
            >
              <div class="borough-options">
                {meta.boroughs.map((borough) => (
                  <label class="checkbox-choice" key={borough.id}>
                    <input
                      type="checkbox"
                      checked={boroughs.includes(borough.id)}
                      onChange={() =>
                        setBoroughs(
                          boroughs.includes(borough.id)
                            ? boroughs.filter((id) => id !== borough.id)
                            : [...boroughs, borough.id],
                        )
                      }
                    />{" "}
                    {borough.name}
                  </label>
                ))}
              </div>
              <button onClick={() => setBoroughs([])}>All boroughs</button>
            </div>
          </details>
        </div>
      </div>
      <fieldset class="favourite-options" disabled={cinemas.loading}>
        <legend class="sr-only">All cinemas</legend>
        {(!nearby || origin) &&
          [...groups]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([borough, venues]) => (
              <div key={borough}>
                <h3>{borough}</h3>
                {venues
                  .sort(
                    (a, b) =>
                      (nearest && origin
                        ? (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity)
                        : 0) ||
                      a.name.localeCompare(b.name) ||
                      a.id.localeCompare(b.id),
                  )
                  .map((venue) => (
                    <label key={venue.id}>
                      <input
                        type="checkbox"
                        style={nearby ? { display: "none" } : undefined}
                        checked={!nearby && draft.includes(venue.id)}
                        onChange={() =>
                          !nearby &&
                          setDraft(
                            draft.includes(venue.id)
                              ? draft.filter((id) => id !== venue.id)
                              : [...draft, venue.id],
                          )
                        }
                      />{" "}
                      <span>
                        {venue.name}
                        {origin && (
                          <small>
                            {" "}
                            ·{" "}
                            {distances.get(venue.id) === null
                              ? "Distance unavailable"
                              : `${distances.get(venue.id)!.toFixed(1)} miles`}
                          </small>
                        )}
                      </span>
                    </label>
                  ))}
              </div>
            ))}
        {(!nearby || origin) && !groups.size && <p>No listed cinemas match these filters.</p>}
      </fieldset>
      <div class="cinema-selection-footer">
        {nearby ? (
          <div class="nearby-apply">
            <p>
              {origin
                ? `${[...groups.values()].flat().length} cinemas within ${radius || "any"} ${radius === 1 ? "mile" : "miles"}`
                : "Choose a postcode or use your location."}
            </p>
            <button
              class="booking-action"
              disabled={!origin || !groups.size}
              onClick={() => nearby.onApply([...groups.values()].flat().map((venue) => venue.id))}
            >
              Show films at these cinemas
            </button>
          </div>
        ) : (
          <>
            <section class="selected-cinemas" aria-label="Selected cinemas">
              <h3>Selected cinemas · {draft.length}</h3>
              {draft.length ? (
                <ul>
                  {draft.map((id) => {
                    const venue = meta.venues.find((value) => value.id === id);
                    const name = venue?.name ?? `${id} · not in current listings`;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          disabled={cinemas.loading}
                          aria-label={`Remove ${name}`}
                          onClick={() =>
                            setDraft((value) => value.filter((selected) => selected !== id))
                          }
                        >
                          {name} <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>No cinemas selected yet.</p>
              )}
            </section>
            <div class="cinema-done-row">
              <div class="cinema-save-status">
                <p role="status">
                  {cinemas.busy
                    ? "Saving…"
                    : cinemas.saved && !cinemas.storageError && !cinemas.error
                      ? "Saved"
                      : "Changes save automatically."}
                </p>
                <span>{cinemas.signedIn ? "Synced to your account" : "In this browser"}</span>
              </div>
              <button onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
