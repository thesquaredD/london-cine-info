import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Sidebar } from "./components/sidebar";
import { FilmTable } from "./components/film-table";
import { loadCatalogue } from "./lib/data";
import {
  PAGE_SIZE,
  PAGES,
  readView,
  selectFilms,
  sortFilms,
  viewUrl,
  type ViewState,
} from "./lib/catalogue";
import type { DataMeta, Film } from "./shared/data";

function About({ meta }: { meta: DataMeta | null }) {
  return (
    <article class="about-page">
      <h2>London screenings, in one table</h2>
      <p>
        Browse cinema screenings across London, from new films to classics and special events.
        Select a film to see its programme, then follow a cinema link to book.
      </p>
      <h3>Data & sources</h3>
      <p>
        Screening data and film metadata come from{" "}
        <a href="https://clusterflick.com" target="_blank" rel="noopener noreferrer">
          Clusterflick
        </a>
        , with ratings linked to Letterboxd, IMDb, Metacritic and Rotten Tomatoes. Film imagery
        comes from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
      <p>
        The combined and matched Clusterflick release artifacts do not carry an explicit licence.
        This is a personal, non-commercial project. Clusterflick's per-venue transformed data is
        available separately under CC BY 4.0.
      </p>
      <p>
        Release dates are TMDB's original dates and may differ from UK cinema releases. Ratings are
        provided by their respective sources and may be missing or out of date. Confirm screening
        availability and access arrangements with the cinema.
      </p>
      <p>
        No accounts, cookies or browser storage are used. Theme choices last for this visit. Opening
        a poster or following an external link contacts that provider.
      </p>
      {meta && (
        <dl class="source-status">
          <dt>Last updated</dt>
          <dd>
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/London",
            }).format(new Date(meta.generatedAt))}{" "}
            (London time)
          </dd>
          <dt>Programme</dt>
          <dd>
            {meta.counts.films.toLocaleString("en-GB")} films ·{" "}
            {meta.counts.screenings.toLocaleString("en-GB")} screenings · {meta.counts.venues}{" "}
            venues
          </dd>
          <dt>Screening release</dt>
          <dd>
            <a
              href={`https://github.com/${meta.sources.combined.repository}/releases/tag/${encodeURIComponent(meta.sources.combined.tag)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {meta.sources.combined.tag}
            </a>
          </dd>
          <dt>Ratings release</dt>
          <dd>
            <a
              href={`https://github.com/${meta.sources.matched.repository}/releases/tag/${encodeURIComponent(meta.sources.matched.tag)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {meta.sources.matched.tag}
            </a>
          </dd>
        </dl>
      )}
      <p class="boundary-credit">
        Contains Ordnance Survey data © Crown copyright and database right 2018. Borough boundaries
        from{" "}
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
      </p>
    </article>
  );
}

