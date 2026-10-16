import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { useFriendContext } from "../lib/friends";
import { usePreferenceFocus } from "../lib/preference-focus";
import { normalizeUsername, type Friend } from "@lci/core/friends";
import { FriendsFeedback } from "./friends";
import { PageLink } from "./page-link";

const PAGE_SIZE = 6;
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ComponentChildren;
}) {
  return (
    <section class="pref-section" id={id} tabIndex={-1} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>{title}</h3>
      {children}
    </section>
  );
}
export function FriendsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const m = useFriendContext();
  const article = usePreferenceFocus(!!m && !m.account.loading);
  const [ownHandle, setOwnHandle] = useState(m?.account.user?.username ?? "");
  const [partnerHandle, setPartnerHandle] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planningError, setPlanningError] = useState("");
  const [handle, setHandle] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [remove, setRemove] = useState<Friend | null>(null);
  useEffect(() => {
    if (remove) article.current?.querySelector<HTMLElement>(".social-remove p")?.focus();
  }, [remove?.id]);
  const setWatching = m?.setWatching;
  useEffect(() => {
    setWatching?.(true);
    return () => setWatching?.(false);
  }, [setWatching]);
  const identity = useRef(m?.account.user?.id);
  const connectedHandle = useRef(m?.account.user?.username);
  useEffect(() => {
    if (connectedHandle.current === m?.account.user?.username) return;
    connectedHandle.current = m?.account.user?.username;
    setOwnHandle(m?.account.user?.username ?? "");
  }, [m?.account.user?.username]);
  useEffect(() => {
    if (identity.current === m?.account.user?.id) return;
    identity.current = m?.account.user?.id;
    setPartnerHandle("");
    setHandle("");
    setQuery("");
    setPage(1);
    setRemove(null);
    setPlanningError("");
  }, [m?.account.user?.id]);
  if (!m) return null;
  const filtered = m.accepted.filter((f) => f.username.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const requests = (people: Friend[], incoming: boolean) =>
    people.length > 0 && (
      <Section
        id={incoming ? "requests" : "sent"}
        title={
          incoming ? `Requests · ${people.length} waiting` : `Sent requests · ${people.length}`
        }
      >
        {people.slice(0, PAGE_SIZE).map((f) => (
          <div class="social-person" key={f.id}>
            <span>@{f.username}</span>
            <div>
              {incoming && (
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
                    incoming ? "Request declined." : "Request cancelled.",
                  )
                }
              >
                {incoming ? "Decline" : "Cancel request"}
              </button>
            </div>
          </div>
        ))}
        {people.length > PAGE_SIZE && (
          <p class="filter-hint">Showing {PAGE_SIZE} requests. More appear as you respond.</p>
        )}
      </Section>
    );
  return (
    <article class="pref-page friends-page" ref={article} aria-labelledby="pref-title">
      <h2 id="pref-title" tabIndex={-1}>
        Friends
      </h2>
      {m.account.user && (
        <p class="pref-lede">
          {m.value.appUsername ? (
            <>
              You are @{m.value.appUsername} ·{" "}
              <PageLink href="/account#profile" onNavigate={onNavigate}>
                Change in Account
              </PageLink>
            </>
          ) : (
            <PageLink href="/account#profile" onNavigate={onNavigate}>
              Choose a username in Account to add friends
            </PageLink>
          )}
        </p>
      )}
      <FriendsFeedback />
      {m.notice && <p role="status">{m.notice}</p>}
      <section class="social-plan" aria-labelledby="compare-h">
        <h3 id="compare-h">Find a film together</h3>
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
              onNavigate("/");
            } finally {
              setPlanning(false);
            }
          }}
        >
          <label>
            Your Letterboxd username
            <input
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
      </section>
      {m.account.loading ? (
        <p role="status">Checking sign-in…</p>
      ) : !m.account.user ? (
        <Section id="keep" title="Keep friends for next time">
          <p>Sign in to choose a username and connect with friends.</p>
          <PageLink href="/account" onNavigate={onNavigate}>
            Sign in
          </PageLink>
        </Section>
      ) : (
        <>
          {m.loading && <p role="status">Loading friends…</p>}
          {requests(
            m.value.friends.filter((f) => f.status === "pending" && f.direction === "incoming"),
            true,
          )}
          <Section id="friends" title={`Your friends · ${m.accepted.length}`}>
            {!!m.accepted.length && (
              <div class="social-list-toolbar">
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
                <div class="social-pagination">
                  <span>
                    {filtered.length} {filtered.length === 1 ? "friend" : "friends"}
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
              </div>
            )}
            {shown.map((f) =>
              remove?.id === f.id ? (
                <div class="social-remove" key={f.id} role="group" aria-label="Remove friend">
                  <p tabIndex={-1}>
                    Remove @{f.username}? Both of you will lose access to each other’s watchlist
                    here.
                  </p>
                  <button
                    disabled={m.busy}
                    onClick={async () => {
                      if (
                        await m.perform("/api/friends", "DELETE", { id: f.id }, "Friend removed.")
                      )
                        setRemove(null);
                    }}
                  >
                    Remove friend
                  </button>{" "}
                  <button
                    disabled={m.busy}
                    onClick={() => {
                      setRemove(null);
                      requestAnimationFrame(() =>
                        article.current
                          ?.querySelector<HTMLButtonElement>(`button[data-remove="${f.id}"]`)
                          ?.focus(),
                      );
                    }}
                  >
                    Keep friend
                  </button>
                </div>
              ) : (
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
                      disabled={!f.letterboxdUsername}
                      title={
                        !f.letterboxdUsername
                          ? "This friend has not connected a Letterboxd watchlist."
                          : undefined
                      }
                      onClick={() => {
                        m.update({ selected: [`f:${f.id}`], mode: "all" });
                        onNavigate("/");
                      }}
                    >
                      See shared films
                    </button>
                    <button data-remove={f.id} onClick={() => setRemove(f)}>
                      Remove
                    </button>
                  </div>
                </div>
              ),
            )}
            {!filtered.length && (
              <p>
                {query
                  ? "No friends match that username."
                  : "Add a friend below to find films in common."}
              </p>
            )}
          </Section>
          {m.value.appUsername && (
            <Section id="add" title="Add a friend">
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
                <label for="friend-handle">App username</label>
                <div class="social-input-row">
                  <input
                    id="friend-handle"
                    value={handle}
                    maxLength={31}
                    placeholder="App username"
                    onInput={(e) => setHandle(e.currentTarget.value)}
                  />
                  <button disabled={m.busy || !handle.trim()}>Send request</button>
                </div>
                <p class="filter-hint">
                  They find you as @{m.value.appUsername}. Accepted friends can filter films by each
                  other's watchlist.
                </p>
              </form>
            </Section>
          )}
          {requests(
            m.value.friends.filter((f) => f.status === "pending" && f.direction === "outgoing"),
            false,
          )}
        </>
      )}
    </article>
  );
}
