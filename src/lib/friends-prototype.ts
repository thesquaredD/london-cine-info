import { createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import type { Film } from "../shared/data";
import { letterboxdSlug } from "../shared/account";

export const prototypeEnabled = import.meta.env.VITE_FRIENDS_PROTOTYPE === "true";
export function sampleMember(film: Film, handle: string): boolean {
  const slug = letterboxdSlug(film.ra.lb?.url);
  if (!slug) return false;
  const hash = [...(slug + handle)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  return hash % 5 < (handle === "dio" ? 3 : 2);
}
type Person = { handle: string; name: string };
type Selection = {
  friends: Person[];
  pending: string[];
  incoming: boolean;
  temporary: string[];
  selected: string[];
  mode: "all" | "any";
  email: boolean;
};
const initial: Selection = {
  friends: [
    { handle: "alice", name: "Alice" },
    { handle: "sam", name: "Sam" },
  ],
  pending: [],
  incoming: true,
  temporary: [],
  selected: [],
  mode: "all",
  email: true,
};
export function useFriendsPrototype(
  films: Film[],
  mine: boolean,
  resetPage: () => void,
  ownFilter: boolean,
  onOwnFilter: (selected: boolean) => void,
) {
  const [value, setValue] = useState<Selection>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("friends-prototype-v1") ?? "null");
      if (saved?.friends && saved?.selected) return { ...initial, ...saved };
    } catch {
      /* A restricted browser can keep the demo in memory. */
    }
    return initial;
  });
  const [panel, setPanel] = useState<"friends" | "watchlists" | "email" | null>(null);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (prototypeEnabled) {
      try {
        sessionStorage.setItem("friends-prototype-v1", JSON.stringify(value));
      } catch {
        /* Memory-only fallback. */
      }
    }
  }, [value]);
  const update = (next: Partial<Selection>) => {
    setValue((v) => ({ ...v, ...next }));
    resetPage();
  };
  const active = [...new Set([...(mine || ownFilter ? ["dio"] : []), ...value.selected])];
  const matches = (film: Film) =>
    !prototypeEnabled ||
    !active.length ||
    ((!mine || sampleMember(film, "dio")) &&
      (value.mode === "all"
        ? active.every((h) => sampleMember(film, h))
        : active.filter((h) => !mine || h !== "dio").length === 0 ||
          active.filter((h) => !mine || h !== "dio").some((h) => sampleMember(film, h))));
  const matchingPeople = (film: Film) => value.friends.filter((p) => sampleMember(film, p.handle));
  return {
    value,
    update,
    panel,
    setPanel,
    status,
    setStatus,
    films,
    active,
    matches,
    matchingPeople,
    mine,
    toggle: (handle: string) => {
      if (handle === "dio") {
        onOwnFilter(!active.includes("dio"));
        update({ selected: value.selected.filter((h) => h !== "dio") });
      } else
        update({
          selected: value.selected.includes(handle)
            ? value.selected.filter((h) => h !== handle)
            : [...value.selected, handle],
        });
    },
  };
}
export type FriendsModel = ReturnType<typeof useFriendsPrototype>;
export const FriendsContext = createContext<FriendsModel | null>(null);
export const useFriends = () => useContext(FriendsContext);