export function App() {
  const [state, setState] = useState(() => readView(new URL(window.location.href)));
  const [catalogue, setCatalogue] = useState<{ films: Film[]; meta: DataMeta } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [themeOverride, setThemeOverride] = useState<boolean | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const dark = themeOverride ?? systemDark;
  const meta = catalogue?.meta ?? null;
  const pageTitle = PAGES.find((page) => page.path === state.path)?.name ?? "About";
  const selected = useMemo(
    () =>
      catalogue ? sortFilms(selectFilms(catalogue.films, state), state.sort, state.direction) : [],
    [catalogue, state],
  );
  function change(changes: Partial<ViewState>, push = false) {
    const next = { ...state, ...changes };
    const url = viewUrl(next);
    if (url !== `${window.location.pathname}${window.location.search}`) {
      if (push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    }
    setState(next);
    setExpanded(null);
    if (push) {
      setDrawerOpen(false);
      window.scrollTo({ top: 0 });
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    loadCatalogue(controller.signal)
      .then(setCatalogue)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const onPop = () => {
      setState(readView(new URL(window.location.href)));
      setExpanded(null);
      setDrawerOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const changed = () => setSystemDark(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    document.title = `${pageTitle} — London Ciné Info`;
  }, [pageTitle]);
  useEffect(() => {
    if (drawerOpen && !drawer.current?.open) drawer.current?.showModal();
    if (!drawerOpen && drawer.current?.open) drawer.current.close();
  }, [drawerOpen]);
  useEffect(() => {
    if (!catalogue) return;
    const maximum = Math.max(1, Math.ceil(selected.length / PAGE_SIZE));
    if (state.page > maximum) {
      const next = { ...state, page: maximum };
      setState(next);
      window.history.replaceState(null, "", viewUrl(next));
    }
  }, [catalogue, selected.length, state]);
  const sidebarProps = {
    state,
    meta,
    onChange: change,
    dark,
    onTheme: () => setThemeOverride(!dark),
  };
  return (
    <div class={`app-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a class="skip-link" href="#main-content">
        Skip to films
      </a>
      <aside class="desktop-sidebar" aria-label="Navigation and filters">
        <Sidebar {...sidebarProps} />
      </aside>
      <dialog
        ref={drawer}
        class="sidebar-drawer"
        aria-label="Navigation and filters"
        onClose={() => setDrawerOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setDrawerOpen(false);
          }
        }}
        onClick={(event) => {
          if (event.target === drawer.current) setDrawerOpen(false);
        }}
      >
        <button class="drawer-close" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
          ×
        </button>
        <Sidebar {...sidebarProps} idPrefix="drawer" />
      </dialog>
      <main class="main-column" id="main-content">
        <header class="masthead">
          <button
            class="menu-button"
            aria-label="Toggle navigation and filters"
            aria-expanded={
              window.matchMedia("(max-width: 799px)").matches ? drawerOpen : !collapsed
            }
            onClick={() => {
              if (window.matchMedia("(max-width: 799px)").matches) setDrawerOpen(true);
              else setCollapsed(!collapsed);
            }}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <h1>
            <a
              href="/"
              onClick={(event) => {
                if (
                  event.button ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                change({ path: "/", search: "", language: "", director: "", page: 1 }, true);
              }}
            >
              <span>LONDON CINÉ</span> INFO
            </a>
          </h1>
        </header>
        <div class="tagline">The database of London cinema screenings</div>
        <h2 class="sr-only">{pageTitle}</h2>
        {state.path === "/about" ? (
          <About meta={meta} />
        ) : (
          <>
            {["/new", "/calendar"].includes(state.path) && (
              <p class="view-note">
                Release dates are TMDB originals and may differ from UK dates.
              </p>
            )}
            {state.director && (
              <div class="active-director">
                <span>
                  Director:{" "}
                  {catalogue?.films
                    .flatMap((film) => film.di)
                    .find((director) => director.id === state.director)?.name ?? state.director}
                </span>
                <button onClick={() => change({ director: "", page: 1 })}>Clear director</button>
              </div>
            )}
            {!catalogue && !error && (
              <div class="catalogue-status" role="status">
                Loading London screenings…
              </div>
            )}
            {error && (
              <div class="catalogue-status" role="alert">
                <h2>The programme could not be loaded</h2>
                <p>Please check your connection and try again.</p>
                <button onClick={() => setAttempt((value) => value + 1)}>Try again</button>
              </div>
            )}
            {catalogue && (
              <FilmTable
                films={selected}
                meta={catalogue.meta}
                state={state}
                expanded={expanded}
                onExpand={setExpanded}
                onChange={change}
              />
            )}
          </>
        )}
        <div class="source-footer">
          Screening data from{" "}
          <a href="https://clusterflick.com" target="_blank" rel="noopener noreferrer">
            Clusterflick
          </a>{" "}
          · Film imagery from{" "}
          <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">
            TMDB
          </a>
        </div>
      </main>
    </div>
  );
}
