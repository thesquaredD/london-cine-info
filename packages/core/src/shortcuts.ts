import type { Account, Watchlist } from "./account";
import type { ViewState } from "./catalogue";
import type { FacetKey } from "./data";
import { dateShortcut, eveningShortcut, isEvening } from "./filters";

/** What the shortcuts read from the account; the website's and the app's hooks both provide it. */
export type ShortcutAccount = { user: Account | null; watchlist: Watchlist | null };
/** What the shortcuts read from the saved cinemas. */
export type ShortcutCinemas = { venues: readonly string[]; loading: boolean };
export type ShortcutItem = {
  id: string;
  label: string;
  group: "when" | "personal";
  /** Undefined for a shortcut that opens a dialog rather than toggling a filter. */
  active?: boolean;
  disabled?: boolean;
  title?: string;
  changes?: Partial<ViewState>;
};
export function shortcutItems({
  account,
  cinemas,
  state,
  counts,
}: {
  account: ShortcutAccount;
  cinemas: ShortcutCinemas;
  state: ViewState;
  counts: Record<FacetKey, Map<string, number>> | null;
}): ShortcutItem[] {
  const items: ShortcutItem[] = [
    { id: "today", label: "Today" },
    { id: "tomorrow", label: "Tomorrow" },
    { id: "weekend", label: "Weekend" },
    { id: "this-week", label: "Week" },
    { id: "evening", label: "Evening" },
  ].map(({ id, label }) => ({
    id,
    label,
    group: "when",
    active:
      id === "evening"
        ? isEvening(state)
        : !state.tonight &&
          state.filters.day?.length === 1 &&
          state.filters.day[0] === id &&
          !state.excluded.day?.length,
    title: `${(id === "evening" ? counts?.time.get(id) : counts?.day.get(id)) ?? 0} films`,
    changes: id === "evening" ? eveningShortcut(state) : dateShortcut(state, id),
  }));
  if (account.user && account.watchlist?.fetchedAt)
    items.push({
      id: "watchlist",
      label: "My watchlist",
      group: "personal",
      active: !!state.watchlist,
      changes: { watchlist: !state.watchlist, page: 1 },
    });
  if (cinemas.venues.length || state.myCinemas)
    items.push({
      id: "cinemas",
      label: "My cinemas",
      group: "personal",
      active: !!state.myCinemas,
      disabled: cinemas.loading,
      changes: {
        myCinemas: !state.myCinemas,
        filters: { ...state.filters, venue: state.myCinemas ? [] : [...cinemas.venues] },
        excluded: { ...state.excluded, venue: [] },
        page: 1,
      },
    });
  // Near me opens the nearby finder; it is not a toggle.
  items.push({ id: "nearby", label: "Near me", group: "personal" });
  return items;
}
