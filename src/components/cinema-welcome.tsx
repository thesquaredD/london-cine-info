import { useState } from "preact/hooks";
import { Dialog } from "./dialog";
const venues = [
  {
    id: "princecharlescinema.com",
    name: "Prince Charles",
    image: "https://princecharlescinema.com/wp-content/uploads/2025/02/PCCLogo_Black.svg",
    source: "https://princecharlescinema.com",
  },
  {
    id: "bfi.org.uk-southbank",
    name: "BFI Southbank",
    image: "https://www.bfi.org.uk/dist/client/e51a86bb7ce82a9e9741.svg",
    source: "https://www.bfi.org.uk",
  },
  {
    id: "closeupfilmcentre.com",
    name: "Close-Up",
    image: null,
    source: "https://www.closeupfilmcentre.com",
  },
  {
    id: "riocinema.org.uk",
    name: "Rio",
    image: "https://riocinema.org.uk/Rio/img/logo-white-2.png",
    source: "https://riocinema.org.uk",
  },
  {
    id: "genesiscinema.co.uk",
    name: "Genesis",
    image: "https://www.genesiscinema.co.uk/assets/images/logo_large.png",
    source: "https://www.genesiscinema.co.uk",
  },
  {
    id: "picturehouses.com-central",
    name: "Picturehouse Central",
    image: "https://s3picturehouses.s3.eu-central-1.amazonaws.com/settings/ph1563896910.png",
    source: "https://www.picturehouses.com",
  },
  {
    id: "everymancinema.com-screen-on-the-green",
    name: "Everyman Screen on the Green",
    image:
      "https://cms-assets.webediamovies.pro/cdn-cgi/image/dpr=1,fit=crop,gravity=auto,metadata=none,quality=85,width=379,height=46/production/279/fda91d18e4256797bd75c64c34a5547a.png",
    source: "https://www.everymancinema.com",
  },
  {
    id: "barbican.org.uk",
    name: "Barbican",
    image: "https://www.barbican.org.uk/themes/barb_three/logo.svg",
    source: "https://www.barbican.org.uk",
  },
];
function VenueMark({ v }: { v: (typeof venues)[number] }) {
  const [failed, setFailed] = useState(false);
  return v.image && !failed ? (
    <img
      class={v.id === "riocinema.org.uk" ? "cinema-logo-original" : undefined}
      src={v.image}
      alt={v.name}
      onError={() => setFailed(true)}
    />
  ) : (
    <span class="cinema-wordmark">{v.name}</span>
  );
}
export function CinemaWelcome({
  quiet,
  onVenue,
  onBrowse,
  onNear,
  onGuide,
}: {
  quiet: boolean;
  onVenue: (id: string) => void;
  onBrowse: () => void;
  onNear: () => void;
  onGuide: () => void;
}) {
  const [credits, setCredits] = useState(false);
  const [paused, setPaused] = useState(false);
  return (
    <article class="prose cinema-welcome cinema-welcome-logos">
      <div class="cinema-welcome-heading">
        <p class="prose-eyebrow">London Ciné Info</p>
        <h2>
          London’s cinemas.
          <br />
          One programme.
        </h2>
        <p class="prose-lede">
          Find what’s showing across London, catch films from your watchlist, and choose what to see
          together.
        </p>
        <div class="study-actions">
          <button class="booking-action" onClick={onBrowse}>
            Browse all films
          </button>
          <button class="nearby-link" onClick={onNear}>
            Find cinemas near me
          </button>
        </div>
      </div>
      <div class="cinema-logo-heading">
        <p class="prose-eyebrow">From neighbourhood favourites to the big screens</p>
        {!quiet && (
          <button
            class="nearby-link cinema-motion-control"
            onClick={() => setPaused(!paused)}
            aria-pressed={paused}
          >
            {paused ? "Play logos" : "Pause logos"}
          </button>
        )}
      </div>
      <div class={`cinema-logo-window ${quiet ? "is-static" : ""} ${paused ? "is-paused" : ""}`}>
        <div class="cinema-logo-track">
          {[0, ...(!quiet ? [1] : [])].map((copy) => (
            <div class="cinema-logo-set" aria-hidden={copy === 1 ? true : undefined}>
              {venues.map((v) => (
                <button
                  class="cinema-logo"
                  aria-label={`View films at ${v.name}`}
                  title={v.name}
                  tabIndex={copy === 1 ? -1 : 0}
                  onClick={() => onVenue(v.id)}
                >
                  <VenueMark v={v} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div class="cinema-welcome-foot">
        <p class="prose-small">Discover programmes across London’s cinemas and screening venues.</p>
        <button class="nearby-link" onClick={onGuide}>
          See how it works
        </button>
      </div>
      <button class="cinema-photo-credits nearby-link" onClick={() => setCredits(true)}>
        Logo sources
      </button>
      <Dialog open={credits} title="Logo sources" onClose={() => setCredits(false)}>
        <p>
          Venue marks from their official websites. Close-Up uses a text wordmark placeholder in
          this study.
        </p>
        <ul>
          {venues.map((v) => (
            <li>
              <a href={v.source} target="_blank" rel="noreferrer">
                {v.name}
              </a>
            </li>
          ))}
        </ul>
      </Dialog>
    </article>
  );
}
