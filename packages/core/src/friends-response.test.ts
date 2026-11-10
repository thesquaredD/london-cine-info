import { expect, it } from "vitest";
import {
  readFriends,
  readFriendLists,
  readMatches,
  readPublicPage,
  readFriendMutation,
} from "./friends-response";
it("requires an explicit mutation acknowledgement before displaying a successful save", () => {
  expect(readFriendMutation({ ok: true })).toEqual({ ok: true });
  expect(() => readFriendMutation({ ok: false })).toThrow("could not be confirmed");
  expect(() => readFriendMutation({})).toThrow("Reload friends before trying again");
});

it("rejects malformed successful service responses with user-safe errors", () => {
  expect(() => readFriends({ friends: null })).toThrow("Friends data could not be read");
  expect(() => readMatches({ matches: [{ slug: "one", count: 1, usernames: null }] })).toThrow(
    "Shared films could not be read",
  );
  expect(() =>
    readFriendLists({ watchlists: [{ id: "one", slugs: "private internal detail" }] }),
  ).toThrow("Selected watchlists could not be read");
  expect(() =>
    readPublicPage(
      { username: "peer", page: 1, pages: "500", count: 1, slugs: ["one"] },
      "peer",
      1,
    ),
  ).toThrow("unexpected response");
});
it("checks public page identity, pagination bounds and film limits before installation", () => {
  const page = { username: "peer", page: 1, pages: 2, count: 2, slugs: ["one"] };
  expect(readPublicPage(page, "peer", 1)).toEqual(page);
  expect(() => readPublicPage(page, "other", 1)).toThrow("changed during import");
  expect(() => readPublicPage(page, "peer", 2)).toThrow("changed during import");
  expect(() => readPublicPage({ ...page, pages: 501 }, "peer", 1)).toThrow("unexpected response");
  expect(() => readPublicPage({ ...page, count: 14001 }, "peer", 1)).toThrow("unexpected response");
  expect(() => readPublicPage({ ...page, slugs: [null] }, "peer", 1)).toThrow(
    "unexpected response",
  );
});
it("accepts empty imported lists and validates all fields used by the UI", () => {
  expect(
    readPublicPage({ username: "peer", page: 1, pages: 1, count: 0, slugs: [] }, "peer", 1).slugs,
  ).toEqual([]);
  expect(readFriends({ appUsername: null, friendsDigest: true, friends: [] }).friends).toEqual([]);
  expect(readMatches({ matches: [] }).matches).toEqual([]);
  expect(readFriendLists({ watchlists: [] }).watchlists).toEqual([]);
});
