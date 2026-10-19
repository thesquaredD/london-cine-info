import "../styles/discovery-designs.css";
import { NearbyStudy } from "./nearby-study";
import { CinemaWelcome } from "./cinema-welcome";
import { useEffect, useState } from "preact/hooks";
import type { Film, DataMeta } from "../shared/data";
import { FilmTable } from "./film-table";
import { ExpandedRow } from "./expanded-row";
import { Dialog } from "./dialog";
import { DEFAULT_DISPLAY } from "../lib/display";
import { readView, sortFilms, type ViewState } from "../lib/catalogue";

type Topic = "welcome" | "guide" | "cinemas" | "posters";
const topics: [Topic, string][] = [
  ["welcome", "01 · First visit"],
  ["guide", "02 · How to use"],
  ["cinemas", "03 · Nearby cinemas"],
  ["posters", "04 · Poster view"],
];
const notes: Record<Topic, [string, string, string]> = {
  welcome: [
    "Lead with the places that make London cinema distinctive",
    "A · A slow strip of cinema logos shows the breadth of venues without taking over the page. Pauses on hover or keyboard focus, has a pause button and respects reduced motion.",
    "B · The same venue logos in a static grid. Calmer, with every venue visible at once; takes a little more vertical space.",
  ],
  guide: [
    "Teach through a small example",
    "A · A short interactive guide demonstrates the result before asking for setup. More engaging, but examples need maintaining as features change.",
    "B · A compact reference is faster to scan and easier to maintain. Less memorable. Recommendation: the interactive guide, with the same explanations beside the real controls.",
  ],
  cinemas: [
    "Location, range, optional exclusions, done",
    "Enter a postcode or use your location, choose a range, then optionally uncheck cinemas. All matches are selected by default in one scrolling list. Status and results have reserved space so feedback does not move the controls.",
    "The same chooser is used throughout. No batches of five, separate selection mode or extra confirmation step.",
  ],
  posters: [
    "A clean poster wall, with details when needed",
    "A · Artwork only. Hover or keyboard focus reveals the title, year, runtime, rating and screening count inside the poster. Click or tap opens the full details and screenings. Compact and calm, but unfamiliar artwork is harder to identify.",
    "B · The same posters with a single title line beneath. Easier to identify unfamiliar films, at the cost of a little more text and height. Both keep the List switch for comparing films.",
  ],
};
function Poster({ film }: { film: Film }) {
  const [failed, setFailed] = useState(false);
  return (
    <div class="study-poster">
      {film.po && !failed ? (
        <img src={film.po} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div class="study-poster-fallback">
          <span>LONDON CINÉ INFO</span>
          <strong>{film.ti}</strong>
          <span>Poster unavailable</span>
        </div>
      )}
    </div>
  );
}
export function DiscoveryDesigns({
  films,
  meta,
  onExit,
}: {
  films: Film[];
  meta: DataMeta;
  onExit: () => void;
}) {
  const initial = new URLSearchParams(location.search).get("design");
  const [topic, setTopic] = useState<Topic>(
    topics.some(([id]) => id === initial) ? (initial as Topic) : "welcome",
  );
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [hoverStyle, setHoverStyle] = useState(
    new URLSearchParams(location.search).get("hover") === "curtain" ? "curtain" : "walnut",
  );
  useEffect(() => {
    document.documentElement.dataset.discoveryHover = hoverStyle;
    return () => {
      delete document.documentElement.dataset.discoveryHover;
    };
  }, [hoverStyle]);
  const [alternative, setAlternative] = useState("a");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [state, setState] = useState<ViewState>(() => ({
    ...readView(new URL(location.origin)),
    sort: "title",
    direction: "asc",
  }));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [guide, setGuide] = useState(0);
  const [mode, setMode] = useState("both");
  const [mine, setMine] = useState(false);
  const [venuePreview, setVenuePreview] = useState<string | null>(null);
  const sampleNow = new Date(meta.generatedAt);
  const chosen = [
    "In the Mood for Love",
    "Perfect Days",
    "Aftersun",
    "The Grand Budapest Hotel",
    "Paris, Texas",
    "The Substance",
  ]
    .map((t) => films.find((f) => f.ti.toLowerCase() === t.toLowerCase()))
    .filter((f): f is Film => !!f);
  const sample = [...chosen, ...films.filter((f) => f.po && !chosen.includes(f))].slice(0, 24);
  const visible = sortFilms(
    sample.filter((f) =>
      `${f.ti} ${f.di.map((d) => d.name).join(" ")}`
        .toLowerCase()
        .includes(state.search.toLowerCase()),
    ),
    state.sort,
    state.direction,
  );
  const activeFilm = sample.find((f) => f.id === expanded);
  function go(next: Topic) {
    setTopic(next);
    setAlternative("a");
    setExpanded(null);
    const url = new URL(location.href);
    url.searchParams.set("design", next);
    history.replaceState(null, "", url);
  }
  function change(changes: Partial<ViewState>) {
    setState((s) => ({ ...s, ...changes }));
  }
  const listing = (
    <FilmTable
      films={visible}
      meta={meta}
      state={state}
      now={sampleNow}
      display={DEFAULT_DISPLAY}
      expanded={expanded}
      onExpand={setExpanded}
      onChange={change}
    />
  );
  return (
    <section class="discovery-study">
      <div class="study-review-bar">
        <span>DESIGN REVIEW · not released</span>
        <label class="study-hover-choice">
          Hover{" "}
          <select
            aria-label="Hover treatment"
            value={hoverStyle}
            onChange={(e) => setHoverStyle(e.currentTarget.value)}
          >
            <option value="walnut">Walnut</option>
            <option value="curtain">Curtain red</option>
          </select>
        </label>
        <button onClick={onExit}>Current app</button>
      </div>
      <nav class="study-tabs" aria-label="Design studies">
        {topics.map(([id, label]) => (
          <button
            aria-pressed={topic === id}
            onClick={() => {
              setVenuePreview(null);
              go(id);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div class="study-review-trigger">
        <button onClick={() => setRationaleOpen(true)}>Design rationale & alternatives</button>
      </div>
      <Dialog
        open={rationaleOpen}
        title="Design rationale & alternatives"
        onClose={() => setRationaleOpen(false)}
        className="modal-dialog study-rationale-dialog"
      >
        <div class="prose study-review">
          <h2>{notes[topic][0]}</h2>
          {topic !== "cinemas" && (
            <div class="study-variants">
              <button
                aria-pressed={alternative === "a"}
                onClick={() => {
                  setAlternative("a");
                  if (topic === "posters") setView("grid");
                }}
              >
                A ·{" "}
                {topic === "welcome"
                  ? "Scrolling logos"
                  : topic === "guide"
                    ? "Try it"
                    : "Artwork only"}
              </button>
              <button
                aria-pressed={alternative === "b"}
                onClick={() => {
                  setAlternative("b");
                  if (topic === "posters") setView("grid");
                }}
              >
                B ·{" "}
                {topic === "welcome"
                  ? "Static logos"
                  : topic === "guide"
                    ? "Quick reference"
                    : "With titles"}
              </button>
            </div>
          )}
          <p class="prose-small">
            {notes[topic][topic === "cinemas" || alternative === "a" ? 1 : 2]}
          </p>
        </div>
      </Dialog>
      <div class="study-canvas">
        {topic === "welcome" && (
          <CinemaWelcome
            quiet={alternative === "b"}
            onVenue={(id) => {
              setVenuePreview(id);
              go("cinemas");
            }}
            onBrowse={() => go("posters")}
            onNear={() => {
              setVenuePreview(null);
              go("cinemas");
            }}
            onGuide={() => go("guide")}
          />
        )}
        {topic === "guide" && (
          <article class="prose study-guide">
            <p class="prose-eyebrow">How to use London Ciné Info</p>
            <h2>Less scrolling. More cinema.</h2>
            <p class="prose-lede">
              A few ways to turn London’s listings into a plan. Use whichever helps.
            </p>
            <div class="study-guide-tabs" role="group" aria-label="Guide topics">
              {["Find a screening", "Your watchlist", "Watch together", "My cinemas"].map(
                (label, i) => (
                  <button aria-pressed={guide === i} onClick={() => setGuide(i)}>
                    <span>0{i + 1}</span>
                    {label}
                  </button>
                ),
              )}
            </div>
            {alternative === "b" ? (
              <section class="prose-section">
                <dl>
                  <dt>Find a screening</dt>
                  <dd>
                    Pick a day and cinema. Open a film for showtimes, then book on the cinema’s
                    website.
                  </dd>
                  <dt>Your watchlist</dt>
                  <dd>
                    Sign in, connect your public Letterboxd username in Account, then open
                    Watchlist. Only films with listed screenings appear.
                  </dd>
                  <dt>Watch together</dt>
                  <dd>
                    In Friends, enter two public Letterboxd usernames. “Both” finds common films;
                    “Either” gives you more possibilities. Neither list is edited.
                  </dd>
                  <dt>My cinemas</dt>
                  <dd>
                    Choose favourite venues, then select My cinemas to filter results. Nearby is a
                    temporary search around a location.
                  </dd>
                </dl>
                <button onClick={() => setAlternative("a")}>Try the examples</button>
              </section>
            ) : (
              <section class="prose-section study-guide-example">
                <div>
                  <p class="prose-eyebrow">
                    {
                      [
                        "From film to seat",
                        "The list you already keep",
                        "Two lists. One evening.",
                        "The places you like",
                      ][guide]
                    }
                  </p>
                  <h3>
                    {
                      [
                        "Open a film. Find a time.",
                        "Find your watchlist on the big screen.",
                        "Find something you both want to see.",
                        "Save the cinemas worth the trip.",
                      ][guide]
                    }
                  </h3>
                  <ol>
                    {[
                      [
                        "Browse films and narrow by day or cinema.",
                        "Open a film to see matching screenings.",
                        "Follow the cinema link to book your ticket.",
                      ],
                      [
                        "Sign in, then open Account and add your public Letterboxd username.",
                        "Wait for the import to finish. You’ll see whether it’s reading, ready or needs another try.",
                        "Open Watchlist to see saved films with London screenings.",
                      ],
                      [
                        "Open Friends and enter two public Letterboxd usernames.",
                        "Choose films on both lists, or on either list for more options.",
                        "Add a day and cinema to find a screening that works.",
                      ],
                      [
                        "Choose favourite cinemas by name, borough or location.",
                        "Select My cinemas to see screenings at those venues.",
                        "Use Edit cinemas while My cinemas is selected to change your choices.",
                      ],
                    ][guide]!.map((t) => (
                      <li>{t}</li>
                    ))}
                  </ol>
                  <p class="prose-small">
                    {
                      [
                        "Saving a screening to your calendar does not book a ticket.",
                        "Keep editing your watchlist on Letterboxd. Imports can be empty, stale or have no currently listed matches.",
                        "This compares existing watchlists; it does not create a shared editable list.",
                        "Guest favourites stay in this browser. Sign in to sync them across devices.",
                      ][guide]
                    }
                  </p>
                </div>
                <div class="study-demo">
                  <p class="prose-eyebrow">Try it · example only</p>
                  {guide === 2 ? (
                    <>
                      <div class="study-list-person">
                        <span>YOUR LIST</span>
                        <p>Perfect Days · Aftersun</p>
                      </div>
                      <div class="study-list-person">
                        <span>THEIR LIST</span>
                        <p>Perfect Days · Paris, Texas</p>
                      </div>
                      <div class="study-variants">
                        <button aria-pressed={mode === "both"} onClick={() => setMode("both")}>
                          On both lists
                        </button>
                        <button aria-pressed={mode === "either"} onClick={() => setMode("either")}>
                          On either list
                        </button>
                      </div>
                      <div class="study-demo-result" role="status">
                        <strong>{mode === "both" ? "1 film in common" : "3 possibilities"}</strong>
                        <p>
                          {mode === "both"
                            ? "Perfect Days"
                            : "Perfect Days · Aftersun · Paris, Texas"}
                        </p>
                      </div>
                    </>
                  ) : guide === 3 ? (
                    <>
                      <div class="study-variants">
                        <button aria-pressed={!mine} onClick={() => setMine(false)}>
                          All cinemas
                        </button>
                        <button aria-pressed={mine} onClick={() => setMine(true)}>
                          My cinemas
                        </button>
                      </div>
                      <p>
                        {mine
                          ? "Showing screenings at your saved cinemas."
                          : "Showing screenings across London."}
                      </p>
                      {mine && <button onClick={() => go("cinemas")}>Edit cinemas</button>}
                    </>
                  ) : (
                    <>
                      <Poster film={sample[guide]!} />
                      <strong>{sample[guide]!.ti}</strong>
                      <p>
                        {guide === 1
                          ? "Films from your watchlist appear here when they have a listed screening."
                          : "Select a film to reveal dates, venues and booking links."}
                      </p>
                      <button
                        onClick={() => {
                          go("posters");
                          setExpanded(sample[guide]!.id);
                        }}
                      >
                        Open example film
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}
            <footer class="prose-footer">
              <p class="prose-small">No quiz. No compulsory tour.</p>
              <button class="booking-action" onClick={() => go("posters")}>
                Explore screenings
              </button>
            </footer>
          </article>
        )}
        {topic === "cinemas" && (
          <NearbyStudy
            key={`${alternative}-${venuePreview}`}
            meta={meta}
            films={films}
            startVenue={venuePreview}
          />
        )}
        {topic === "posters" && (
          <>
            <div class="study-poster-heading prose">
              <p class="prose-eyebrow">All movies</p>
              <h2>What catches your eye?</h2>
              <p class="prose-small">
                24 films from the cached catalogue ·{" "}
                {new Date(meta.generatedAt).toLocaleDateString("en-GB")} · design sample, not
                current availability
              </p>
            </div>
            <div class="study-mini-toolbar">
              <input
                aria-label="Search example films"
                placeholder="Search films or directors"
                value={state.search}
                onInput={(e) => change({ search: e.currentTarget.value })}
              />
              <label>
                Sort{" "}
                <select
                  value={state.sort}
                  onChange={(e) =>
                    change({ sort: e.currentTarget.value as ViewState["sort"], direction: "asc" })
                  }
                >
                  <option value="title">Title</option>
                  <option value="year">Year</option>
                  <option value="director">Director</option>
                </select>
              </label>
              <div class="study-variants" role="group" aria-label="Film view">
                <button aria-pressed={view === "list"} onClick={() => setView("list")}>
                  <svg
                    class="study-view-icon"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M1 3h14M1 8h14M1 13h14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                  </svg>
                  List
                </button>
                <button aria-pressed={view === "grid"} onClick={() => setView("grid")}>
                  <svg
                    class="study-view-icon"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <rect x="1" y="1" width="6" height="6" rx="0.75" />
                    <rect x="9" y="1" width="6" height="6" rx="0.75" />
                    <rect x="1" y="9" width="6" height="6" rx="0.75" />
                    <rect x="9" y="9" width="6" height="6" rx="0.75" />
                  </svg>
                  Posters
                </button>
              </div>
            </div>
            {view === "list" ? (
              listing
            ) : (
              <>
                <div class={`study-poster-grid ${alternative === "b" ? "has-titles" : ""}`}>
                  {visible.map((f) => (
                    <button
                      key={f.id}
                      class="study-film-card"
                      aria-label={`Show screenings for ${f.ti}`}
                      aria-describedby={`poster-info-${f.id}`}
                      aria-haspopup="dialog"
                      onClick={() => setExpanded(f.id)}
                    >
                      <div class="study-card-image">
                        <Poster film={f} />
                        <div class="study-poster-info" id={`poster-info-${f.id}`}>
                          <strong>{f.ti}</strong>
                          <span>
                            {f.ye}
                            {f.ru ? ` · ${f.ru} min` : ""}
                          </span>
                          <span class="study-card-rating">
                            {f.ra.lb?.value != null
                              ? `★ ${f.ra.lb.value.toFixed(1)} / 5 · Letterboxd`
                              : "Letterboxd · Not rated"}
                          </span>
                          <span class="study-card-count">
                            {f.sc.length} {f.sc.length === 1 ? "screening" : "screenings"} ·{" "}
                            {new Set(f.sc.map((s) => s[2])).size}{" "}
                            {new Set(f.sc.map((s) => s[2])).size === 1 ? "cinema" : "cinemas"}
                          </span>
                        </div>
                      </div>
                      {alternative === "b" && (
                        <span class="study-poster-caption" title={f.ti}>
                          {f.ti}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {!visible.length && (
                  <div class="empty-state">
                    <h3>No films match this search.</h3>
                    <button onClick={() => change({ search: "" })}>Clear search</button>
                  </div>
                )}
                <Dialog
                  open={!!activeFilm}
                  title={activeFilm?.ti ?? "Film screenings"}
                  className="study-film-dialog modal-dialog"
                  onClose={() => setExpanded(null)}
                >
                  {activeFilm && (
                    <table class="film-table">
                      <tbody>
                        <ExpandedRow
                          film={activeFilm}
                          meta={meta}
                          state={state}
                          detailId="study-film-detail"
                          columns={1}
                          ratingOrder={DEFAULT_DISPLAY.ratingOrder}
                          now={sampleNow}
                        />
                      </tbody>
                    </table>
                  )}
                </Dialog>
              </>
            )}
          </>
        )}
      </div>
      <div class="study-caption prose">
        <p class="prose-small">
          Local design prototype · existing London Ciné Info shell, typography, catalogue, film
          table and screening details. The guide uses examples. Location lookup uses Postcodes.io;
          cinema listings are a cached snapshot. Nothing is connected or saved to an account.
        </p>
      </div>
    </section>
  );
}
