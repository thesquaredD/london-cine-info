import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { accountApi, type AccountState } from "./account";
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
  identity.current = id;
  const generation = useRef(0);
  const lock = useRef(false);
  function persist(value: Guest) {
    try {
      localStorage.setItem(CINEMA_STORAGE, JSON.stringify(value));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable. Your guest cinemas will last only for this visit.",
      );
    }
  }
  const reload = useCallback(async () => {
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
      if (current !== generation.current || identity.current !== id) return;
      setRemote({ ...result, userId: id });
      setError("");
      return result;
    } catch (failure) {
      if (current === generation.current && identity.current === id)
        setError(failure instanceof Error ? failure.message : "Your cinemas could not be loaded.");
      return false;
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void reload();
    return () => {
      generation.current++;
    };
  }, [reload]);
  useEffect(() => {
    const focus = () => {
      if (!lock.current) void reload();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === CINEMA_STORAGE) {
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
  const save = async (venues: string[]) => {
    if (lock.current || account.loading) return false;
    if (!validVenues(venues)) {
      setError("Choose up to 1000 cinemas.");
      return false;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    const savingId = id;
    try {
      if (id) {
        if (!remote || remote.userId !== id)
          throw new Error("Reload your saved cinemas before saving.");
        const result = await accountApi<Preferences>("/api/cinemas", "PUT", {
          venues,
          version: remote.version,
        });
        if (identity.current !== savingId) return false;
        generation.current++;
        setRemote({ ...result, userId: id });
      } else {
        const value = { ...guestRef.current, venues: [...new Set(venues)] };
        setGuest(value);
        persist(value);
      }
      return true;
    } catch (failure) {
      if (identity.current === savingId)
        setError(failure instanceof Error ? failure.message : "Your cinemas could not be saved.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return {
    venues: id ? (remote?.userId === id ? remote.venues : []) : guest.venues,
    loading: account.loading || loading,
    busy,
    error,
    storageError,
    save,
    reload,
    signedIn: !!id,
  };
}
export type CinemasState = ReturnType<typeof useCinemas>;
