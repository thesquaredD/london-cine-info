import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import { DEFAULT_DISPLAY, type DisplayState } from "@lci/core/display";
import type { Account, Watchlist } from "@lci/core/account";
import { validCalendarInput, type CalendarScreening, type CalendarInput } from "@lci/core/calendar";
import { createCatalogue, HttpError } from "./catalogue/loader";
import { fileCache } from "./catalogue/cache";
import { createSession, type Credentials } from "./session/client";
import {
  cinemaMerge,
  validVenues,
  type GuestCinemas,
  type CinemaPreferences,
} from "./preferences/model";
import { analyticsChoice, analyticsHeaders, identify } from "./analytics";
const SESSION_KEY = "lci.session.v1";
export const session = createSession(
  {
    async read() {
      const value = await SecureStore.getItemAsync(SESSION_KEY);
      return value ? (JSON.parse(value) as Credentials) : null;
    },
    async write(value) {
      if (value)
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value), {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      else await SecureStore.deleteItemAsync(SESSION_KEY);
    },
  },
  fetch,
  analyticsHeaders,
);
export const catalogue = createCatalogue(
  fileCache,
  async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new HttpError(response.status);
    return response.json();
  },
  __DEV__ ? process.env.EXPO_PUBLIC_CATALOGUE_ORIGIN : undefined,
);
const GUEST_KEY = "london-cine.cinemas.v1",
  PREFS_KEY = "lci.preferences.v1";
