import { createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Film } from "../shared/data";
import { letterboxdSlug } from "../shared/account";
import {
  MAX_SELECTED_WATCHLISTS,
  normalizeUsername,
  validLetterboxdUsername,
  type FriendsResponse,
  type FriendMatch,
  type FriendWatchlist,
  type PublicWatchlistPage,
} from "../shared/friends";
import { AccountError, accountApi, type AccountState } from "./account";

type Temporary = { username: string; slugs: string[]; fetchedAt: number };
type Choices = { selected: string[]; mode: "all" | "any"; temporary: Temporary[] };
const empty = (): Choices => ({ selected: [], mode: "all", temporary: [] });
const storageKey = (id: string | null) => `london-cine.watchlists.v1:${id ?? "guest"}`;
function readChoices(id: string | null): Choices {
  try {
    const v = JSON.parse(sessionStorage.getItem(storageKey(id)) ?? "null");
    if (
      !v ||
      !Array.isArray(v.selected) ||
      v.selected.length > MAX_SELECTED_WATCHLISTS ||
      !["all", "any"].includes(v.mode) ||
      !Array.isArray(v.temporary) ||
      v.temporary.length > 20
    )
      return empty();
    const temporary = v.temporary.filter(
      (t: Temporary) =>
        validLetterboxdUsername(t.username) &&
        Number.isFinite(t.fetchedAt) &&
        Array.isArray(t.slugs) &&
        t.slugs.length <= 14000 &&
        t.slugs.every((s) => typeof s === "string" && /^[a-z0-9-]{1,200}$/.test(s)),
    );
    return {
      selected: v.selected.filter(
        (s: unknown): s is string =>
          typeof s === "string" &&
          (s === "friends" ||
            /^f:[a-zA-Z0-9_-]{1,80}$/.test(s) ||
            temporary.some((t: Temporary) => s === `t:${t.username}`)),
      ),
      mode: v.mode,
      temporary,
    };
  } catch {
    return empty();
  }
}
function initialChoices(id: string | null): Choices {
  const choices = readChoices(id);
  return new URL(window.location.href).searchParams.get("friends") === "1"
    ? { ...choices, selected: ["friends"], mode: "all" }
    : choices;
}
export function useFriendsModel(
  films: Film[],
  mine: boolean,
  resetPage: () => void,
  ownFilter: boolean,
  onOwnFilter: (selected: boolean) => void,
  account: AccountState,
) {
  const id = account.user?.id ?? null;
  const [stored, setStored] = useState<{ id: string | null; choices: Choices }>(() => ({
    id,
    choices: initialChoices(id),
  }));
  const choices = stored.id === id ? stored.choices : empty();
  const latestChoices = useRef(choices);
  latestChoices.current = choices;
  const [remote, setRemote] = useState<{ id: string; data: FriendsResponse } | null>(null);
  const value =
    remote?.id === id ? remote.data : { friends: [], appUsername: null, friendsDigest: true };
  const [watchlists, setWatchlists] = useState<{ id: string; lists: FriendWatchlist[] } | null>(
    null,
  );
  const [matches, setMatches] = useState<{ id: string; items: FriendMatch[] } | null>(null);
  const [panel, setPanel] = useState<"friends" | "watchlists" | null>(null);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [listLoading, setListLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [importing, setImporting] = useState<string | null>(null),
    [progress, setProgress] = useState("");
  const [storageError, setStorageError] = useState("");
  const identity = useRef(id);
  identity.current = id;
  const generation = useRef(0),
    mutation = useRef(false),
    importController = useRef<AbortController | null>(null);
  const slugs = useMemo(
    () => [
      ...new Set(films.map((f) => letterboxdSlug(f.ra.lb?.url)).filter((s): s is string => !!s)),
    ],
    [films],
  );
  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!id) {
      setRemote(null);
      setMatches(null);
      setWatchlists(null);
      setError("");
      setLoading(false);
      return true;
    }
    setLoading(true);
    try {
      const data = await accountApi<FriendsResponse>("/api/friends");
      const items: FriendMatch[] = [];
      for (let offset = 0; offset < slugs.length; offset += 6000) {
        const batch = await accountApi<{ matches: FriendMatch[] }>("/api/friends/matches", "POST", {
          slugs: slugs.slice(offset, offset + 6000),
        });
        items.push(...batch.matches);
      }
      if (current !== generation.current || identity.current !== id) return false;
      setRemote({ id, data });
      setMatches({ id, items });
      setError("");
      const accepted = new Set(
        data.friends.filter((f) => f.status === "accepted").map((f) => `f:${f.id}`),
      );
      setStored((previous) =>
        previous.id === id
          ? {
              id,
              choices: {
                ...previous.choices,
                selected: previous.choices.selected.filter(
                  (s) => !s.startsWith("f:") || accepted.has(s),
                ),
              },
            }
          : previous,
      );
      return true;
    } catch (failure) {
      if (current === generation.current && identity.current === id)
        setError(failure instanceof Error ? failure.message : "Friends could not be loaded.");
      return false;
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [id, slugs]);
  useEffect(() => {
    setStored({ id, choices: initialChoices(id) });
    setPanel(null);
    setNotice("");
    importController.current?.abort();
    setImporting(null);
    return () => {
      generation.current++;
    };
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (stored.id !== id) return;
    try {
      if (!stored.choices.selected.length && !stored.choices.temporary.length)
        sessionStorage.removeItem(storageKey(id));
      else sessionStorage.setItem(storageKey(id), JSON.stringify(stored.choices));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is full or unavailable. Temporary lists stay available until you reload this page.",
      );
    }
  }, [stored, id]);
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden && !mutation.current) void reload();
    };
    window.addEventListener("focus", refresh);
    const interval = panel === "friends" ? window.setInterval(refresh, 30000) : null;
    return () => {
      window.removeEventListener("focus", refresh);
      if (interval) window.clearInterval(interval);
    };
  }, [panel, reload]);
  const selectedIds = choices.selected
    .filter((s) => s.startsWith("f:"))
    .map((s) => s.slice(2))
    .sort()
    .join(",");
  useEffect(() => {
    let cancelled = false;
    if (!id || !selectedIds) {
      setWatchlists(id ? { id, lists: [] } : null);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    void accountApi<{ watchlists: FriendWatchlist[] }>("/api/friends/watchlists", "POST", {
      ids: selectedIds.split(","),
    })
      .then((result) => {
        if (!cancelled && identity.current === id) {
          setWatchlists({ id, lists: result.watchlists });
          setError("");
        }
      })
      .catch((failure) => {
        if (!cancelled && identity.current === id) {
          setWatchlists({ id, lists: [] });
          setError(
            failure instanceof Error ? failure.message : "Selected lists could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, selectedIds, remote]);
  const active = [...new Set([...(mine || ownFilter ? ["mine"] : []), ...choices.selected])];
  const mineSlugs = useMemo(() => new Set(account.watchlist?.slugs ?? []), [account.watchlist]);
  const matchMap = useMemo(
    () => new Map((matches?.id === id ? matches.items : []).map((m) => [m.slug, m])),
    [matches, id],
  );
  const listSets = useMemo(
    () =>
      new Map<string, Set<string>>([
        ...(watchlists?.id === id ? watchlists.lists : []).map(
          (l) => [`f:${l.id}`, new Set(l.slugs)] as const,
        ),
        ...choices.temporary.map((t) => [`t:${t.username}`, new Set(t.slugs)] as const),
      ]),
    [watchlists, id, choices.temporary],
  );
  const accepted = value.friends.filter((f) => f.status === "accepted");
  const membership = (key: string, slug: string) =>
    key === "mine"
      ? mineSlugs.has(slug)
      : key === "friends"
        ? matchMap.has(slug)
        : !!listSets.get(key)?.has(slug);
  const matchesFilm = (film: Film) => {
    if (!active.length) return true;
    const slug = letterboxdSlug(film.ra.lb?.url);
    if (!slug || (mine && !mineSlugs.has(slug))) return false;
    const keys = mine ? active.filter((s) => s !== "mine") : active;
    return (
      !keys.length ||
      (choices.mode === "all"
        ? keys.every((k) => membership(k, slug))
        : keys.some((k) => membership(k, slug)))
    );
  };
  const update = (next: Partial<Choices>) => {
    setStored((previous) => ({
      id,
      choices: { ...(previous.id === id ? previous.choices : empty()), ...next },
    }));
    resetPage();
  };
  const toggle = (key: string) => {
    if (key === "mine") {
      onOwnFilter(!ownFilter);
      return;
    }
    if (!choices.selected.includes(key) && choices.selected.length >= MAX_SELECTED_WATCHLISTS) {
      setError("Select up to 20 watchlists at once. Remove a selection to add another.");
      return;
    }
    update({
      selected: choices.selected.includes(key)
        ? choices.selected.filter((s) => s !== key)
        : [...choices.selected, key],
    });
  };
  async function perform(path: string, method: string, body: unknown, message: string) {
    if (mutation.current || !id) return false;
    mutation.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const owner = id;
    try {
      await accountApi(path, method, body);
      if (identity.current !== owner) return false;
      await reload();
      setNotice(message);
      return true;
    } catch (failure) {
      if (identity.current === owner)
        setError(failure instanceof Error ? failure.message : "The action could not be completed.");
      return false;
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  async function addTemporary(raw: string) {
    if (importController.current) return false;
    const username = normalizeUsername(raw);
    if (!validLetterboxdUsername(username)) {
      setError("Enter a Letterboxd username, not a profile URL.");
      return false;
    }
    if (choices.temporary.some((t) => t.username === username)) {
      setError("That temporary list is already available.");
      return false;
    }
    if (choices.temporary.length >= 20 || choices.selected.length >= MAX_SELECTED_WATCHLISTS) {
      setError(
        "Remove a list before adding another. Up to 20 temporary or selected lists are supported.",
      );
      return false;
    }
    const controller = new AbortController();
    importController.current = controller;
    const owner = id;
    setImporting(username);
    setError("");
    setProgress("Reading the public watchlist…");
    try {
      const getPage = async (page: number) => {
        for (let retry = 0; retry < 5; retry++) {
          try {
            return await accountApi<PublicWatchlistPage>(
              "/api/watchlists/public",
              "POST",
              { username, page },
              controller.signal,
            );
          } catch (failure) {
            if (controller.signal.aborted) throw failure;
            if (
              !(failure instanceof AccountError) ||
              failure.status !== 429 ||
              !failure.retryAt ||
              failure.retryAt > Date.now() / 1000 + 15
            )
              throw failure;
            const retryAt = failure.retryAt;
            await new Promise<void>((resolve, reject) => {
              const abort = () => {
                clearTimeout(timer);
                reject(new Error("Cancelled"));
              };
              const timer = window.setTimeout(
                () => {
                  controller.signal.removeEventListener("abort", abort);
                  resolve();
                },
                Math.max(1, retryAt * 1000 - Date.now()),
              );
              controller.signal.addEventListener("abort", abort, { once: true });
            });
          }
        }
        throw new Error("Letterboxd is busy. Try again shortly.");
      };
      const first = await getPage(1);
      const all = new Set(first.slugs);
      for (let page = 2; page <= first.pages; page++) {
        if (controller.signal.aborted) throw new Error("Cancelled");
        setProgress(`Reading page ${page} of ${first.pages} · ${all.size} films so far`);
        const next = await getPage(page);
        if (
          next.count !== first.count ||
          next.pages !== first.pages ||
          !next.slugs.length ||
          next.slugs.some((s) => all.has(s))
        )
          throw new Error("The watchlist changed during import. Please try again.");
        next.slugs.forEach((s) => all.add(s));
      }
      if (all.size !== first.count)
        throw new Error("The complete watchlist could not be read. Please try again.");
      if (controller.signal.aborted || identity.current !== owner) return false;
      const currentChoices = latestChoices.current;
      if (currentChoices.selected.length >= MAX_SELECTED_WATCHLISTS)
        throw new Error("Remove a selected list before adding another.");
      update({
        temporary: [
          ...currentChoices.temporary,
          { username, slugs: [...all], fetchedAt: Date.now() },
        ],
        selected: [...currentChoices.selected, `t:${username}`],
      });
      setNotice(
        first.count
          ? `@${username} is available for this session.`
          : `@${username} has an empty public watchlist.`,
      );
      return true;
    } catch (failure) {
      if (!controller.signal.aborted && identity.current === owner)
        setError(failure instanceof Error ? failure.message : "The watchlist could not be read.");
      return false;
    } finally {
      if (importController.current === controller) {
        importController.current = null;
        setImporting(null);
        setProgress("");
      }
    }
  }
  useEffect(
    () => () => {
      importController.current?.abort();
    },
    [],
  );
  return {
    value,
    choices,
    active,
    accepted,
    panel,
    setPanel,
    loading,
    busy,
    listLoading,
    error,
    notice,
    storageError,
    importing,
    progress,
    update,
    toggle,
    reload,
    perform,
    addTemporary,
    cancelImport: () => importController.current?.abort(),
    mine,
    account,
    films,
    matchesFilm,
    matchMap,
    listSets,
    watchlists: watchlists?.id === id ? watchlists.lists : [],
  };
}
export type FriendsModel = ReturnType<typeof useFriendsModel>;
export const FriendsContext = createContext<FriendsModel | null>(null);
export const useFriendContext = () => useContext(FriendsContext);
