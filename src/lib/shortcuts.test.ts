import { describe, it, expect } from "vitest";
import { shortcutItems } from "./shortcuts";
import { readView } from "./catalogue";
import type { Account } from "../shared/account";
const user: Account = {
  id: "test",
  email: "test@example.com",
  username: "test",
  digestWeekday: null,
  fetchedAt: 1,
  count: 1,
  stale: false,
  pending: false,
};
const watchlist = { slugs: [], fetchedAt: 1, count: 0, stale: false };
const base = {
  account: { user: null, watchlist: null },
  cinemas: { venues: [], loading: false },
  state: readView(new URL("https://example.com/")),
  counts: null,
};
const labels = (input: Parameters<typeof shortcutItems>[0]) =>
  shortcutItems(input).map((item) => item.label);
describe("personalized shortcuts", () => {
  it("shows dates, independent cinemas and Nearby to a signed-out visitor", () => {
    expect(labels(base)).toEqual([
      "Today",
      "Tomorrow",
      "This weekend",
      "This week",
      "Evening",
      "Independent cinemas",
      "Near me",
    ]);
  });
  it("requires a signed-in, imported watchlist", () => {
    expect(labels({ ...base, account: { user, watchlist } })).toContain("My watchlist");
    expect(
      labels({ ...base, account: { user, watchlist: { ...watchlist, fetchedAt: null } } }),
    ).not.toContain("My watchlist");
    expect(labels({ ...base, account: { user: null, watchlist } })).not.toContain("My watchlist");
  });
  it("shows chosen cinemas and disables them while loading", () => {
    const items = shortcutItems({ ...base, cinemas: { venues: ["bfi"], loading: true } });
    expect(items.find((item) => item.id === "cinemas")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "cinemas")?.changes?.filters?.venue).toEqual(["bfi"]);
  });
  it("orders My watchlist, then the cinema group ending in Nearby", () => {
    expect(
      labels({
        ...base,
        account: { user, watchlist },
        cinemas: { venues: ["bfi"], loading: false },
      }).slice(-4),
    ).toEqual(["My watchlist", "My cinemas", "Independent cinemas", "Near me"]);
    expect(
      shortcutItems({
        ...base,
        account: { user, watchlist },
        cinemas: { venues: ["bfi"], loading: false },
      })
        .slice(-4)
        .map((item) => item.group),
    ).toEqual(["personal", "where", "where", "where"]);
  });
  it("treats Near me as a dialog opener, not a toggle", () => {
    const nearby = shortcutItems(base).find((item) => item.id === "nearby");
    expect(nearby?.active).toBeUndefined();
    expect(nearby?.changes).toBeUndefined();
  });
  it("keeps active My cinemas visible after the last venue is removed", () => {
    const items = shortcutItems({ ...base, state: { ...base.state, myCinemas: true } });
    expect(items.find((item) => item.id === "cinemas")?.active).toBe(true);
    expect(items.find((item) => item.id === "cinemas")?.changes?.myCinemas).toBe(false);
  });
});
