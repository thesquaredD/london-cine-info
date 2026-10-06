import { FriendsContext, prototypeEnabled, useFriendsPrototype } from "./lib/friends-prototype";
import {
  FriendsDialogs,
  WatchlistsButton,
  WatchlistSelections,
} from "./components/friends-prototype";
import { Dialog } from "./components/dialog";
import { DisplayControls } from "./components/display-controls";
import { useCalendar } from "./lib/calendar";
import { MyCalendar, ScreeningCalendarDialog } from "./components/screening-calendar";
import type { CalendarInput } from "./shared/calendar";
import { useCinemas } from "./lib/cinemas";
import { QuickFilters } from "./components/quick-filters";
import { MyCinemas } from "./components/my-cinemas";
import { Events, EventTypeFilter } from "./components/events";
import { matchingEvents, eventFacetCounts } from "./lib/events";
import { EVENT_TYPES } from "./data/event-rules";
import { Radar } from "./components/radar";
import { recoverySuggestions } from "./lib/recovery";
import { DEFAULT_DISPLAY, type DisplayState } from "./lib/display";
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
import {
  clearFilters,
  filterFilms,
  facetCounts,
  FILTERS,
  filterLabel,
  dateShortcut,
  eveningShortcut,
  isEvening,
} from "./lib/filters";
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
import type { DataMeta, Film, EventOccurrence } from "./shared/data";

