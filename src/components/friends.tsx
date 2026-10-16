import { useEffect, useState } from "preact/hooks";
import { Dialog } from "./dialog";
import { useFriendContext } from "../lib/friends";
import { letterboxdSlug } from "@lci/core/account";
import type { Film } from "@lci/core/data";
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
export function WatchlistsDialog({ onNavigate }: { onNavigate: (path: string) => void }) {
  const m = useFriendContext();
  const [handle, setHandle] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [addList, setAddList] = useState(false);
  useEffect(() => {
    setHandle("");
    setQuery("");
    setPage(1);
    setAddList(false);
  }, [m?.panel]);
  if (!m) return null;
  const close = () => m.setPanel(null);
  const filtered = m.accepted.filter((f) => f.username.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const pagination = (
    <div class="social-pagination">
      <span>
        {filtered.length} {filtered.length === 1 ? "friend watchlist" : "friend watchlists"}
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
  return (
    <Dialog
      open={m.panel === "watchlists"}
      title="Watchlists"
      onClose={close}
      restoreTo={() => document.querySelector<HTMLElement>(".watchlists-trigger")}
      className="watchlists-dialog"
    >
      {m.error && (
        <p role="alert">
          {m.error}{" "}
          {m.retryable && <button onClick={() => void m.reload()}>Retry loading friends</button>}
        </p>
      )}
      {m.notice && <p role="status">{m.notice}</p>}
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
      <div class="watchlists-dialog-actions">
        <button
          onClick={() => {
            close();
            onNavigate("/friends");
          }}
        >
          Manage friends
        </button>
        <button class="social-primary" onClick={close}>
          Apply watchlists
        </button>
      </div>
    </Dialog>
  );
}
