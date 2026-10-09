import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { accountApi, AccountError, type AccountState } from "./account";
export const CINEMA_STORAGE = "london-cine.cinemas.v1";
type Guest = { browserId: string; venues: string[] };
type Preferences = { venues: string[]; version: number };
export function validVenues(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 1000 &&
    value.every((id) => typeof id === "string" && /^[a-zA-Z0-9._:-]{1,160}$/.test(id))
  );
}
function readGuest(): Guest {
  try {
    const value = JSON.parse(localStorage.getItem(CINEMA_STORAGE) ?? "null");
    if (value && /^[a-f0-9-]{36}$/.test(value.browserId) && validVenues(value.venues)) return value;
  } catch {
    /* Storage may be blocked; keep preferences in memory for this visit. */
  }
  return { browserId: crypto.randomUUID(), venues: [] };
}
export function useCinemas(account: AccountState) {
  const [guest, setGuest] = useState(readGuest);
  const [remote, setRemote] = useState<(Preferences & { userId: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const guestRef = useRef(guest);
  guestRef.current = guest;
  const id = account.user?.id ?? null;
  const identity = useRef(id);
  const identityEpoch = useRef(0);
  if (identity.current !== id) identityEpoch.current++;
  identity.current = id;
  const generation = useRef(0);
  const lock = useRef<number | undefined>(undefined);
  const desired = useRef<{ id: string | null; venues: string[] } | null>(null);
  const acknowledged = useRef<(Preferences & { userId: string }) | null>(null);
  const [pending, setPending] = useState<{ id: string | null; venues: string[] } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  function persist(value: Guest) {
    try {
      localStorage.setItem(CINEMA_STORAGE, JSON.stringify(value));
      setStorageError("");
      return true;
    } catch {
      setStorageError(
        "Browser storage is unavailable. Your guest cinemas will last only for this visit.",
      );
      return false;
    }
  }
  const reload = useCallback(
    async (replacePending = false) => {
      const current = ++generation.current;
      if (!id) {
        setRemote(null);
        setError("");
        setLoading(false);
        return true;
      }
      setLoading(true);
      try {
        const value = guestRef.current;
        // Persist the browser identity even when no guest cinemas have been chosen yet.
        persist(value);
        const result = await accountApi<Preferences>("/api/cinemas", "POST", {
          browserId: value.browserId,
          venues: value.venues,
        });
        if (!validVenues(result.venues) || !Number.isInteger(result.version))
          throw new Error("Saved cinemas could not be read. Please retry.");
        if (
          current !== generation.current ||
          identity.current !== id ||
          (desired.current?.id === id && !replacePending)
        )
          return;
        if (replacePending) {
          desired.current = null;
          setPending(null);
          setConflict(false);
          setSaved(false);
        }
        acknowledged.current = { ...result, userId: id };
        setRemote({ ...result, userId: id });
        setError("");
        return result;
      } catch (failure) {
        if (current === generation.current && identity.current === id)
          setError(
            failure instanceof Error ? failure.message : "Your cinemas could not be loaded.",
          );
        return false;
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [id],
  );
  useEffect(() => {
    desired.current = null;
    setPending(null);
    setConflict(false);
    setError("");
    setSaved(false);
    setBusy(false);
    void reload();
    return () => {
      generation.current++;
    };
  }, [reload]);
  useEffect(() => {
    const focus = () => {
      if (lock.current === undefined && !desired.current) void reload();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === CINEMA_STORAGE && !desired.current) {
        setGuest(readGuest());
      }
    };
    window.addEventListener("focus", focus);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", storage);
    };
  }, [reload]);
  const flush = async () => {
    const savingId = identity.current;
    const epoch = identityEpoch.current;
    if (lock.current === epoch || account.loading || conflict) return false;
    lock.current = epoch;
    setBusy(true);
    setError("");
    try {
      while (desired.current?.id === savingId && identityEpoch.current === epoch) {
        const target = desired.current;
        if (savingId) {
          const previous = acknowledged.current;
          if (!previous || previous.userId !== savingId)
            throw new Error("Reload your saved cinemas before saving.");
          const result = await accountApi<Preferences>("/api/cinemas", "PUT", {
            venues: target.venues,
            version: previous.version,
          });
          if (identityEpoch.current !== epoch) return false;
          if (!validVenues(result.venues) || !Number.isInteger(result.version))
            throw new Error("Saved cinemas could not be read. Please retry.");
          generation.current++;
          acknowledged.current = { ...result, userId: savingId };
          setRemote(acknowledged.current);
        } else {
          const value = { ...guestRef.current, venues: target.venues };
          guestRef.current = value;
          setGuest(value);
          if (!persist(value)) return false;
        }
        if (desired.current === target) {
          desired.current = null;
          setPending(null);
          setSaved(true);
        }
      }
      return true;
    } catch (failure) {
      if (identityEpoch.current === epoch) {
        setConflict(failure instanceof AccountError && failure.status === 409);
        setError(failure instanceof Error ? failure.message : "Your cinemas could not be saved.");
      }
      return false;
    } finally {
      if (lock.current === epoch) lock.current = undefined;
      if (identityEpoch.current === epoch) setBusy(false);
    }
  };
  const save = (venues: string[]) => {
    if (
      account.loading ||
      loading ||
      (id && acknowledged.current?.userId !== id) ||
      !validVenues(venues)
    )
      return Promise.resolve(false);
    const value = { id, venues: [...new Set(venues)] };
    desired.current = value;
    setPending(value);
    setSaved(false);
    return flush();
  };
  const discardAndReload = () => reload(true);
  const retry = () => (desired.current ? flush() : reload());
  return {
    venues:
      pending?.id === id
        ? pending.venues
        : id
          ? remote?.userId === id
            ? remote.venues
            : []
          : guest.venues,
    loading: account.loading || loading || (!!id && remote?.userId !== id),
    busy,
    error,
    storageError,
    save,
    reload: discardAndReload,
    retry,
    conflict,
    saved,
    signedIn: !!id,
  };
}
export type CinemasState = ReturnType<typeof useCinemas>;
