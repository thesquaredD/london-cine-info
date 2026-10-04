import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { accountApi, type AccountState } from "./account";
import {
  screeningKey,
  validCalendarInput,
  type CalendarInput,
  type CalendarScreening,
} from "../shared/calendar";
import { calendarFile } from "../shared/ical";
export function downloadEvents(events: CalendarScreening[]) {
  const url = URL.createObjectURL(
    new Blob([calendarFile(events)], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = events.length === 1 ? "london-screening.ics" : "london-screenings.ics";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadScreening(input: CalendarInput) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(screeningKey(input)),
  );
  const id = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  downloadEvents([{ ...input, id }]);
}
export function useCalendar(account: AccountState) {
  const userId = account.user?.id ?? null;
  const identity = useRef(userId);
  identity.current = userId;
  const [data, setData] = useState<{ userId: string; screenings: CalendarScreening[] } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0),
    lock = useRef(false);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!userId) {
      setData(null);
      setError("");
      setNotice("");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await accountApi<{ screenings: CalendarScreening[] }>("/api/calendar");
      if (
        !Array.isArray(result.screenings) ||
        !result.screenings.every(
          (event) => validCalendarInput(event) && /^[a-f0-9]{64}$/.test(event.id),
        )
      )
        throw new Error("Your calendar could not be read. Please retry.");
      if (current !== generation.current || identity.current !== userId) return;
      setData({ userId, screenings: result.screenings });
      setError("");
    } catch (failure) {
      if (current === generation.current && identity.current === userId)
        setError(failure instanceof Error ? failure.message : "Calendar service is unavailable.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    setNotice("");
    void reload();
    return () => {
      generation.current++;
    };
  }, [reload]);
  useEffect(() => {
    const focus = () => {
      if (!lock.current && !document.hidden) void reload();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [reload]);
  const screenings = data?.userId === userId ? data.screenings : [];
  async function mutate(
    input: CalendarInput | CalendarScreening,
    remove = false,
  ): Promise<boolean> {
    if (!userId || lock.current || account.loading || data?.userId !== userId) return false;
    const savingId = userId;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (remove)
        await accountApi("/api/calendar", "DELETE", { id: (input as CalendarScreening).id });
      else {
        const result = await accountApi<{ screening: CalendarScreening }>("/api/calendar", "POST", {
          screening: input,
        });
        if (!validCalendarInput(result.screening) || !/^[a-f0-9]{64}$/.test(result.screening.id))
          throw new Error("The saved screening could not be read. Reload your calendar.");
        if (identity.current !== savingId) return false;
        generation.current++;
        setData((previous) => ({
          userId: savingId,
          screenings: [
            ...(previous?.userId === savingId ? previous.screenings : []).filter(
              (event) => event.id !== result.screening.id,
            ),
            result.screening,
          ].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)),
        }));
      }
      if (identity.current !== savingId) return false;
      if (remove) {
        generation.current++;
        setData((previous) =>
          previous?.userId === savingId
            ? {
                ...previous,
                screenings: previous.screenings.filter(
                  (event) => event.id !== (input as CalendarScreening).id,
                ),
              }
            : previous,
        );
      }
      setLoading(false);
      setNotice(remove ? "Screening removed from My calendar." : "Screening saved to My calendar.");
      return true;
    } catch (failure) {
      if (identity.current === savingId)
        setError(
          failure instanceof Error ? failure.message : "Your calendar could not be updated.",
        );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    screenings,
    ready: !!userId && data?.userId === userId,
    loading: account.loading || loading,
    busy,
    error,
    notice,
    reload,
    save: (input: CalendarInput) => mutate(input),
    remove: (input: CalendarScreening) => mutate(input, true),
    find: (input: CalendarInput) =>
      screenings.find((event) => screeningKey(event) === screeningKey(input)),
    dismiss: () => setNotice(""),
  };
}
export type CalendarState = ReturnType<typeof useCalendar>;
