import type { DataMeta, Film, FilmShowtimes } from "../shared/data";
import { PUBLIC_PAGES, pageMetadata } from "../shared/seo";
import { filmPath } from "../lib/sharing";
import { readView, selectFilms, sortFilms } from "../lib/catalogue";
import { radarEntries, radarFilms } from "../lib/radar";

const londonTime = (time: string | number) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(time));

function SourceNote({ meta }: { meta: DataMeta }) {
  return (
    <footer class="prose-footer">
      <div>
        <p>
          Programme updated <time dateTime={meta.generatedAt}>{londonTime(meta.generatedAt)}</time>{" "}
          (London time).
        </p>
        <p>
          Screenings come from <a href="https://clusterflick.com">Clusterflick</a>.
        </p>
        <ul>
          <li>Listings may be incomplete.</li>
          <li>Confirm availability and access arrangements with the cinema.</li>
          <li>Booking happens on the cinema’s site.</li>
        </ul>
      </div>
      <a href="/about">About &amp; sources</a>
    </footer>
  );
}

/** The public programme is readable before JavaScript loads or when it is unavailable. */
export function DiscoveryPage({
  path,
  films,
  meta,
  film,
  showtimes,
}: {
  path: string;
  films: Film[];
  meta: DataMeta;
  film?: Film;
  showtimes?: FilmShowtimes;
}) {
  const info = pageMetadata(path, film);
  const page = PUBLIC_PAGES.find((page) => page.path === path);
  const state = readView(new URL(path, "https://london-cine.info"));
  const now = new Date(meta.generatedAt);
  const entries = path === "/radar" ? radarEntries(films, meta, now) : [];
  const selected =
    path === "/radar"
      ? [
          ...new Map(
            (["limited", "film", "imax"] as const)
              .flatMap((section) => radarFilms(entries, meta, state, section, now))
              .map((film) => [film.id, film]),
          ).values(),
        ]
      : selectFilms(films, state);
  const venues = new Map(meta.venues.map((venue) => [venue.id, venue]));
  return (
    <article class="prose" aria-labelledby="discovery-title">
      <header class="prose-head">
        <h1 id="discovery-title">
          {film
            ? `${film.ti}${film.ye ? ` (${film.ye})` : ""}`
            : info.title.replace(" — London Ciné Info", "")}
        </h1>
      </header>
      <p class="prose-lede">{info.description}</p>
      <noscript>
        <p>
          You can follow the programme links below. Enable JavaScript to use filters and account
          features.
        </p>
      </noscript>
      {film ? (
        <>
          <dl>
            {film.di.length > 0 && (
              <>
                <dt>Director</dt>
                <dd>{film.di.map(({ name }) => name).join(", ")}</dd>
              </>
            )}
            {film.ru != null && (
              <>
                <dt>Runtime</dt>
                <dd>{film.ru} minutes</dd>
              </>
            )}
            {film.rd && (
              <>
                <dt>Original release date</dt>
                <dd>{film.rd} (TMDB; may differ from the UK release)</dd>
              </>
            )}
            {film.o_ti && (
              <>
                <dt>Original title</dt>
                <dd>{film.o_ti}</dd>
              </>
            )}
          </dl>
          {showtimes?.details.overview && <p>{showtimes.details.overview}</p>}
          <section class="prose-section" aria-labelledby="discovery-screenings">
            <h2 id="discovery-screenings">London screenings</h2>
            <p>
              All dates and times are in London time. These listings reflect the programme update
              below.
            </p>
            {showtimes && Object.values(showtimes.days).some((rows) => rows.length) ? (
              <ul>
                {Object.values(showtimes.days)
                  .flat()
                  .sort((a, b) => a.time - b.time)
                  .map((row, index) => {
                    const venue = venues.get(row.venue);
                    return (
                      <li key={index}>
                        <time dateTime={new Date(row.time).toISOString()}>
                          {londonTime(row.time)}
                        </time>
                        {" · "}
                        {venue?.name ?? row.venue}
                        {venue?.address ? `, ${venue.address}` : ""}
                        {row.eventTitle ? ` · ${row.eventTitle}` : ""}
                        {row.formats.length ? ` · ${row.formats.join(", ")}` : ""}
                        {row.accessibility.length ? ` · ${row.accessibility.join(", ")}` : ""}
                        {row.soldOut ? " · Sold out" : ""}
                        {" · "}
                        <a href={row.bookingUrl} rel="noopener noreferrer">
                          {row.bookingFallback ? "Screening details" : "Book with the cinema"}
                        </a>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p>No screenings are listed for this film in this programme update.</p>
            )}
          </section>
        </>
      ) : page?.catalogue ? (
        <section class="prose-section" aria-labelledby="discovery-films">
          <h2 id="discovery-films">Films in this programme</h2>
          {selected.length ? (
            <ul>
              {sortFilms(selected, "title", "asc").map((film) => (
                <li key={film.id}>
                  <a href={filmPath(film)}>
                    {film.ti}
                    {film.ye ? ` (${film.ye})` : ""}
                  </a>
                  {film.di.length ? ` — ${film.di.map(({ name }) => name).join(", ")}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>No films are listed in this section in this programme update.</p>
          )}
        </section>
      ) : (
        <p>Enable JavaScript to use this page.</p>
      )}
      <nav class="prose-section" aria-label="Explore London cinema listings">
        <h2>Explore the programme</h2>
        <ul>
          {PUBLIC_PAGES.filter((page) => page.path !== path).map((page) => (
            <li key={page.path}>
              <a href={page.path}>{page.name}</a>
            </li>
          ))}
        </ul>
      </nav>
      <SourceNote meta={meta} />
    </article>
  );
}
