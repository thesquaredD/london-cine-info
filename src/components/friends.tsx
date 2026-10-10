import { useEffect, useState } from "preact/hooks";
import { Dialog } from "./dialog";
import { useFriendContext } from "../lib/friends";
import { letterboxdSlug } from "../shared/account";
import type { Film } from "../shared/data";
import { normalizeUsername, type Friend } from "../shared/friends";
const PAGE_SIZE = 6;
export function WatchlistsButton() {
  const m = useFriendContext();
  if (!m) return null;
  return (
    <button
      class="watchlists-trigger"
      data-active={m.active.length > 0}
      aria-haspopup="dialog"
      onClick={() => m.setPanel("watchlists")}
    >
      <span>Watchlists</span>
      <span class="shortcut-count" style={{ visibility: m.active.length ? "visible" : "hidden" }}>
        {" "}
        · {m.active.length || 0}
      </span>
      <span class="control-caret" aria-hidden="true">
        ▾
      </span>
    </button>
  );
}
export function FriendsButton({ onOpen }: { onOpen: () => void }) {
  const m = useFriendContext();
  return (
    <button class="friends-button friends-trigger" aria-haspopup="dialog" onClick={onOpen}>
      Friends{" "}
      {m?.value.friends.some((f) => f.status === "pending" && f.direction === "incoming") && (
        <span class="friends-count">New request</span>
      )}
    </button>
  );
}
export function FilmFriends({ film }: { film: Film }) {
  const m = useFriendContext();
  if (!m) return null;
  const slug = letterboxdSlug(film.ra.lb?.url);
  const match = slug ? m.matchMap.get(slug) : null;
  const selectedNames = slug
    ? m.watchlists
        .filter(
          (w) =>
            !w.stale && m.active.includes(`f:${w.id}`) && m.listSets.get(`f:${w.id}`)?.has(slug),
        )
        .map((w) => w.username)
    : [];
  const names = [...new Set([...selectedNames, ...(match?.usernames ?? [])])].slice(0, 3);
  const temporary = slug
    ? m.choices.temporary.filter(
        (t) =>
          m.choices.selected.includes(`t:${t.username}`) &&
          m.listSets.get(`t:${t.username}`)?.has(slug),
      )
    : [];
  if (!match && !temporary.length) return null;
  return (
    <span class="film-friends">
      Watchlists: {names.map((h) => `@${h}`).join(" · ")}
      {match && match.count > names.length ? ` +${match.count - names.length} more` : ""}
      {temporary.length
        ? `${match ? " · " : ""}${temporary
            .slice(0, 2)
            .map((t) => `@${t.username} (temporary)`)
            .join(" · ")}${temporary.length > 2 ? ` +${temporary.length - 2} more` : ""}`
        : ""}
    </span>
  );
}
export function WatchlistSelections() {
  const m = useFriendContext();
  if (!m || !m.active.length) return null;
  if (m.mine && !m.choices.selected.length) return null;
  return (
    <div class="watchlist-selections" aria-label="Active watchlists">
      <span>{m.choices.mode === "all" ? "On every list:" : "On any list:"}</span>
      {m.active.map((key) => (
        <button key={key} disabled={key === "mine" && m.mine} onClick={() => m.toggle(key)}>
          {key === "mine"
            ? "My watchlist"
            : key === "friends"
              ? "Any friend"
              : key.startsWith("t:")
                ? `@${key.slice(2)} · temporary`
                : `@${m.accepted.find((f) => `f:${f.id}` === key)?.username ?? "friend"}`}
          {key === "mine" && m.mine ? "" : " ×"}
        </button>
      ))}
    </div>
  );
}
export function FriendsFeedback() {
  const m = useFriendContext();
  if (!m) return null;
  const stale = m.watchlists.filter((w) => w.stale);
  return (
    <>
      {m.listLoading && (
        <p class="view-note" role="status">
          Loading selected watchlists…
        </p>
      )}
      {m.error && (
        <div class="view-note" role="alert">
          {m.error}{" "}
          {m.retryable && <button onClick={() => void m.reload()}>Retry loading friends</button>}
        </div>
      )}
      {stale.length > 0 && (
        <p class="view-note">
          {stale.length} selected {stale.length === 1 ? "watchlist is" : "watchlists are"} out of
          date or not imported. Showing the last successful import where available.
        </p>
      )}
      {m.storageError && (
        <p class="view-note" role="status">
          {m.storageError}
        </p>
      )}
    </>
  );
}
export function FriendsDialogs({
  onNavigate,
  onAccount,
}: {
  onNavigate: () => void;
  onAccount: () => void;
}) {
  const m = useFriendContext();
  const [ownHandle, setOwnHandle] = useState("");
  const [partnerHandle, setPartnerHandle] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planningError, setPlanningError] = useState("");
  const [manageFriends, setManageFriends] = useState(false);
  const [handle, setHandle] = useState(""),
    [username, setUsername] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [addList, setAddList] = useState(false),
    [remove, setRemove] = useState<Friend | null>(null);
  useEffect(() => {
    setUsername(m?.value.appUsername ?? "");
  }, [m?.value.appUsername]);
  useEffect(() => {
    setHandle("");
    setOwnHandle(m?.account.user?.username ?? "");
    setPartnerHandle("");
    setPlanningError("");
    setManageFriends(false);
    setQuery("");
    setPage(1);
    setAddList(false);
    setRemove(null);
  }, [m?.panel]);
  if (!m) return null;
  const close = () => m.setPanel(null);
  const title = m.panel === "friends" ? "Find a film together" : "Watchlists";
  const filtered = m.accepted.filter((f) => f.username.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const pagination = (
    <div class="social-pagination">
      <span>
        {filtered.length}{" "}
        {m.panel === "friends"
          ? filtered.length === 1
            ? "friend"
            : "friends"
          : filtered.length === 1
            ? "friend watchlist"
            : "friend watchlists"}
        {query ? " matching your search" : ""}
      </span>
      <div>
        <button disabled={current === 1} onClick={() => setPage(current - 1)}>
          Previous
        </button>
        <span>
          {current} / {pages}
        </span>
        <button disabled={current === pages} onClick={() => setPage(current + 1)}>
          Next
        </button>
      </div>
    </div>
  );
  const friendRows = (people: Friend[], type: "incoming" | "outgoing") =>
    people.length > 0 && (
      <section class="social-section">
        <h3>
          {type === "incoming" ? "Friend requests" : "Sent requests"} · {people.length}
        </h3>
        {people.slice(0, PAGE_SIZE).map((f) => (
          <div class="social-person" key={f.id}>
            <span>@{f.username}</span>
            <div>
              {type === "incoming" && (
                <button
                  disabled={m.busy}
                  onClick={() =>
                    void m.perform(
                      "/api/friends",
                      "PUT",
                      { id: f.id },
                      `You and @${f.username} are now friends.`,
                    )
                  }
                >
                  Accept
                </button>
              )}
              <button
                disabled={m.busy}
                onClick={() =>
                  void m.perform(
                    "/api/friends",
                    "DELETE",
                    { id: f.id },
                    type === "incoming" ? "Request declined." : "Request cancelled.",
                  )
                }
              >
                {type === "incoming" ? "Decline" : "Cancel request"}
              </button>
            </div>
          </div>
        ))}
        {people.length > PAGE_SIZE && (
          <p class="filter-hint">Showing {PAGE_SIZE} requests. More appear as you respond.</p>
        )}
      </section>
    );
  return (
    <Dialog
      open={!!m.panel}
      title={title}
      onClose={close}
      restoreTo={() =>
        document.querySelector<HTMLElement>(
          window.matchMedia("(max-width:799px)").matches
            ? ".menu-button"
            : ".desktop-sidebar .friends-trigger",
        )
      }
      className="social-dialog"
    >
      {m.error && (
        <p role="alert">
          {m.error}{" "}
          {m.retryable && <button onClick={() => void m.reload()}>Retry loading friends</button>}
        </p>
      )}
      {m.notice && <p role="status">{m.notice}</p>}
      {m.panel === "friends" && (
        <section class="social-plan">
          {import.meta.env.VITE_UX_PREVIEW === "1" && (
            <p class="preview-notice">Design preview: username imports use sample watchlists.</p>
          )}
          <p>Find London screenings for films on both your public Letterboxd watchlists.</p>
          <form
            class="social-plan-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const first = normalizeUsername(ownHandle),
                second = normalizeUsername(partnerHandle);
              if (!first || !second || first === second) {
                setPlanningError("Enter two different Letterboxd usernames.");
                return;
              }
              setPlanning(true);
              setPlanningError("");
              try {
                for (const name of [first, second]) {
                  if (
                    !m.choices.temporary.some((t) => t.username === name) &&
                    !(await m.addTemporary(name))
                  )
                    return;
                }
                m.update({ selected: [`t:${first}`, `t:${second}`], mode: "all" });
                close();
                onNavigate();
              } finally {
                setPlanning(false);
              }
            }}
          >
            <label>
              Your Letterboxd username
              <input
                data-initial-focus
                value={ownHandle}
                disabled={planning}
                placeholder="e.g. alex_films"
                onInput={(e) => setOwnHandle(e.currentTarget.value)}
              />
            </label>
            <label>
              Their Letterboxd username
              <input
                value={partnerHandle}
                disabled={planning}
                placeholder="e.g. zoe_films"
                onInput={(e) => setPartnerHandle(e.currentTarget.value)}
              />
            </label>
            {planningError && <p role="alert">{planningError}</p>}
            {planning && <p role="status">{m.progress || "Reading watchlists…"}</p>}
            <button
              class="booking-action"
              disabled={planning || !ownHandle.trim() || !partnerHandle.trim()}
            >
              {planning ? "Finding shared films…" : "Find films in common"}
            </button>
            <p class="filter-hint">
              No account or friend request needed. These lists last for this session.
            </p>
          </form>
          <button
            class="social-manage-toggle"
            aria-expanded={manageFriends}
            onClick={() => setManageFriends(!manageFriends)}
          >
            {manageFriends ? "Hide saved friends" : "Keep friends for next time"}
          </button>
        </section>
      )}
      {m.panel === "friends" && !manageFriends ? null : m.panel === "friends" && !m.account.user ? (
        <>
          <p>Sign in to choose a username and connect with friends.</p>
          <button
            onClick={() => {
              close();
              onAccount();
            }}
          >
            Sign in
          </button>
        </>
      ) : m.panel === "friends" ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void m.perform(
                "/api/friends/profile",
                "PUT",
                { username: normalizeUsername(username) },
                "Your app username was saved.",
              );
            }}
          >
            <label for="app-username">Your app username</label>
            <div class="social-input-row">
              <input
                id="app-username"
                value={username}
                maxLength={30}
                placeholder="Choose a unique username"
                onInput={(e) => setUsername(e.currentTarget.value)}
              />
              <button
                disabled={m.busy || normalizeUsername(username) === (m.value.appUsername ?? "")}
              >
                Save username
              </button>
            </div>
            <p class="filter-hint">Separate from Letterboxd. Friends use this to find you.</p>
          </form>
          <p class="social-intro">
            Accepted friends can filter films by your watchlist and see what you have in common.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await m.perform(
                  "/api/friends",
                  "POST",
                  { username: handle },
                  `Request to @${normalizeUsername(handle)} sent.`,
                )
              )
                setHandle("");
            }}
          >
            <label for="friend-handle">Add a friend</label>
            <div class="social-input-row">
              <input
                id="friend-handle"
                data-initial-focus
                value={handle}
                maxLength={31}
                placeholder="App username"
                onInput={(e) => setHandle(e.currentTarget.value)}
              />
              <button disabled={m.busy || !m.value.appUsername}>Send request</button>
            </div>
          </form>
          {m.loading && <p role="status">Loading friends…</p>}
          {friendRows(
            m.value.friends.filter((f) => f.status === "pending" && f.direction === "incoming"),
            "incoming",
          )}
          <section class="social-section">
            <h3>Your friends · {m.accepted.length}</h3>
            <div class="social-list-toolbar" hidden={!m.accepted.length}>
              <label class="sr-only" for="friends-search">
                Search friends
              </label>
              <input
                class="social-search"
                id="friends-search"
                type="search"
                placeholder="Search friends…"
                value={query}
                onInput={(e) => {
                  setQuery(e.currentTarget.value);
                  setPage(1);
                }}
              />
              {pagination}
            </div>
            {shown.map((f) => (
              <div class="social-person" key={f.id}>
                <span>
                  <strong>@{f.username}</strong>
                  <small>
                    {f.letterboxdUsername
                      ? `Letterboxd: @${f.letterboxdUsername}`
                      : "Watchlist not connected"}
                    {f.stale ? " · Import needed" : ""}
                  </small>
                </span>
                <div>
                  <button
                    onClick={() => {
                      m.update({ selected: [`f:${f.id}`], mode: "all" });
                      close();
                      onNavigate();
                    }}
                  >
                    See shared films
                  </button>
                  <button onClick={() => setRemove(f)}>Remove</button>
                </div>
              </div>
            ))}
            {!filtered.length && (
              <p>
                {query
                  ? "No friends match that username."
                  : "Add a friend above to find films in common."}
              </p>
            )}
          </section>
          {remove && (
            <div class="social-remove" role="group" aria-label="Remove friend">
              <p>
                Remove @{remove.username}? Both of you will lose access to each other’s watchlist
                here.
              </p>
              <button
                disabled={m.busy}
                onClick={async () => {
                  if (
                    await m.perform("/api/friends", "DELETE", { id: remove.id }, "Friend removed.")
                  )
                    setRemove(null);
                }}
              >
                Remove friend
              </button>{" "}
              <button disabled={m.busy} onClick={() => setRemove(null)}>
                Keep friend
              </button>
            </div>
          )}
          {friendRows(
            m.value.friends.filter((f) => f.status === "pending" && f.direction === "outgoing"),
            "outgoing",
          )}
          <section class="social-section">
            <label>
              <input
                type="checkbox"
                checked={m.value.friendsDigest}
                disabled={m.busy || !m.value.appUsername}
                onChange={(e) =>
                  void m.perform(
                    "/api/friends/profile",
                    "PUT",
                    { friendsDigest: e.currentTarget.checked },
                    "Email preference saved.",
                  )
                }
              />{" "}
              Include films in common in my weekly email
            </label>
            <p class="filter-hint">
              Accepted friends only. Temporary Letterboxd lists are never included. Choose the
              weekly email day in Account.
            </p>
          </section>
        </>
      ) : (
        <>
          <p class="social-intro">
            Choose whose films to see. Your page, dates and cinema filters still apply.
          </p>
          <div class="watchlist-options">
            <label class="watchlist-option">
              <input
                type="checkbox"
                checked={m.active.includes("mine")}
                disabled={m.mine || !m.account.user}
                onChange={() => m.toggle("mine")}
              />
              <span>
                <strong>My watchlist</strong>
                <small>
                  {m.mine
                    ? "Included on the Watchlist page"
                    : !m.account.user
                      ? "Sign in to connect your list"
                      : "Your connected Letterboxd list"}
                </small>
              </span>
            </label>
            {m.account.user && (
              <label class="watchlist-option">
                <input
                  type="checkbox"
                  checked={m.active.includes("friends")}
                  disabled={!m.accepted.length}
                  onChange={() => m.toggle("friends")}
                />
                <span>
                  <strong>Any friend’s watchlist</strong>
                  <small>Films wanted by at least one accepted friend</small>
                </span>
              </label>
            )}
            {m.choices.temporary.map((t) => (
              <div class="social-temporary" key={t.username}>
                <label class="watchlist-option">
                  <input
                    type="checkbox"
                    checked={m.active.includes(`t:${t.username}`)}
                    onChange={() => m.toggle(`t:${t.username}`)}
                  />
                  <span>
                    <strong>@{t.username}</strong>
                    <small>Temporary Letterboxd list · {t.slugs.length} films · this session</small>
                  </span>
                </label>
                <button
                  aria-label={`Remove temporary watchlist ${t.username}`}
                  onClick={() =>
                    m.update({
                      temporary: m.choices.temporary.filter((x) => x.username !== t.username),
                      selected: m.choices.selected.filter((x) => x !== `t:${t.username}`),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          {m.accepted.length > 0 && (
            <section class="social-section">
              <div class="social-list-toolbar">
                <label for="watchlist-friend-search">Friends’ watchlists</label>
                <input
                  class="social-search"
                  id="watchlist-friend-search"
                  type="search"
                  placeholder="Search friends…"
                  value={query}
                  onInput={(e) => {
                    setQuery(e.currentTarget.value);
                    setPage(1);
                  }}
                />
                {pagination}
              </div>
              {shown.map((f) => (
                <label class="watchlist-option watchlist-friend-option" key={f.id}>
                  <input
                    type="checkbox"
                    checked={m.active.includes(`f:${f.id}`)}
                    onChange={() => m.toggle(`f:${f.id}`)}
                  />
                  <span>
                    <strong title={`@${f.username}`}>@{f.username}</strong>
                    <small>
                      {f.fetchedAt
                        ? `${f.count} films${f.stale ? " · Out of date" : ""}`
                        : "Watchlist not imported yet"}
                    </small>
                  </span>
                </label>
              ))}
            </section>
          )}
          {m.active.length > 1 && (
            <fieldset class="social-match">
              <legend>Match selected watchlists</legend>
              <label>
                <input
                  type="radio"
                  name="social-match"
                  checked={m.choices.mode === "all"}
                  onChange={() => m.update({ mode: "all" })}
                />{" "}
                All selected<small>Films on every selected list</small>
              </label>
              <label>
                <input
                  type="radio"
                  name="social-match"
                  checked={m.choices.mode === "any"}
                  onChange={() => m.update({ mode: "any" })}
                />{" "}
                Any selected
                <small>
                  Films on at least one selected list{m.mine ? ", within your own watchlist" : ""}
                </small>
              </label>
            </fieldset>
          )}
          {!addList ? (
            <button class="social-add" onClick={() => setAddList(true)}>
              + Use a Letterboxd watchlist
            </button>
          ) : (
            <form
              class="social-add-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await m.addTemporary(handle)) {
                  setAddList(false);
                  setHandle("");
                }
              }}
            >
              <label for="temporary-handle">Letterboxd username</label>
              <div class="social-input-row">
                <input
                  id="temporary-handle"
                  value={handle}
                  maxLength={31}
                  placeholder="e.g. zoe_films"
                  disabled={!!m.importing}
                  onInput={(e) => setHandle(e.currentTarget.value)}
                />
                <button disabled={!!m.importing}>Use watchlist</button>
              </div>
              <p class="filter-hint">
                Public lists only. No account needed. This does not create a friend or change your
                weekly email.
              </p>
              {m.importing && (
                <>
                  <p role="status">{m.progress}</p>
                  <button type="button" onClick={m.cancelImport}>
                    Cancel import
                  </button>
                </>
              )}
            </form>
          )}
          {m.listLoading && <p role="status">Loading selected watchlists…</p>}
          <div class="social-dialog-actions">
            <button onClick={() => m.setPanel("friends")}>Manage friends</button>
            <button class="social-primary" onClick={close}>
              Apply watchlists
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
