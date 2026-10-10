import type { AccountState } from "./account";
import type { CinemasState } from "./cinemas";
import type { ViewState } from "./catalogue";
import type { FacetKey } from "../shared/data";
import { dateShortcut, eveningShortcut, isEvening } from "./filters";

export type ShortcutItem = {
  id: string;
  label: string;
  group: "when" | "personal";
  active: boolean;
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
  account: Pick<AccountState, "user" | "watchlist">;
  cinemas: Pick<CinemasState, "venues" | "loading">;
  state: ViewState;
  counts: Record<FacetKey, Map<string, number>> | null;
}): ShortcutItem[] {
  const items: ShortcutItem[] = [
    { id: "today", label: "Today" },
    { id: "tomorrow", label: "Tomorrow" },
    { id: "weekend", label: "This weekend" },
    { id: "this-week", label: "This week" },
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
  items.push({ id: "nearby", label: "Near me", group: "personal", active: false });
  return items;
}
