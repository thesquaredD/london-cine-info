import type {
  Friend,
  FriendWatchlist,
  FriendsResponse,
  FriendMatch,
  PublicWatchlistPage,
} from "../shared/friends";
import { MAX_FRIENDS, MAX_SELECTED_WATCHLISTS } from "../shared/friends";
import { AccountError } from "./account";

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, pattern: RegExp) => typeof value === "string" && pattern.test(value);
const id = (value: unknown) => text(value, /^[a-zA-Z0-9_-]{1,80}$/);
const username = (value: unknown) => text(value, /^[a-z0-9][a-z0-9_-]{2,29}$/);
const slug = (value: unknown) => text(value, /^[a-z0-9-]{1,200}$/);
const integer = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
const timestamp = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
const array = (
  value: unknown,
  max: number,
  valid: (item: unknown) => boolean,
): value is unknown[] => Array.isArray(value) && value.length <= max && value.every(valid);
const validList = (v: unknown): v is FriendWatchlist =>
  record(v) &&
  id(v.id) &&
  username(v.username) &&
  timestamp(v.fetchedAt) &&
  typeof v.stale === "boolean" &&
  array(v.slugs, 14000, slug);
const validFriend = (v: unknown): v is Friend =>
  record(v) &&
  id(v.id) &&
  username(v.username) &&
  (v.letterboxdUsername === null || typeof v.letterboxdUsername === "string") &&
  (v.status === "pending" || v.status === "accepted") &&
  (v.direction === "incoming" || v.direction === "outgoing") &&
  timestamp(v.fetchedAt) &&
  integer(v.count, 0, 14000) &&
  typeof v.stale === "boolean";
const validMatch = (v: unknown): v is FriendMatch =>
  record(v) &&
  slug(v.slug) &&
  integer(v.count, 1, MAX_FRIENDS) &&
  array(v.usernames, 3, username) &&
  v.usernames.length > 0 &&
  v.usernames.length <= Number(v.count);
function read<T>(value: unknown, valid: (value: unknown) => boolean, message: string): T {
  if (!valid(value)) throw new AccountError(message);
  return value as T;
}
export const readFriendMutation = (value: unknown) =>
  read<{ ok: true }>(
    value,
    (v) => record(v) && v.ok === true,
    "The change could not be confirmed. Reload friends before trying again.",
  );
export const readFriends = (value: unknown) =>
  read<FriendsResponse>(
    value,
    (v) =>
      record(v) &&
      (v.appUsername === null || username(v.appUsername)) &&
      typeof v.friendsDigest === "boolean" &&
      array(v.friends, MAX_FRIENDS, validFriend),
    "Friends data could not be read. Please retry.",
  );
export const readMatches = (value: unknown) =>
  read<{ matches: FriendMatch[] }>(
    value,
    (v) => record(v) && array(v.matches, 6000, validMatch),
    "Shared films could not be read. Please retry.",
  );
export const readFriendLists = (value: unknown) =>
  read<{ watchlists: FriendWatchlist[] }>(
    value,
    (v) => record(v) && array(v.watchlists, MAX_SELECTED_WATCHLISTS, validList),
    "Selected watchlists could not be read. Please retry.",
  );
export function readPublicPage(value: unknown, handle: string, page: number) {
  const result = read<PublicWatchlistPage>(
    value,
    (v) =>
      record(v) &&
      text(v.username, /^[a-z0-9_-]{1,30}$/) &&
      integer(v.page, 1, 500) &&
      integer(v.pages, 1, 500) &&
      integer(v.count, 0, 14000) &&
      array(v.slugs, 14000, slug),
    "The watchlist service returned an unexpected response. Please try again.",
  );
  if (result.username !== handle || result.page !== page || result.page > result.pages)
    throw new AccountError("The watchlist changed during import. Please try again.");
  return result;
}
