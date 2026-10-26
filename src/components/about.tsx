import type { DataMeta } from "../shared/data";
import { PageLink } from "./page-link";

export function About({
  meta,
  onNavigate,
  onFeedback,
  standalone = false,
}: {
  meta: DataMeta | null;
  onNavigate: (path: string) => void;
  onFeedback?: () => void;
  standalone?: boolean;
}) {
  const Heading = standalone ? "h1" : "h2";
  return (
    <article class="prose" aria-labelledby="about-title">
      <header class="prose-head">
        <Heading id="about-title">London screenings, in one table</Heading>
      </header>
      <p class="prose-lede">
        Browse cinema screenings across London, from new films to classics and special events.
        Select a film to see its programme, then follow a cinema link to book.
      </p>
      {meta && (
        <div class="prose-facts" aria-label="Programme facts">
          <div>
            <span class="prose-eyebrow">Last updated</span>
            <p>
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/London",
              }).format(new Date(meta.generatedAt))}
            </p>
            <span class="prose-small">London time</span>
          </div>
          <div>
            <span class="prose-eyebrow">Films</span>
            <p>{meta.counts.films.toLocaleString("en-GB")}</p>
            <span class="prose-small">in the programme</span>
          </div>
          <div>
            <span class="prose-eyebrow">Screenings</span>
            <p>{meta.counts.screenings.toLocaleString("en-GB")}</p>
            <span class="prose-small">at {meta.counts.venues} venues</span>
          </div>
          <div>
            <span class="prose-eyebrow">Releases</span>
            {[meta.sources.combined, meta.sources.matched].map((source, i) => (
              <p key={i}>
                <a
                  aria-label={`${i === 0 ? "Screening" : "Ratings"} release ${source.tag}`}
                  href={`https://github.com/${source.repository}/releases/tag/${encodeURIComponent(source.tag)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.tag}
                </a>
              </p>
            ))}
          </div>
        </div>
      )}
      <section class="prose-section" aria-labelledby="about-sources">
        <h2 id="about-sources">Where the data comes from</h2>
        <dl>
          <dt>Screenings and film metadata</dt>
          <dd>
            <a href="https://clusterflick.com" target="_blank" rel="noopener noreferrer">
              Clusterflick
            </a>
            . The combined and matched Clusterflick release artifacts do not carry an explicit
            licence. Clusterflick's per-venue transformed data is available separately under CC BY
            4.0.
          </dd>
          <dt>Ratings</dt>
          <dd>Ratings are linked to Letterboxd, IMDb, Metacritic and Rotten Tomatoes.</dd>
          <dt>Posters and imagery</dt>
          <dd>
            Film imagery comes from TMDB. This product uses the TMDB API but is not endorsed or
            certified by TMDB.
            <a
              class="prose-logo"
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="/tmdb-logo.svg" width="120" height="16" alt="The Movie Database (TMDB)" />
            </a>
          </dd>
          <dt>Borough boundaries</dt>
          <dd>
            Contains Ordnance Survey data © Crown copyright and database right 2018. Borough
            boundaries from{" "}
            <a
              href="https://data.london.gov.uk/dataset/london-boroughs-e55pw"
              target="_blank"
              rel="noopener noreferrer"
            >
              London Datastore
            </a>
            , licensed under the{" "}
            <a
              href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Government Licence v3.0
            </a>
            .
          </dd>
        </dl>
      </section>
      <section class="prose-section" aria-labelledby="about-caveats">
        <h2 id="about-caveats">Before you rely on it</h2>
        <ul>
          <li>Release dates are TMDB's original dates and may differ from UK cinema releases.</li>
          <li>
            Ratings are provided by their respective sources and may be missing or out of date.
          </li>
          <li>Confirm screening availability and access arrangements with the cinema.</li>
          <li>Booking happens on the cinema's site.</li>
        </ul>
      </section>
      <section class="prose-section" aria-labelledby="about-device">
        <h2 id="about-device">What stays on your device</h2>
        <ul>
          <li>Favourite cinemas are saved in your browser, or in your account while signed in.</li>
          <li>Accounts use a necessary session cookie.</li>
          <li>
            Your browser remembers whether you view films as a list or as posters, which Radar
            sections you collapsed and that you have left the welcome page.
          </li>
          <li>Theme choices last for this visit.</li>
          <li>Opening a poster or following an external link contacts that provider.</li>
        </ul>
        <div class="prose-links">
          <PageLink href="/how-to-use" onNavigate={onNavigate}>
            How to use
          </PageLink>
          <span aria-hidden="true">·</span>
          <PageLink href="/welcome" onNavigate={onNavigate}>
            Welcome page
          </PageLink>
          <span aria-hidden="true">·</span>
          <PageLink href="/privacy" onNavigate={onNavigate}>
            Privacy policy
          </PageLink>
          <span aria-hidden="true">·</span>
          <PageLink href="/changelog" onNavigate={onNavigate}>
            What's new
          </PageLink>
          {onFeedback && (
            <>
              <span aria-hidden="true">·</span>
              <button class="feedback-link" onClick={onFeedback}>
                Share feedback
              </button>
            </>
          )}
        </div>
      </section>
      <p class="prose-small prose-closing">
        London Ciné Info is independent and not affiliated with any cinema, Letterboxd, IMDb or
        YouTube. Names and logos belong to their owners. A personal, non-commercial project by Diogo
        Diogo. A London take on <a href="https://paris-cine.info">paris-cine.info</a>.
      </p>
    </article>
  );
}