function parseStored<T>(text: string | null): T | null {
  try {
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}
type Preferences = { display: DisplayState; analytics: boolean };
function useAppState() {
  const credentials = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const data = useSyncExternalStore(catalogue.subscribe, catalogue.getSnapshot);
  const [ready, setReady] = useState(false),
    [prefs, setPrefs] = useState<Preferences>({ display: DEFAULT_DISPLAY, analytics: false });
  const [guest, setGuest] = useState<GuestCinemas>({ browserId: "", venues: [] });
  const [account, setAccount] = useState<{
    owner: string;
    user: Account;
    watchlist: Watchlist;
    cinemas: CinemaPreferences;
    calendar: CalendarScreening[];
  } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0),
    lock = useRef(false);
  const id = credentials?.userId ?? null;
  const current = account?.owner === id ? account : null;
  const reload = async () => {
    const identity = session.getSnapshot()?.userId,
      epoch = ++generation.current;
    if (!identity || !guest.browserId) {
      setAccount(null);
      return;
    }
    const me = await session.api<{ user: Account | null }>("/api/me");
    if (!me.user) {
      await session.clear();
      throw new Error("Your session has expired. Please sign in again.");
    }
    const [watchlist, cinemas, calendar] = await Promise.all([
      session.api<Watchlist>("/api/watchlist"),
      session.api<CinemaPreferences>("/api/cinemas", "POST", cinemaMerge(guest)),
      session.api<{ screenings: CalendarScreening[] }>("/api/calendar"),
    ]);
    if (
      !Array.isArray(watchlist.slugs) ||
      !watchlist.slugs.every((slug) => typeof slug === "string") ||
      !validVenues(cinemas.venues) ||
      !Number.isInteger(cinemas.version) ||
      !Array.isArray(calendar.screenings) ||
      !calendar.screenings.every((row) => validCalendarInput(row) && /^[a-f0-9]{64}$/.test(row.id))
    )
      throw new Error("Account data could not be read. Please retry.");
    if (epoch !== generation.current || session.getSnapshot()?.userId !== identity) return;
    if (watchlist.username !== me.user.username || watchlist.fetchedAt !== me.user.fetchedAt)
      throw new Error(
        "Your watchlist changed while loading. Check status to load the latest data.",
      );
    setAccount({
      owner: identity,
      user: me.user,
      watchlist,
      cinemas,
      calendar: calendar.screenings,
    });
  };
  const perform = async (work: () => Promise<void>) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Please try again.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    void catalogue.start();
    void (async () => {
      try {
        const [guestText, prefsText] = await Promise.all([
          AsyncStorage.getItem(GUEST_KEY),
          AsyncStorage.getItem(PREFS_KEY),
        ]);
        let value = parseStored<GuestCinemas>(guestText);
        if (!value || !/^[a-f0-9-]{36}$/.test(value.browserId) || !validVenues(value.venues))
          value = { browserId: randomUUID(), venues: [] };
        await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(value));
        setGuest(value);
        if (prefsText) {
          const saved = parseStored<Preferences>(prefsText);
          if (
            saved &&
            ["both", "title", "original"].includes(saved.display?.titleMode) &&
            Array.isArray(saved.display.ratingOrder) &&
            saved.display.ratingOrder.length === 4 &&
            new Set(saved.display.ratingOrder).size === 4 &&
            saved.display.ratingOrder.every((key) => DEFAULT_DISPLAY.ratingOrder.includes(key))
          ) {
            const validated = { display: saved.display, analytics: saved.analytics === true };
            setPrefs(validated);
            analyticsChoice(validated.analytics);
          }
        }
        await session.restore();
      } catch {
        setError(
          "Phone storage could not be read. Retry by reopening the app. Browsing is still available.",
        );
      } finally {
        setReady(true);
      }
    })();
  }, []);
  useEffect(() => {
    generation.current++;
    setAccount(null);
    identify(id);
    if (ready && id)
      void reload().catch((failure) =>
        setError(
          failure instanceof Error
            ? failure.message
            : "Account data could not be read. Please retry.",
        ),
      );
    // Reload only when identity changes; extending the same token must not restart it.
  }, [id, ready]);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void catalogue.foreground();
        if (session.getSnapshot()) void perform(() => reloadRef.current());
      }
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!current?.user.pending) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void perform(() => reloadRef.current());
    }, 15_000);
    return () => clearInterval(timer);
  }, [current?.user.pending]);
  return {
    data,
    ready,
    user: current?.user ?? null,
    signedIn: !!id,
    watchlist: current?.watchlist ?? null,
    calendar: current?.calendar ?? [],
    cinemas: id ? (current?.cinemas.venues ?? []) : guest.venues,
    display: prefs.display,
    analytics: prefs.analytics,
    error,
    busy,
    perform,
    reload,
    dismissError: () => setError(""),
    async setPreferences(next: Partial<Preferences>) {
      if (next.analytics === false) {
        analyticsChoice(false);
        setPrefs((value) => ({ ...value, analytics: false }));
      }
      return perform(async () => {
        const value = { ...prefs, ...next };
        await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(value));
        setPrefs(value);
        analyticsChoice(value.analytics);
      });
    },
    async saveCinemas(venues: string[]) {
      return perform(async () => {
        if (!validVenues(venues)) throw new Error("Choose valid cinemas.");
        if (id) {
          if (!current) throw new Error("Reload your account before saving.");
          const result = await session.api<CinemaPreferences>("/api/cinemas", "PUT", {
            venues,
            version: current.cinemas.version,
          });
          if (!validVenues(result.venues) || !Number.isInteger(result.version))
            throw new Error("Saved cinemas could not be read. Reload them.");
          if (session.getSnapshot()?.userId === id) {
            generation.current++;
            setAccount({ ...current, cinemas: result });
          }
        } else {
          if (!guest.browserId)
            throw new Error("Phone storage is unavailable. Reopen the app and retry.");
          const value = { ...guest, venues };
          await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(value));
          setGuest(value);
        }
      });
    },
    async saveScreening(input: CalendarInput, remove?: CalendarScreening) {
      return perform(async () => {
        if (!current) throw new Error("Please sign in to save screenings.");
        await session.api(
          "/api/calendar",
          remove ? "DELETE" : "POST",
          remove ? { id: remove.id } : { screening: input },
        );
        await reload();
      });
    },
    async signOut() {
      return perform(async () => {
        await session.api("/api/auth/logout", "POST", {});
        await session.clear();
      });
    },
    async deleteAccount() {
      return perform(async () => {
        await session.api("/api/me", "DELETE");
        await session.clear();
      });
    },
  };
}
const Context = createContext<ReturnType<typeof useAppState> | null>(null);
export function Providers({ children }: PropsWithChildren) {
  const value = useAppState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing app provider");
  return value;
}
