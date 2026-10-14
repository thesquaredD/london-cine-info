import { Notice } from "./components/notice";
import { EmptyState } from "./components/empty-state";
import { MobileSort } from "./components/mobile-sort";
import { capture } from "./lib/analytics";
import { useDiscoveryAnalytics } from "./lib/discovery-analytics";
import { FriendsPage } from "./components/friends-page";
import { FriendsContext, useFriendsModel } from "./lib/friends";
import {
  WatchlistsDialog,
  FriendsFeedback,
  WatchlistsButton,
  WatchlistSelections,
} from "./components/friends";
import { Privacy } from "./components/privacy";
import { SettingsPage } from "./components/settings-page";
import { ChangelogPage } from "./components/changelog-page";
import { FeedbackDialog, FeedbackEntry } from "./components/feedback";
import { openFeedback } from "./lib/feedback";
import { useCalendar } from "./lib/calendar";
import { MyCalendar, ScreeningCalendarDialog } from "./components/screening-calendar";
import type { CalendarInput } from "./shared/calendar";
import { useCinemas } from "./lib/cinemas";
import { ShortcutStrip } from "./components/shortcut-strip";
import { MyCinemas } from "./components/my-cinemas";
import { Events, EventTypeFilter } from "./components/events";
import { matchingEvents, eventFacetCounts } from "./lib/events";
import { EVENT_TYPES } from "./data/event-rules";
import { Radar } from "./components/radar";
import { recoverySuggestions } from "./lib/recovery";
import { catalogueDecades, countYears, hasYears, yearSummary } from "./lib/years";
import {
  DEFAULT_DISPLAY,
  readHideRatings,
  HIDE_RATINGS_STORAGE,
  watchlistDisplay,
  type DisplayState,
} from "./lib/display";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useAccount } from "./lib/account";
import {
  AccountPage,
  AccountFeedback,
  ImportStatus,
  RefreshButton,
  TokenPage,
} from "./components/account";
import { letterboxdSlug } from "./shared/account";
import { PageLink } from "./components/page-link";
import { Sidebar } from "./components/sidebar";
import { FilterBar } from "./components/filter-bar";
import { FilmTable } from "./components/film-table";
import {
  clearFilters,
  filterFilms,
  facetCounts,
  activeFacetChoices,
  directorLabel,
  FILTERS,
  dateShortcut,
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

function About({
  meta,
  onNavigate,
}: {
  meta: DataMeta | null;
  onNavigate: (path: string) => void;
}) {
  return (
    <article class="prose" aria-labelledby="about-title">
      <header class="prose-head">
        <h2 id="about-title">London screenings, in one table</h2>
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
        <p>
          Favourite cinemas are saved in your browser, or in your account while signed in. Accounts
          use a necessary session cookie. Theme choices last for this visit. Opening a poster or
          following an external link contacts that provider.
        </p>
        <div class="prose-links">
          <PageLink href="/privacy" onNavigate={onNavigate}>
            Privacy policy
          </PageLink>
          <span aria-hidden="true">·</span>
          <PageLink href="/changelog" onNavigate={onNavigate}>
            What's new
          </PageLink>
          <span aria-hidden="true">·</span>
          <button class="feedback-link" onClick={() => openFeedback()}>
            Share feedback
          </button>
        </div>
      </section>
      <p class="prose-small prose-closing">
        A personal, non-commercial project by Diogo Diogo. A London take on{" "}
        <a href="https://paris-cine.info">paris-cine.info</a>.
      </p>
    </article>
  );
}

const EMPTY_FILMS: Film[] = [];
export function App() {
  const account = useAccount();
  const calendar = useCalendar(account);
  const [calendarEvent, setCalendarEvent] = useState<CalendarInput | null>(null);
  const cinemas = useCinemas(account);
  const [cinemasOpen, setCinemasOpen] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);
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
  const myCinemasActive = !!state.myCinemas;
  const [catalogue, setCatalogue] = useState<{
    films: Film[];
    meta: DataMeta;
    events: EventOccurrence[];
  } | null>(null);
  const friends = useFriendsModel(
    catalogue?.films ?? EMPTY_FILMS,
    state.path === "/watchlist",
    () => setState((s) => ({ ...s, page: 1 })),
    !!state.watchlist,
    (selected) => change({ watchlist: selected, page: 1 }),
    account,
  );
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [display, setDisplay] = useState<DisplayState>(() => ({
    ...DEFAULT_DISPLAY,
    hideWatchlistRatings: readHideRatings(),
    ratingOrder: [...DEFAULT_DISPLAY.ratingOrder],
  }));
  const effectiveDisplay = watchlistDisplay(display, state);
  const hideRatings = effectiveDisplay.ratingOrder.length === 0;
  const effectiveState: ViewState =
    hideRatings && ["lb", "im", "mc", "rt"].includes(state.sort)
      ? { ...state, sort: "title", direction: "asc", sortExplicit: true }
      : state;
  const [displayError, setDisplayError] = useState("");
  const expanded = state.film ?? null;
  function setExpanded(key: string | null) {
    change({ film: key ?? undefined }, true);
  }
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const meta = catalogue?.meta ?? null;
  const [yearOpenRequest, setYearOpenRequest] = useState(0);
  const yearDecades = useMemo(() => catalogueDecades(catalogue?.films ?? []), [catalogue]);
  const pageTitle =
    PAGES.find((page) => page.path === state.path)?.name ??
    {
      "/account": "Account",
      "/friends": "Friends",
      "/settings": "Settings",
      "/changelog": "What’s new",
      "/privacy": "Privacy",
      "/auth/verify": "Sign in",
      "/unsubscribe": "Unsubscribe",
    }[state.path] ??
    "About";
  const hasActiveChoices = Boolean(
    friends.choices.selected.length ||
    state.filmGauge ||
    state.eventType ||
    hasYears(state) ||
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
  const myCinemasUnavailable = myCinemasActive && !cinemas.venues.length;
  const baseFilms = useMemo(
    () =>
      (myCinemasUnavailable ? [] : (catalogue?.films ?? [])).filter((film) =>
        friends.matchesFilm(film),
      ) ?? [],
    [
      catalogue,
      state.path,
      state.watchlist,
      watched,
      myCinemasUnavailable,
      friends.choices,
      friends.listSets,
      friends.matchMap,
    ],
  );
  // Opening a film changes the URL but not the catalogue's filters or ordering.
  const catalogueKey = viewUrl({ ...effectiveState, film: undefined });
  const catalogueState = useMemo(() => ({ ...effectiveState, film: undefined }), [catalogueKey]);
  const selected = useMemo(
    () =>
      catalogue
        ? sortFilms(
            filterFilms(
              selectFilms(baseFilms, catalogueState),
              catalogue.meta,
              catalogueState,
              now,
            ),
            catalogueState.sort,
            catalogueState.direction,
            watched,
            display.titleMode,
          )
        : [],
    [catalogue, catalogueState, baseFilms, watched, display.titleMode, now],
  );
  const eventsSource = useMemo(() => {
    if (!friends.active.length) return catalogue?.events ?? [];
    const ids = new Set(baseFilms.map((film) => film.id));
    return (catalogue?.events ?? []).filter((event) => ids.has(event.filmId));
  }, [catalogue, baseFilms, friends.active.length]);
  const events = useMemo(
    () =>
      catalogue && state.path === "/events"
        ? matchingEvents(eventsSource, baseFilms, catalogue.meta, state, now)
        : [],
    [catalogue, eventsSource, baseFilms, state, now],
  );
  const resultCount = state.path === "/events" ? events.length : selected.length;
  useDiscoveryAnalytics(
    state,
    resultCount,
    !!catalogue &&
      PAGES.some((page) => page.path === state.path) &&
      state.path !== "/my-calendar" &&
      (!friends.active.length || (!friends.loading && !friends.listLoading && !friends.error)),
    !!account.user && !!account.watchlist?.fetchedAt && !account.loading && !account.error,
    {
      shared_watchlists: friends.active.some((key) => key !== "mine"),
      selected_friend_count: friends.active.filter((key) => key.startsWith("f:")).length,
      public_watchlist_count: friends.active.filter((key) => key.startsWith("t:")).length,
      all_friends: friends.active.includes("friends"),
      match_mode: friends.choices.mode,
    },
    friends.active.join("|"),
  );
  const counts = useMemo(
    () =>
      catalogue
        ? state.path === "/events"
          ? eventFacetCounts(eventsSource, baseFilms, catalogue.meta, state, now)
          : facetCounts(
              selectFilms(baseFilms, { ...state, filters: {} }),
              catalogue.meta,
              state,
              now,
            )
        : null,
    [
      catalogue,
      eventsSource,
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
      state.decades,
      state.years,
      state.short,
      state.tonight,
      now,
    ],
  );
  const previousCinemaAccount = useRef(account.user?.id ?? null);
  useEffect(() => {
    const id = account.user?.id ?? null;
    if (id !== previousCinemaAccount.current) {
      const previous = previousCinemaAccount.current;
      previousCinemaAccount.current = id;
      setCinemasOpen(false);
      if (myCinemasActive && previous !== null) {
        change({ myCinemas: false, filters: { ...state.filters, venue: [] }, page: 1 });
      }
    }
  }, [account.user?.id]);
  const myCinemasUpdating = useRef(false);
  const yearCounts = useMemo(() => {
    if (!catalogue) return new Map<number, number>();
    const withoutYears = { ...state, decades: [], years: [] };
    if (state.path === "/events") {
      const eligible = new Set(
        matchingEvents(eventsSource, baseFilms, catalogue.meta, withoutYears, now).map(
          (event) => event.filmId,
        ),
      );
      return countYears(baseFilms.filter((film) => eligible.has(film.id)));
    }
    return countYears(
      filterFilms(selectFilms(baseFilms, withoutYears), catalogue.meta, withoutYears, now),
    );
  }, [
    catalogue,
    eventsSource,
    baseFilms,
    state.path,
    state.eventType,
    state.filmGauge,
    state.radarSection,
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
  ]);
  function change(changes: Partial<ViewState>, push = !("search" in changes)) {
    if (
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
      changes.myCinemas ??= false;
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
    const navigates = changes.path !== undefined && changes.path !== state.path;
    const resetsFilm =
      navigates || changes.sort || (changes.page !== undefined && changes.page !== state.page);
    const next = { ...state, ...changes, ...(resetsFilm ? { film: undefined } : {}) };
    const url = viewUrl(next);
    if (url !== `${window.location.pathname}${window.location.search}`) {
      if (push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    }
    setState(next);
    if (changes.path !== undefined) {
      if (drawer.current?.open) drawer.current.close();
      setDrawerOpen(false);
    }
    if (navigates) window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    loadCatalogue(controller.signal)
      .then(setCatalogue)
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          capture("catalogue_load_failed");
        }
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const onPop = () => {
      setState(readView(new URL(window.location.href)));
      setDrawerOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (state.path === "/account") capture("account_opened");
  }, [state.path]);
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
      catalogue &&
      state.path !== "/radar" &&
      expanded &&
      !tableRows(selected, state).some((row) => row.key === expanded)
    )
      change({ film: undefined }, false);
  }, [expanded, selected, state, catalogue]);
  useEffect(() => {
    if (!myCinemasActive || cinemas.loading) return;
    myCinemasUpdating.current = true;
    change(
      {
        filters: { ...state.filters, venue: [...cinemas.venues] },
        excluded: { ...state.excluded, venue: [] },
        page: 1,
      },
      false,
    );
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
  function openCinemas() {
    setCinemasOpen(true);
  }
  function closeCinemas() {
    setCinemasOpen(false);
  }
  function openScreeningCalendar(event: CalendarInput) {
    calendar.dismiss();
    setCalendarEvent(event);
  }
  function closeScreeningCalendar() {
    document.querySelector<HTMLDialogElement>(".screening-calendar-dialog")?.close();
    setCalendarEvent(null);
  }
  function changeDisplay(value: DisplayState) {
    setDisplay(value);
    try {
      localStorage.setItem(HIDE_RATINGS_STORAGE, String(!!value.hideWatchlistRatings));
      setDisplayError("");
    } catch {
      setDisplayError("Browser storage is unavailable. This preference lasts only for this visit.");
    }
    change({ page: 1 });
  }
  function goToAccount() {
    closeScreeningCalendar();
    navigateTo("/account");
  }
  function navigateTo(path: string) {
    const url = new URL(path, location.origin);
    change({ path: url.pathname, page: 1, director: "" }, true);
    if (url.hash) {
      history.replaceState(null, "", `${location.pathname}${location.search}${url.hash}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }
  const phone = () => window.matchMedia("(max-width: 799px)").matches;
  const sidebarProps = {
    state,
    account,
    meta,
    onChange: change,
  };
  const filterProps = {
    state,
    account,
    meta,
    onChange: change,
    counts,
    resultCount,
    yearDecades,
    yearCounts,
    yearOpenRequest,
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
          <WatchlistsDialog onNavigate={navigateTo} />
          {!friends.panel && !["/account", "/friends"].includes(state.path) && <FriendsFeedback />}
          <header class="masthead">
            <button
              class="menu-button"
              data-requests={friends.pendingIncoming > 0}
              aria-label={
                friends.pendingIncoming
                  ? `Toggle pages, ${friends.pendingIncoming} friend request${friends.pendingIncoming === 1 ? "" : "s"}`
                  : "Toggle pages"
              }
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
                <span class="brand-name">LONDON CINÉ</span> <span class="brand-info">INFO</span>
              </a>
            </h1>
            <span class="design-view-label">{pageTitle}</span>
            <FeedbackEntry />
          </header>
          <FeedbackDialog dataVersion={meta?.generatedAt} onNavigate={navigateTo} />
          <div class="tagline">The database of London cinema screenings</div>
          <h2 class="sr-only">{pageTitle}</h2>
          {meta && (
            <>
              <MyCinemas cinemas={cinemas} meta={meta} open={cinemasOpen} onClose={closeCinemas} />
              <MyCinemas
                cinemas={cinemas}
                meta={meta}
                open={nearbyOpen}
                onClose={() => setNearbyOpen(false)}
                nearby={{
                  onApply: (venues) => {
                    change({
                      myCinemas: false,
                      filters: { ...state.filters, venue: venues },
                      excluded: { ...state.excluded, venue: [] },
                      page: 1,
                    });
                    setNearbyOpen(false);
                  },
                }}
              />
            </>
          )}
          <ScreeningCalendarDialog
            event={calendarEvent}
            calendar={calendar}
            account={account}
            onClose={() => setCalendarEvent(null)}
            onAccount={goToAccount}
            onNavigate={() => {
              closeScreeningCalendar();
              change({ path: "/my-calendar", page: 1 }, true);
            }}
          />
          {state.path !== "/account" && (
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
          {state.path === "/account" ? (
            <AccountPage
              account={account}
              matches={watchlistMatches}
              cinemas={cinemas}
              meta={meta}
              onManageCinemas={openCinemas}
              onNavigate={navigateTo}
            />
          ) : state.path === "/friends" ? (
            <FriendsPage
              onNavigate={(path) => {
                if (path === "/") change({ path: "/", watchlist: false, page: 1 }, true);
                else navigateTo(path);
              }}
            />
          ) : state.path === "/settings" ? (
            <SettingsPage
              display={display}
              onChange={changeDisplay}
              error={displayError}
              catalogue={catalogue}
              state={state}
            />
          ) : state.path === "/changelog" ? (
            <ChangelogPage onNavigate={navigateTo} />
          ) : state.path === "/privacy" ? (
            <Privacy onNavigate={navigateTo} />
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
                    return !friends.active.length || (!!film && friends.matchesFilm(film));
                  }),
                }}
                account={account}
                onAccount={goToAccount}
                now={now}
              />
            </>
          ) : state.path === "/about" ? (
            <About meta={meta} onNavigate={navigateTo} />
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
                    <PageLink href="/account" onNavigate={goToAccount}>
                      Sign in
                    </PageLink>
                  </div>
                )}
              {state.path === "/watchlist" && (
                <div
                  class={`view-note watchlist-intro ${account.user?.username ? "watchlist-connected" : ""}`}
                >
                  <h2 class={account.user?.username ? "sr-only" : undefined}>
                    Your Letterboxd watchlist
                  </h2>
                  {account.loading ? (
                    <p role="status">Checking sign-in…</p>
                  ) : !account.user ? (
                    <>
                      <p>Sign in to import your public Letterboxd watchlist.</p>
                      <PageLink href="/account" onNavigate={goToAccount}>
                        Sign in
                      </PageLink>
                    </>
                  ) : !account.user.username ? (
                    <>
                      <p>Set your Letterboxd username to import your public watchlist.</p>
                      <PageLink href="/account" onNavigate={goToAccount}>
                        Open account
                      </PageLink>
                    </>
                  ) : (
                    <>
                      <ImportStatus account={account} matches={watchlistMatches} />
                      <div class="account-actions">
                        <RefreshButton account={account} />
                        <PageLink href="/account" onNavigate={goToAccount}>
                          Account
                        </PageLink>
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
                  <FilterBar {...filterProps} state={effectiveState} hideRatings={hideRatings} />
                </>
              )}
              {catalogue && (
                <div class="filter-summary">
                  <ShortcutStrip
                    account={account}
                    cinemas={cinemas}
                    state={state}
                    counts={counts}
                    onChange={(changes) => {
                      myCinemasUpdating.current = changes.myCinemas !== undefined;
                      change(changes);
                      myCinemasUpdating.current = false;
                    }}
                    onNearby={() => setNearbyOpen(true)}
                  />
                  {myCinemasActive && (
                    <div class="cinema-context">
                      <span>My cinemas · {cinemas.venues.length} selected</span>
                      <button onClick={() => openCinemas()}>Edit cinemas</button>
                      {!cinemasOpen && (
                        <span role="status">
                          {cinemas.busy
                            ? "Saving…"
                            : cinemas.saved && !cinemas.storageError && !cinemas.error
                              ? "Saved"
                              : ""}
                        </span>
                      )}
                    </div>
                  )}
                  {cinemas.storageError && !cinemasOpen && (
                    <p role="status">
                      {cinemas.storageError}{" "}
                      <button onClick={() => void cinemas.retry()}>Retry cinema storage</button>
                    </p>
                  )}
                  {cinemas.error && myCinemasActive && !cinemasOpen && (
                    <p role="alert">
                      {cinemas.error}{" "}
                      <button
                        onClick={() => {
                          void (cinemas.conflict ? cinemas.reload() : cinemas.retry());
                        }}
                      >
                        {cinemas.conflict
                          ? "Use saved choices (discard pending edits)"
                          : "Retry cinema sync"}
                      </button>
                    </p>
                  )}
                  {state.path === "/events" && (
                    <EventTypeFilter state={effectiveState} onChange={change} />
                  )}
                  <div class="results-heading">
                    <p class="result-status" role="status" aria-live="polite">
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
                      <span class="result-context">matching your choices</span>
                    </p>
                    <MobileSort
                      hideRatings={hideRatings}
                      state={effectiveState}
                      onChange={change}
                    />
                  </div>
                  <div
                    class="active-filters"
                    role="group"
                    aria-label="Active filters"
                    tabIndex={hasActiveChoices ? 0 : undefined}
                  >
                    {hasActiveChoices && (
                      <button onClick={() => change(clearFilters(state.path))}>Clear all</button>
                    )}
                    <WatchlistSelections />

                    {hasYears(state) && (
                      <span class="year-chip">
                        <button
                          aria-label="Edit year filter"
                          onClick={() => setYearOpenRequest((value) => value + 1)}
                        >
                          Year: {yearSummary(state)}
                        </button>
                        <button
                          aria-label="Remove year filter"
                          onClick={() => change({ decades: [], years: [], page: 1 })}
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {hasCustomSort(effectiveState) && (
                      <button
                        onClick={() =>
                          change({ ...defaultSort(state.path), sortExplicit: undefined, page: 1 })
                        }
                        aria-label="Clear sort"
                      >
                        Sort: {sortLabel(effectiveState.sort)} ×
                      </button>
                    )}
                    {state.filmGauge && state.path === "/radar" && (
                      <button onClick={() => change({ filmGauge: undefined, page: 1 })}>
                        On film: {state.filmGauge} ×
                      </button>
                    )}
                    {state.eventType && (
                      <button onClick={() => change({ eventType: "", page: 1 })}>
                        Event type:{" "}
                        {state.eventType === "highlights"
                          ? "Q&As, scores & talks"
                          : EVENT_TYPES.find((type) => type.id === state.eventType)?.label}{" "}
                        ×
                      </button>
                    )}
                    {state.director && (
                      <button
                        onClick={() => change({ director: "", page: 1 })}
                        aria-label="Clear director"
                      >
                        Director: {directorLabel(state, catalogue.films)} ×
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
                    {activeFacetChoices(state, catalogue.meta)
                      .filter((choice) => !choice.excluded)
                      .map(({ key, id, groupLabel, label }) => (
                        <button
                          key={`${key}-${id}`}
                          aria-label={`Remove ${groupLabel.toLowerCase()} filter: ${label}`}
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
                          {label} ×
                        </button>
                      ))}
                    {(state.from || state.to) && (
                      <button onClick={() => change({ from: "", to: "", page: 1 })}>
                        Starts {state.from || "00:00"}–{state.to || "23:59"} ×
                      </button>
                    )}
                    {activeFacetChoices(state, catalogue.meta)
                      .filter((choice) => choice.excluded)
                      .map(({ key, id, groupLabel, label }) => (
                        <button
                          class="excluded-chip"
                          key={`not-${key}-${id}`}
                          aria-label={`Remove excluded ${groupLabel.toLowerCase()} filter: ${label}`}
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
                          NOT {label} ×
                        </button>
                      ))}
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
                <Notice
                  kind="error"
                  className="catalogue-status"
                  heading
                  title="The programme could not be loaded"
                  actions={
                    <>
                      <button onClick={() => setAttempt((value) => value + 1)}>Try again</button>
                      <button
                        class="feedback-link"
                        onClick={() => openFeedback({ context: { errorCode: "catalogue_load" } })}
                      >
                        Report this problem
                      </button>
                    </>
                  }
                >
                  <p>Please check your connection and try again.</p>
                </Notice>
              )}
              {catalogue && suggestions.length > 0 && (
                <EmptyState
                  directorName={directorLabel(state, catalogue.films)}
                  state={effectiveState}
                  meta={catalogue.meta}
                  onChange={change}
                  suggestions={
                    <div
                      class="recovery-suggestions"
                      role="group"
                      aria-label="Suggested filter adjustments"
                    >
                      {suggestions.map((suggestion) => (
                        <button key={suggestion.label} onClick={() => change(suggestion.changes)}>
                          {suggestion.label} · {suggestion.count}{" "}
                          {suggestion.count === 1 ? "film" : "films"}
                        </button>
                      ))}
                    </div>
                  }
                />
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
                      <p>Choose your favourite cinemas to see their screenings here.</p>
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
                    state={effectiveState}
                    now={now}
                    display={effectiveDisplay}
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
                    state={effectiveState}
                    display={effectiveDisplay}
                    watched={account.user ? watched : undefined}
                    calendar={calendar}
                    onCalendar={openScreeningCalendar}
                    onChange={change}
                  />
                ) : (
                  <FilmTable
                    directorName={directorLabel(state, catalogue.films)}
                    films={selected}
                    showEmpty={
                      !suggestions.length &&
                      !(
                        state.path === "/watchlist" &&
                        (!account.user?.username || !account.watchlist?.fetchedAt)
                      )
                    }
                    calendar={calendar}
                    onCalendar={openScreeningCalendar}
                    now={now}
                    display={effectiveDisplay}
                    watched={account.user ? watched : undefined}
                    meta={catalogue.meta}
                    state={effectiveState}
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
