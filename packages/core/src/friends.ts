export const MAX_FRIENDS = 1000;
export const MAX_SELECTED_WATCHLISTS = 20;
export const normalizeUsername = (value: string) => value.trim().replace(/^@/, "").toLowerCase();
export const validAppUsername = (value: string) => /^[a-z0-9][a-z0-9_-]{2,29}$/.test(value);
export const validLetterboxdUsername = (value: string) => /^[a-z0-9_-]{1,30}$/.test(value);
export type Friend = {
  id: string;
  username: string;
  letterboxdUsername: string | null;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
  fetchedAt: number | null;
  count: number;
  stale: boolean;
};
export type FriendsResponse = {
  friends: Friend[];
  appUsername: string | null;
  friendsDigest: boolean;
};
export type FriendWatchlist = {
  id: string;
  username: string;
  slugs: string[];
  fetchedAt: number | null;
  stale: boolean;
};
export type FriendMatch = { slug: string; count: number; usernames: string[] };
export type PublicWatchlistPage = {
  username: string;
  page: number;
  pages: number;
  count: number;
  slugs: string[];
};
