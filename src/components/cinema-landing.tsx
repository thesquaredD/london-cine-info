import { useEffect, useState } from "preact/hooks";
import type { DataMeta } from "../shared/data";

/**
 * Featured venues. Logos are self-hosted copies of each cinema's own published mark.
 * Close-Up's mark is its name in Impact capitals, so it is set as styled text rather than an image.
 */
type Featured = { id: string; name: string; logo: string | null; wide?: boolean; type?: string };
const FEATURED: Featured[] = [
  { id: "princecharlescinema.com", name: "Prince Charles", logo: "prince-charles-cinema.svg" },
  { id: "bfi.org.uk-southbank", name: "BFI Southbank", logo: "bfi-southbank.svg" },
  { id: "closeupfilmcentre.com", name: "Close-Up", logo: null, type: "closeup" },
  { id: "riocinema.org.uk", name: "Rio", logo: "rio-cinema-lettering.png" },
  { id: "genesiscinema.co.uk", name: "Genesis", logo: "genesiscinema.png" },
  {
    id: "picturehouses.com-central",
    name: "Picturehouse Central",
    logo: "picturehouse-central.png",
  },
  {
    id: "everymancinema.com-screen-on-the-green",
    name: "Everyman Screen on the Green",
    logo: "everyman-screen-on-the-green.png",
    wide: true,
  },
  { id: "barbican.org.uk", name: "Barbican", logo: "barbican.svg", wide: true },
];

export function venueHref(id: string) {
  return `/?${new URLSearchParams({ venue: id })}`;
}

function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function VenueMark({ name, logo, wide, type }: Featured) {
  const [failed, setFailed] = useState(false);
  return (
    <span class={`welcome-mark ${wide ? "is-wide" : ""}`} aria-hidden="true">
      {logo && !failed ? (
        <img src={`/cinemas/${logo}`} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span class={`welcome-wordmark ${type ? `welcome-wordmark-${type}` : ""}`}>{name}</span>
      )}
    </span>
  );
}

function plain(event: MouseEvent) {
  return !(event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

export function CinemaLanding({
  meta,
  onVenue,
  onBrowse,
  onNearby,
  onNavigate,
}: {
  meta: DataMeta | null;
  onVenue: (id: string) => void;
  onBrowse: () => void;
  onNearby: () => void;
  onNavigate: (path: string) => void;
}) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  // Only venues in the current programme are offered; the list is stable before data loads.
  const venues = meta
    ? FEATURED.filter((venue) => meta.venues.some(({ id }) => id === venue.id))
    : FEATURED;
  const moving = !reduced && venues.length > 3;
  // Keyboard focus inside the strip shows every venue in place, so a focused logo is never
  // clipped or carried away by the animation.
  const [focused, setFocused] = useState(false);
  const animate = moving && !focused;
  const entries = (copy: boolean) =>
    venues.map((venue) => (
      <li key={venue.id}>
        <a
          class="welcome-venue"
          href={venueHref(venue.id)}
          tabIndex={copy ? -1 : undefined}
          onClick={(event) => {
            if (!plain(event)) return;
            event.preventDefault();
            onVenue(venue.id);
          }}
        >
          <VenueMark {...venue} />
          <span class="welcome-venue-name">
            {meta?.venues.find(({ id }) => id === venue.id)?.name ?? venue.name}
            <span class="sr-only">: see its programme</span>
          </span>
        </a>
      </li>
    ));
  return (
    <article
      class="prose cinema-welcome cinema-welcome-logos welcome-page"
      aria-labelledby="welcome-title"
    >
      <div class="cinema-welcome-heading">
        <p class="prose-eyebrow">London Ciné Info</p>
        <h2 id="welcome-title" tabIndex={-1}>
          London’s cinemas. <span class="welcome-line">One programme.</span>
        </h2>
        <p class="prose-lede">
          Find what’s showing across London, catch films from your watchlist, and choose what to see
          together.
        </p>
        <div class="welcome-actions">
          <a
            class="booking-action"
            href="/"
            onClick={(event) => {
              if (!plain(event)) return;
              event.preventDefault();
              onBrowse();
            }}
          >
            Browse all films
          </a>
          <button class="welcome-secondary" aria-haspopup="dialog" onClick={onNearby}>
            Find cinemas near me
          </button>
        </div>
        {meta && (
          <p class="prose-small welcome-counts">
            {meta.counts.films.toLocaleString("en-GB")} films and{" "}
            {meta.counts.screenings.toLocaleString("en-GB")} screenings at {meta.counts.venues}{" "}
            venues.
          </p>
        )}
      </div>
      <div class="cinema-logo-heading welcome-strip-heading">
        <p class="prose-eyebrow" id="welcome-venues">
          Start with a cinema
        </p>
        {moving && (
          <button class="welcome-motion" onClick={() => setPaused(!paused)}>
            {paused ? "Play logos" : "Pause logos"}
          </button>
        )}
      </div>
      <div
        class={`welcome-strip ${animate ? "is-moving" : "is-static"} ${paused ? "is-paused" : ""}`}
        onFocusIn={() => setFocused(true)}
        onFocusOut={(event) => {
          const next = event.relatedTarget as Node | null;
          if (!next || !event.currentTarget.contains(next)) setFocused(false);
        }}
      >
        <div class="welcome-track">
          <ul class="welcome-set" aria-labelledby="welcome-venues">
            {entries(false)}
          </ul>
          {animate && (
            <ul class="welcome-set" aria-hidden="true">
              {entries(true)}
            </ul>
          )}
        </div>
      </div>
      <p class="prose-small welcome-disclaimer">
        London Ciné Info is independent and not affiliated with any cinema. Names and logos belong
        to their venues.
      </p>
      <div class="cinema-welcome-foot welcome-foot">
        <a
          href="/how-to-use"
          onClick={(event) => {
            if (!plain(event)) return;
            event.preventDefault();
            onNavigate("/how-to-use");
          }}
        >
          See how it works
        </a>
      </div>
    </article>
  );
}