function About({ meta }: { meta: DataMeta | null }) {
  return (
    <article class="about-page">
      <h2>London screenings, in one table</h2>
      <p>
        Browse cinema screenings across London, from new films to classics and special events.
        Select a film to see its programme, then follow a cinema link to book.
      </p>
      <h3>Data & sources</h3>
      <a
        class="tmdb-attribution"
        href="https://www.themoviedb.org"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src="/tmdb-logo.svg" width="120" height="16" alt="The Movie Database (TMDB)" />
      </a>
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
        Favourite cinemas are saved in your browser, or in your account while signed in. Accounts
        use a necessary session cookie. See our <a href="/privacy">privacy page</a>. Theme choices
        last for this visit. Opening a poster or following an external link contacts that provider.
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
  const calendar = useCalendar(account);
  const [calendarEvent, setCalendarEvent] = useState<CalendarInput | null>(null);
  const cinemas = useCinemas(account);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [cinemasOpen, setCinemasOpen] = useState(false);
  const [myCinemasActive, setMyCinemasActive] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const watched = useMemo(() => new Set(account.watchlist?.slugs ?? []), [account.watchlist]);
  const [state, setState] = useState(() => readView(new URL(window.location.href)));
  const [catalogue, setCatalogue] = useState<{
    films: Film[];
    meta: DataMeta;
    events: EventOccurrence[];
  } | null>(null);
  const friends = useFriendsPrototype(
    catalogue?.films ?? [],
    state.path === "/watchlist",
    () => setState((s) => ({ ...s, page: 1 })),
    !!state.watchlist,
    (selected) => change({ watchlist: selected, page: 1 }),
  );
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [display, setDisplay] = useState<DisplayState>(() => ({
    ...DEFAULT_DISPLAY,
    ratingOrder: [...DEFAULT_DISPLAY.ratingOrder],
  }));
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
  const hasActiveChoices = Boolean(
    (prototypeEnabled && friends.value.selected.length) ||
    state.filmGauge ||
    state.eventType ||
    hasCustomSort(state) ||
    state.search ||
    state.director ||
    state.from ||
    state.to ||
    state.available ||
    state.watchlist ||
    state.short ||
    state.tonight ||
    FILTERS.some(({ key }) => state.filters[key]?.length || state.excluded[key]?.length),
  );
  const watchlistMatches = useMemo(
    () =>
      catalogue?.films.filter(
        (film) => film.sc.length > 0 && watched.has(letterboxdSlug(film.ra.lb?.url) ?? ""),
      ).length ?? 0,
    [catalogue, watched],
  );
  const myCinemasUnavailable = myCinemasActive && (!!cinemas.error || !cinemas.venues.length);
  const returnToAccount = useRef(false);
  const baseFilms = useMemo(
    () =>
      (myCinemasUnavailable ? [] : (catalogue?.films ?? [])).filter((film) =>
        prototypeEnabled
          ? friends.matches(film)
          : !(state.path === "/watchlist" || state.watchlist) ||
            (film.sc.length > 0 && watched.has(letterboxdSlug(film.ra.lb?.url) ?? "")),
      ) ?? [],
    [catalogue, state.path, state.watchlist, watched, myCinemasUnavailable, friends.value],
  );
  const selected = useMemo(
    () =>
      catalogue
        ? sortFilms(
            filterFilms(selectFilms(baseFilms, state), catalogue.meta, state, now),
            state.sort,
            state.direction,
            watched,
            display.titleMode,
          )
        : [],
    [catalogue, state, baseFilms, watched, display.titleMode, now],
  );
  const events = useMemo(
    () =>
      catalogue && state.path === "/events"
        ? matchingEvents(catalogue.events, baseFilms, catalogue.meta, state, now)
        : [],
    [catalogue, baseFilms, state, now],
  );
  const resultCount = state.path === "/events" ? events.length : selected.length;
  const counts = useMemo(
    () =>
      catalogue
        ? state.path === "/events"
          ? eventFacetCounts(catalogue.events, baseFilms, catalogue.meta, state, now)
          : facetCounts(
              selectFilms(baseFilms, { ...state, filters: {} }),
              catalogue.meta,
              state,
              now,
            )
        : null,
    [
      catalogue,
      baseFilms,
      state.path,
      state.eventType,
      state.search,
      state.director,
      state.filters,
      state.excluded,
      state.from,
      state.to,
      state.available,
      state.short,
      state.tonight,
      now,
    ],
  );
  const previousCinemaAccount = useRef(account.user?.id ?? null);
  useEffect(() => {
    const id = account.user?.id ?? null;
    if (id !== previousCinemaAccount.current) {
      previousCinemaAccount.current = id;
      setCinemasOpen(false);
      if (myCinemasActive) {
        setMyCinemasActive(false);
        change({ filters: { ...state.filters, venue: [] }, page: 1 });
      }
    }
  }, [account.user?.id]);
  const myCinemasUpdating = useRef(false);
  function change(changes: Partial<ViewState>, push = false) {
    if (
      prototypeEnabled &&
      "search" in changes &&
      "excluded" in changes &&
      "filters" in changes &&
      "available" in changes &&
      "watchlist" in changes
    )
      friends.update({ selected: [] });
    if (
      changes.filters &&
      changes.filters.venue !== state.filters.venue &&
      !myCinemasUpdating.current
    )
      setMyCinemasActive(false);
    // Any explicit date/time edit leaves Tonight and clears the time range it supplied.
    if (
      state.tonight &&
      changes.tonight === undefined &&
      ((changes.filters &&
        (changes.filters.day !== state.filters.day ||
          changes.filters.time !== state.filters.time)) ||
        (changes.excluded &&
          (changes.excluded.day !== state.excluded.day ||
            changes.excluded.time !== state.excluded.time)) ||
        changes.from !== undefined ||
        changes.to !== undefined)
    ) {
      changes = { ...changes, tonight: false, from: changes.from ?? "", to: changes.to ?? "" };
    }
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
      setMyCinemasActive(false);
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
    if (!catalogue || state.path === "/events") return;
    const maximum = Math.max(1, Math.ceil(tableRows(selected, state).length / PAGE_SIZE));
    if (state.page > maximum) {
      const next = { ...state, page: maximum };
      setState(next);
      window.history.replaceState(null, "", viewUrl(next));
    }
  }, [catalogue, selected.length, state]);
  useEffect(() => {
    if (
      state.path !== "/radar" &&
      expanded &&
      !tableRows(selected, state).some((row) => row.key === expanded)
    )
      setExpanded(null);
  }, [expanded, selected, state]);
  useEffect(() => {
    if (!myCinemasActive || cinemas.loading || cinemas.error) return;
    myCinemasUpdating.current = true;
    change({
      filters: { ...state.filters, venue: [...cinemas.venues] },
      excluded: { ...state.excluded, venue: [] },
      page: 1,
    });
    myCinemasUpdating.current = false;
  }, [cinemas.venues.join("|"), cinemas.loading, cinemas.error, myCinemasActive]);
  const suggestions =
    catalogue &&
    state.path !== "/events" &&
    selected.length === 0 &&
    !myCinemasUnavailable &&
    (!(state.watchlist || state.path === "/watchlist") ||
      (account.user && account.watchlist?.fetchedAt && !account.error))
      ? recoverySuggestions(baseFilms, catalogue.meta, state, now)
      : [];
  function closeQuickFilters() {
    document.querySelector<HTMLDialogElement>(".quick-filter-dialog")?.close();
    setQuickOpen(false);
  }
  function openCinemas(fromAccount = false) {
    returnToAccount.current = fromAccount;
    closeQuickFilters();
    document.querySelector<HTMLDialogElement>(".account-dialog")?.close();
    setAccountOpen(false);
    setCinemasOpen(true);
  }
  function closeCinemas() {
    setCinemasOpen(false);
    if (returnToAccount.current) setAccountOpen(true);
  }
  function openScreeningCalendar(event: CalendarInput) {
    calendar.dismiss();
    setCalendarEvent(event);
  }
  function closeScreeningCalendar() {
    document.querySelector<HTMLDialogElement>(".screening-calendar-dialog")?.close();
    setCalendarEvent(null);
  }
  function openSettings() {
    if (drawer.current?.open) drawer.current.close();
    setDrawerOpen(false);
    setSettingsOpen(true);
  }
  function openAccount() {
    closeScreeningCalendar();
    closeQuickFilters();
    // The phone drawer is itself a modal dialog; close it first so dialogs never nest.
    if (drawer.current?.open) drawer.current.close();
    setDrawerOpen(false);
    setAccountOpen(true);
  }
  const phone = () => window.matchMedia("(max-width: 799px)").matches;
  const sidebarProps = {
    state,
    onFriends: () => {
      if (drawer.current?.open) drawer.current.close();
      setDrawerOpen(false);
      friends.setPanel("friends");
    },
    onSettings: openSettings,
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
    resultCount,
  };
  return (
    <FriendsContext.Provider value={friends}>
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
          <button
            class="drawer-close"
            aria-label="Close pages"
            onClick={() => setDrawerOpen(false)}
          >
            ×
          </button>
          <Sidebar {...sidebarProps} />
        </dialog>
        <main class="main-column" id="main-content">
          {prototypeEnabled && (
            <div class="prototype-banner">
              <span>Friends prototype · Real catalogue, sample watchlists · Nothing is sent</span>
              <button onClick={() => friends.setPanel("email")}>Email preview</button>
            </div>
          )}
          <FriendsDialogs onNavigate={() => change({ path: "/watchlist", page: 1 }, true)} />
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
          <Dialog
            open={settingsOpen}
            title="Settings"
            className="settings-dialog"
            onClose={() => setSettingsOpen(false)}
            restoreTo={() =>
              document.querySelector<HTMLElement>(
                phone() ? ".menu-button" : ".desktop-sidebar .settings-button",
              )
            }
          >
            <DisplayControls
              value={display}
              onChange={(value) => {
                setDisplay(value);
                change({ page: 1 });
              }}
            />
          </Dialog>
          <AccountDialogs
            account={account}
            open={accountOpen}
            matches={watchlistMatches}
            onManageCinemas={() => openCinemas(true)}
            onClose={() => setAccountOpen(false)}
            onNavigate={(path) => change({ path, page: 1, director: "" }, true)}
            restoreTo={() =>
              document.querySelector<HTMLElement>(
                phone() ? ".menu-button" : ".desktop-sidebar .account-panel button",
              )
            }
          />
          {meta && (
            <MyCinemas cinemas={cinemas} meta={meta} open={cinemasOpen} onClose={closeCinemas} />
          )}
          <ScreeningCalendarDialog
            event={calendarEvent}
            calendar={calendar}
            account={account}
            onClose={() => setCalendarEvent(null)}
            onAccount={openAccount}
            onNavigate={() => {
              closeScreeningCalendar();
              change({ path: "/my-calendar", page: 1 }, true);
            }}
          />
          {!accountOpen && (
            <div class="page-notices">
              <AccountFeedback
                account={account}
                showError={
                  ["/watchlist", "/my-calendar"].includes(state.path) ||
                  !!state.watchlist ||
                  !!calendarEvent
                }
              />
            </div>
          )}
          {state.path === "/privacy" ? (
            <Privacy />
          ) : state.path === "/auth/verify" ? (
            <TokenPage kind="verify" onSignedIn={account.reload} />
          ) : state.path === "/unsubscribe" ? (
            <TokenPage kind="unsubscribe" onSignedIn={account.reload} />
          ) : state.path === "/my-calendar" ? (
            <>
              <div class="calendar-watchlists">
                <WatchlistsButton />
                <WatchlistSelections />
              </div>
              <MyCalendar
                calendar={{
                  ...calendar,
                  screenings: calendar.screenings.filter((e) => {
                    const film = catalogue?.films.find((f) => f.id === e.filmId);
                    return (
                      !prototypeEnabled ||
                      !friends.active.length ||
                      (!!film && friends.matches(film))
                    );
                  }),
                }}
                account={account}
                onAccount={openAccount}
                now={now}
              />
            </>
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
                  {state.path === "/calendar" &&
                    " Dates run earliest first; column sorts apply within each release group."}
                </p>
              )}
              {catalogue && (
                <>
                  <FilterBar {...filterProps} />
                </>
              )}
              {catalogue && (
                <div class="filter-summary">
                  <QuickFilters
                    open={quickOpen}
                    onOpen={() => setQuickOpen(true)}
                    onClose={() => setQuickOpen(false)}
                    resultCount={resultCount}
                    resultLabel={state.path === "/events" ? "event" : "film"}
                    activeCount={
                      Number(!!state.filters.day?.length) +
                      Number(isEvening(state)) +
                      Number(!!state.watchlist) +
                      Number(myCinemasActive) +
                      Number(!!state.short)
                    }
                  >
                    <div class="quick-days" role="group" aria-label="Quick filters">
                      {[
                        { id: "today", label: "Today" },
                        { id: "tomorrow", label: "Tomorrow" },
                        { id: "tonight", label: "Tonight" },
                        { id: "evening", label: "Evening" },
                        { id: "weekend", label: "This weekend" },
                        { id: "this-week", label: "This week" },
                        { id: "next-week", label: "Next week" },
                      ].map(({ id, label }) => {
                        const active =
                          id === "evening"
                            ? isEvening(state)
                            : id === "tonight"
                            ? !!state.tonight
                            : !state.tonight &&
                              state.filters.day?.length === 1 &&
                              state.filters.day[0] === id &&
                              !state.excluded.day?.length;
                        return (
                          <button
                            key={id}
                            title={
                              id === "this-week"
                                ? "Next 7 days, including today"
                                : id === "next-week"
                                  ? "The 7 days after that"
                                  : undefined
                            }
                            aria-pressed={active}
                            onClick={() => change(id === "evening" ? eveningShortcut(state) : dateShortcut(state, id))}
                          >
                            {label}
                            {id !== "tonight" && <small> {id === "evening" ? (counts?.time.get("evening") ?? 0) : (counts?.day.get(id) ?? 0)}</small>}
                          </button>
                        );
                      })}
                      <button
                        aria-pressed={!!state.watchlist}
                        onClick={() => {
                          change({ watchlist: !state.watchlist, page: 1 });
                          if (!state.watchlist && (!account.user || !account.watchlist?.fetchedAt))
                            openAccount();
                        }}
                      >
                        My watchlist
                      </button>
                      <button
                        aria-pressed={myCinemasActive}
                        disabled={cinemas.loading}
                        onClick={() => {
                          myCinemasUpdating.current = true;
                          change({
                            filters: {
                              ...state.filters,
                              venue: myCinemasActive ? [] : [...cinemas.venues],
                            },
                            excluded: { ...state.excluded, venue: [] },
                            page: 1,
                          });
                          myCinemasUpdating.current = false;
                          setMyCinemasActive(!myCinemasActive);
                        }}
                      >
                        My cinemas
                      </button>
                      <button
                        aria-pressed={!!state.short}
                        onClick={() => change({ short: !state.short, page: 1 })}
                      >
                        Under 2 hours
                      </button>
                    </div>
                  </QuickFilters>
                  {cinemas.storageError && !cinemasOpen && (
                    <p role="status">{cinemas.storageError}</p>
                  )}
                  {cinemas.error && myCinemasActive && !cinemasOpen && (
                    <p role="alert">
                      {cinemas.error}{" "}
                      <button
                        onClick={() => {
                          void cinemas.reload();
                        }}
                      >
                        Retry cinema sync
                      </button>
                    </p>
                  )}
                  {state.path === "/events" && <EventTypeFilter state={state} onChange={change} />}
                  <p role="status" aria-live="polite">
                    <strong>
                      {resultCount.toLocaleString("en-GB")}{" "}
                      {state.path === "/events"
                        ? resultCount === 1
                          ? "event"
                          : "events"
                        : resultCount === 1
                          ? "film"
                          : "films"}
                    </strong>{" "}
                    matching your choices
                  </p>
                  <div class="active-filters" role="group" aria-label="Active filters">
                    {hasActiveChoices && (
                      <button onClick={() => change(clearFilters(state.path))}>Clear all</button>
                    )}
                    <WatchlistSelections />

                    {hasCustomSort(state) && (
                      <button
                        onClick={() => change({ ...defaultSort(state.path), page: 1 })}
                        aria-label="Clear sort"
                      >
                        Sort: {sortLabel(state.sort)} ×
                      </button>
                    )}
                    {state.filmGauge && state.path === "/radar" && (
                      <button onClick={() => change({ filmGauge: undefined, page: 1 })}>
                        On film: {state.filmGauge} ×
                      </button>
                    )}
                    {state.eventType && (
                      <button onClick={() => change({ eventType: "", page: 1 })}>
                        Event type: {EVENT_TYPES.find((type) => type.id === state.eventType)?.label}{" "}
                        ×
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
                    {state.watchlist && !prototypeEnabled && (
                      <button onClick={() => change({ watchlist: false, page: 1 })}>
                        My watchlist ×
                      </button>
                    )}
                    {state.short && (
                      <button onClick={() => change({ short: false, page: 1 })}>
                        Under 2 hours ×
                      </button>
                    )}
                    {state.tonight && (
                      <button onClick={() => change(dateShortcut(state, "tonight"))}>
                        Tonight ×
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
              {suggestions.length > 0 && (
                <div
                  class="recovery-suggestions"
                  role="group"
                  aria-label="Suggested filter adjustments"
                >
                  <h2>No films match these filters</h2>
                  <p>Try one adjustment below. Your other choices stay selected.</p>
                  {suggestions.map((suggestion) => (
                    <button key={suggestion.label} onClick={() => change(suggestion.changes)}>
                      {suggestion.label} · {suggestion.count}{" "}
                      {suggestion.count === 1 ? "film" : "films"}
                    </button>
                  ))}
                </div>
              )}
              {catalogue && myCinemasUnavailable && (
                <div class="empty-state" aria-label="My cinemas setup">
                  {cinemas.loading ? (
                    <p role="status">Loading my cinemas…</p>
                  ) : cinemas.error ? (
                    <>
                      <p role="alert">{cinemas.error}</p>
                      <button onClick={() => openCinemas()}>Manage my cinemas</button>
                    </>
                  ) : (
                    <>
                      <h2>Set up my cinemas</h2>
                      <p>Choose your favourite cinemas in Account to see their screenings here.</p>
                      <button onClick={() => openCinemas()}>Set up my cinemas</button>
                    </>
                  )}
                </div>
              )}
              {catalogue &&
                !myCinemasUnavailable &&
                (state.path === "/radar" ? (
                  <Radar
                    films={baseFilms}
                    meta={catalogue.meta}
                    state={state}
                    now={now}
                    display={display}
                    watched={account.user ? watched : undefined}
                    calendar={calendar}
                    onCalendar={openScreeningCalendar}
                    expanded={expanded}
                    onExpand={setExpanded}
                    onChange={change}
                  />
                ) : state.path === "/events" ? (
                  <Events
                    events={events}
                    films={baseFilms}
                    meta={catalogue.meta}
                    state={state}
                    display={display}
                    watched={account.user ? watched : undefined}
                    calendar={calendar}
                    onCalendar={openScreeningCalendar}
                    onChange={change}
                  />
                ) : (
                  <FilmTable
                    films={selected}
                    showEmpty={!suggestions.length}
                    calendar={calendar}
                    onCalendar={openScreeningCalendar}
                    now={now}
                    display={display}
                    watched={account.user ? watched : undefined}
                    meta={catalogue.meta}
                    state={state}
                    expanded={expanded}
                    onExpand={setExpanded}
                    onChange={change}
                  />
                ))}
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
    </FriendsContext.Provider>
  );
}
