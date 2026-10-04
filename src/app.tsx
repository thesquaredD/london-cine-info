import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useAccount } from "./lib/account";
import {
  AccountDialogs,
  AccountFeedback,
  ImportStatus,
  Privacy,
  RefreshButton,
  TokenPage,
} from "./components/account";
import { letterboxdSlug } from "./shared/account";
import { Sidebar } from "./components/sidebar";
import { FilterBar } from "./components/filter-bar";
import { FilmTable } from "./components/film-table";
import { clearFilters, filterFilms, facetCounts, FILTERS, filterLabel } from "./lib/filters";
import { loadCatalogue } from "./lib/data";
import {
  PAGE_SIZE,
  PAGES,
  readView,
  defaultSort,
  hasCustomSort,
  sortLabel,
  selectFilms,
  sortFilms,
  tableRows,
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
        Accounts use a necessary session cookie. See our <a href="/privacy">privacy page</a>. Theme
        choices last for this visit. Opening a poster or following an external link contacts that
        provider.
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
  const account = useAccount();
  const watched = useMemo(() => new Set(account.watchlist?.slugs ?? []), [account.watchlist]);
  const [state, setState] = useState(() => readView(new URL(window.location.href)));
  const [catalogue, setCatalogue] = useState<{ films: Film[]; meta: DataMeta } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [themeOverride, setThemeOverride] = useState<boolean | null>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const dark = themeOverride ?? systemDark;
  const meta = catalogue?.meta ?? null;
  const pageTitle =
    PAGES.find((page) => page.path === state.path)?.name ??
    { "/privacy": "Privacy", "/auth/verify": "Sign in", "/unsubscribe": "Unsubscribe" }[
      state.path
    ] ??
    "About";
  const watchlistMatches = useMemo(
    () =>
      catalogue?.films.filter(
        (film) => film.sc.length > 0 && watched.has(letterboxdSlug(film.ra.lb?.url) ?? ""),
      ).length ?? 0,
    [catalogue, watched],
  );
  const baseFilms = useMemo(
    () =>
      catalogue?.films.filter(
        (film) =>
          !(state.path === "/watchlist" || state.watchlist) ||
          (film.sc.length > 0 && watched.has(letterboxdSlug(film.ra.lb?.url) ?? "")),
      ) ?? [],
    [catalogue, state.path, state.watchlist, watched],
  );
  const selected = useMemo(
    () =>
      catalogue
        ? sortFilms(
            filterFilms(selectFilms(baseFilms, state), catalogue.meta, state),
            state.sort,
            state.direction,
            watched,
          )
        : [],
    [catalogue, state, baseFilms, watched],
  );
  const counts = useMemo(
    () =>
      catalogue
        ? facetCounts(selectFilms(baseFilms, { ...state, filters: {} }), catalogue.meta, state)
        : null,
    [
      catalogue,
      baseFilms,
      state.path,
      state.search,
      state.director,
      state.filters,
      state.excluded,
      state.from,
      state.to,
      state.available,
    ],
  );
  function change(changes: Partial<ViewState>, push = false) {
    const next = { ...state, ...changes };
    const url = viewUrl(next);
    if (url !== `${window.location.pathname}${window.location.search}`) {
      if (push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    }
    setState(next);
    if (push || changes.sort || (changes.page !== undefined && changes.page !== 1))
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
    const maximum = Math.max(1, Math.ceil(tableRows(selected, state).length / PAGE_SIZE));
    if (state.page > maximum) {
      const next = { ...state, page: maximum };
      setState(next);
      window.history.replaceState(null, "", viewUrl(next));
    }
  }, [catalogue, selected.length, state]);
  useEffect(() => {
    if (expanded && !tableRows(selected, state).some((row) => row.key === expanded))
      setExpanded(null);
  }, [expanded, selected, state]);
  function openAccount() {
    // The phone drawer is itself a modal dialog; close it first so dialogs never nest.
    if (drawer.current?.open) drawer.current.close();
    setDrawerOpen(false);
    setAccountOpen(true);
  }
  const phone = () => window.matchMedia("(max-width: 799px)").matches;
  const sidebarProps = {
    state,
    account,
    onAccount: openAccount,
    meta,
    onChange: change,
    dark,
    onTheme: () => setThemeOverride(!dark),
  };
  const filterProps = {
    state,
    account,
    meta,
    onChange: change,
    counts,
    resultCount: selected.length,
  };
  return (
    <div class={`app-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a class="skip-link" href="#main-content">
        Skip to films
      </a>
      <aside class="desktop-sidebar" aria-label="Pages">
        <Sidebar {...sidebarProps} />
      </aside>
      <dialog
        ref={drawer}
        class="sidebar-drawer"
        aria-label="Pages"
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
        <button class="drawer-close" aria-label="Close pages" onClick={() => setDrawerOpen(false)}>
          ×
        </button>
        <Sidebar {...sidebarProps} />
      </dialog>
      <main class="main-column" id="main-content">
        <header class="masthead">
          <button
            class="menu-button"
            aria-label="Toggle pages"
            aria-expanded={phone() ? drawerOpen : !collapsed}
            onClick={() => {
              if (phone()) setDrawerOpen(true);
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
                change({ ...clearFilters("/"), path: "/" }, true);
              }}
            >
              <span>LONDON CINÉ</span> INFO
            </a>
          </h1>
        </header>
        <div class="tagline">The database of London cinema screenings</div>
        <h2 class="sr-only">{pageTitle}</h2>
        <AccountDialogs
          account={account}
          open={accountOpen}
          matches={watchlistMatches}
          onClose={() => setAccountOpen(false)}
          onNavigate={(path) => change({ path, page: 1, director: "" }, true)}
          restoreTo={() =>
            document.querySelector<HTMLElement>(
              phone() ? ".menu-button" : ".desktop-sidebar .account-panel button",
            )
          }
        />
        {!accountOpen && (
          <div class="page-notices">
            <AccountFeedback
              account={account}
              showError={state.path === "/watchlist" || !!state.watchlist}
            />
          </div>
        )}
        {state.path === "/privacy" ? (
          <Privacy />
        ) : state.path === "/auth/verify" ? (
          <TokenPage kind="verify" onSignedIn={account.reload} />
        ) : state.path === "/unsubscribe" ? (
          <TokenPage kind="unsubscribe" onSignedIn={account.reload} />
        ) : state.path === "/about" ? (
          <About meta={meta} />
        ) : (
          <>
            {state.watchlist &&
              state.path !== "/watchlist" &&
              !account.loading &&
              !account.user && (
                <div class="view-note account-prompt">
                  <p>
                    Sign in to view your watchlist, or clear the My watchlist filter to browse all
                    films.
                  </p>
                  <button aria-haspopup="dialog" onClick={openAccount}>
                    Sign in
                  </button>
                </div>
              )}
            {state.path === "/watchlist" && (
              <div class="view-note watchlist-intro">
                <h2>Your Letterboxd watchlist</h2>
                {account.loading ? (
                  <p role="status">Checking sign-in…</p>
                ) : !account.user ? (
                  <>
                    <p>Sign in to import your public Letterboxd watchlist.</p>
                    <button aria-haspopup="dialog" onClick={openAccount}>
                      Sign in
                    </button>
                  </>
                ) : !account.user.username ? (
                  <>
                    <p>Set your Letterboxd username to import your public watchlist.</p>
                    <button aria-haspopup="dialog" onClick={openAccount}>
                      Open account
                    </button>
                  </>
                ) : (
                  <>
                    <ImportStatus account={account} matches={watchlistMatches} />
                    <div class="account-actions">
                      <RefreshButton account={account} />
                      <button aria-haspopup="dialog" onClick={openAccount}>
                        Account
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {state.path === "/retrospectives" && (
              <p class="view-note">
                Directors with at least three films in the programme. Sorts apply within each
                director’s group.
              </p>
            )}
            {["/new", "/calendar"].includes(state.path) && (
              <p class="view-note">
                Release dates are TMDB originals and may differ from UK dates.
              </p>
            )}
            {catalogue && <FilterBar {...filterProps} />}
            {catalogue && (
              <div class="filter-summary">
                <div class="quick-days" role="group" aria-label="Quick day filters">
                  {[
                    { id: "today", label: "Today" },
                    { id: "tomorrow", label: "Tomorrow" },
                  ].map(({ id, label }) => {
                    const active =
                      state.filters.day?.length === 1 &&
                      state.filters.day[0] === id &&
                      !state.excluded.day?.length;
                    return (
                      <button
                        key={id}
                        aria-pressed={active}
                        onClick={() =>
                          change({
                            filters: { ...state.filters, day: active ? [] : [id] },
                            excluded: { ...state.excluded, day: [] },
                            page: 1,
                          })
                        }
                      >
                        {label} <small>{counts?.day.get(id) ?? 0}</small>
                      </button>
                    );
                  })}
                </div>
                <p role="status" aria-live="polite">
                  <strong>
                    {selected.length.toLocaleString("en-GB")}{" "}
                    {selected.length === 1 ? "film" : "films"}
                  </strong>{" "}
                  matching your choices
                </p>
                <div class="active-filters" role="group" aria-label="Active filters">
                  <button
                    disabled={
                      !(
                        hasCustomSort(state) ||
                        state.search ||
                        state.director ||
                        state.from ||
                        state.to ||
                        state.available ||
                        state.watchlist ||
                        FILTERS.some(
                          ({ key }) => state.filters[key]?.length || state.excluded[key]?.length,
                        )
                      )
                    }
                    onClick={() => change(clearFilters(state.path))}
                  >
                    Clear all
                  </button>

                  {hasCustomSort(state) && (
                    <button
                      onClick={() => change({ ...defaultSort(state.path), page: 1 })}
                      aria-label="Clear sort"
                    >
                      Sort: {sortLabel(state.sort)} ×
                    </button>
                  )}
                  {state.director && (
                    <button
                      onClick={() => change({ director: "", page: 1 })}
                      aria-label="Clear director"
                    >
                      Director:{" "}
                      {catalogue.films
                        .flatMap((film) => film.di)
                        .find((director) => director.id === state.director)?.name ??
                        state.director}{" "}
                      ×
                    </button>
                  )}
                  {state.search && (
                    <button
                      onClick={() => change({ search: "", page: 1 })}
                      aria-label="Remove search filter"
                    >
                      Search: {state.search} ×
                    </button>
                  )}
                  {FILTERS.flatMap(({ key, label }) =>
                    (state.filters[key] ?? []).map((id) => (
                      <button
                        key={`${key}-${id}`}
                        aria-label={`Remove ${label.toLowerCase()} filter: ${filterLabel(key, id, catalogue.meta)}`}
                        onClick={() =>
                          change({
                            filters: {
                              ...state.filters,
                              [key]: state.filters[key]?.filter((value) => value !== id),
                            },
                            page: 1,
                          })
                        }
                      >
                        {filterLabel(key, id, catalogue.meta)} ×
                      </button>
                    )),
                  )}
                  {(state.from || state.to) && (
                    <button onClick={() => change({ from: "", to: "", page: 1 })}>
                      Starts {state.from || "00:00"}–{state.to || "23:59"} ×
                    </button>
                  )}
                  {FILTERS.flatMap(({ key, label }) =>
                    (state.excluded[key] ?? []).map((id) => (
                      <button
                        class="excluded-chip"
                        key={`not-${key}-${id}`}
                        aria-label={`Remove excluded ${label.toLowerCase()} filter: ${filterLabel(key, id, catalogue.meta)}`}
                        onClick={() =>
                          change({
                            excluded: {
                              ...state.excluded,
                              [key]: state.excluded[key]?.filter((value) => value !== id),
                            },
                            page: 1,
                          })
                        }
                      >
                        NOT {filterLabel(key, id, catalogue.meta)} ×
                      </button>
                    )),
                  )}
                  {state.watchlist && (
                    <button onClick={() => change({ watchlist: false, page: 1 })}>
                      My watchlist ×
                    </button>
                  )}
                  {state.available && (
                    <button onClick={() => change({ available: false, page: 1 })}>
                      Not sold out ×
                    </button>
                  )}
                </div>
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
                watched={account.user ? watched : undefined}
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
