import { loadCatalogue, loadShowtimes } from "../lib/data";
import { useEffect, useState } from "preact/hooks";
import { Dialog } from "./dialog";
import { prototypeEnabled, sampleMember, useFriends } from "../lib/friends-prototype";
import type { Film } from "../shared/data";

export function WatchlistsButton() {
  const model = useFriends();
  if (!prototypeEnabled || !model) return null;
  return (
    <button
      class="watchlists-trigger"
      aria-haspopup="dialog"
      onClick={() => model.setPanel("watchlists")}
    >
      Watchlists
      <span
        class="shortcut-count"
        style={{ visibility: model.active.length ? "visible" : "hidden" }}
      >
        {" "}
        · {model.active.length || 0}
      </span>{" "}
      ▾
    </button>
  );
}
export function FriendsButton({ onOpen }: { onOpen: () => void }) {
  const model = useFriends();
  if (!prototypeEnabled) return null;
  return (
    <button class="settings-button friends-trigger" aria-haspopup="dialog" onClick={onOpen}>
      Friends <span class="friends-count">{model?.value.friends.length ?? 0}</span>
    </button>
  );
}
export function FilmFriends({ film }: { film: Film }) {
  const model = useFriends();
  if (!prototypeEnabled || !model) return null;
  const names = model.matchingPeople(film).map((p) => p.name);
  const temps = model.value.temporary.filter(
    (h) => model.value.selected.includes(h) && sampleMember(film, h),
  );
  if (!names.length && !temps.length) return null;
  return (
    <span class="film-friends">
      Watchlists: {[...names, ...temps.map((h) => `@${h} (temporary)`)].join(" · ")}
    </span>
  );
}
export function WatchlistSelections() {
  const model = useFriends();
  if (!prototypeEnabled || !model || !model.active.length) return null;
  return (
    <div class="watchlist-selections" aria-label="Active watchlists">
      <span>{model.value.mode === "all" ? "On every list:" : "On any list:"}</span>
      {model.active.map((h) => (
        <button key={h} disabled={h === "dio" && model.mine} onClick={() => model.toggle(h)}>
          {h === "dio" ? "My watchlist" : `@${h}`}
          {model.value.temporary.includes(h) ? " · temporary" : ""}
          {h === "dio" && model.mine ? "" : " ×"}
        </button>
      ))}
      {model.value.selected.length > 0 && (
        <button onClick={() => model.update({ selected: [] })}>Clear watchlists</button>
      )}
    </div>
  );
}
export function FriendsDialogs({ onNavigate }: { onNavigate: () => void }) {
  const m = useFriends();
  const [handle, setHandle] = useState("");
  const [addList, setAddList] = useState(false);
  const [error, setError] = useState("");
  const [mail, setMail] = useState<{ film: Film; lines: string[] }[]>([]);
  const [mailError, setMailError] = useState(false);
  useEffect(() => {
    if (!prototypeEnabled || m?.panel !== "email") return;
    let cancelled = false;
    setMail([]);
    setMailError(false);
    const now = Date.now(),
      end = now + 10 * 86400000;
    void loadCatalogue(new AbortController().signal)
      .then(async ({ films, meta }) => {
        const candidates = films.filter((f) => sampleMember(f, "dio") && f.sc.length).slice(0, 40);
        const cards = await Promise.all(
          candidates.map(async (film) => {
            const details = await loadShowtimes(film.id);
            const rows = Object.values(details.days)
              .flat()
              .filter((r) => r.time > now && r.time <= end)
              .sort((a, b) => a.time - b.time);
            return {
              film,
              lines: rows
                .slice(0, 2)
                .map(
                  (r) =>
                    `${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(r.time))} — ${meta.venues.find((v) => v.id === r.venue)?.name ?? "Cinema"}`,
                ),
            };
          }),
        );
        if (!cancelled) setMail(cards.filter((c) => c.lines.length));
      })
      .catch(() => {
        if (!cancelled) setMailError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [m?.panel]);
  if (!prototypeEnabled || !m) return null;
  const close = () => {
    m.setPanel(null);
    setError("");
    setHandle("");
    setAddList(false);
  };
  const title =
    m.panel === "friends" ? "Friends" : m.panel === "email" ? "Weekly email preview" : "Watchlists";
  const label = (h: string) =>
    h === "dio" ? "My watchlist" : (m.value.friends.find((p) => p.handle === h)?.name ?? `@${h}`);
  const choices = ["dio", ...m.value.friends.map((p) => p.handle), ...m.value.temporary];
  const eligible = mail.filter((c) => m.matchingPeople(c.film).length).slice(0, 3);
  const other = mail
    .filter((c) => !m.value.email || !eligible.some((e) => e.film.id === c.film.id))
    .slice(0, 2);
  return (
    <Dialog
      open={!!m.panel}
      title={title}
      onClose={close}
      className={`account-dialog social-dialog ${m.panel === "email" ? "social-email-dialog" : ""}`}
    >
      {m.panel === "watchlists" && (
        <>
          <p class="social-intro">
            Choose whose films to see. Your page, dates and cinema filters still apply.
          </p>
          <p class="filter-hint">
            Counts show films in the current catalogue, before page filters.
          </p>
          <div class="watchlist-options">
            {choices.map((h) => (
              <label class="watchlist-option" key={h}>
                <input
                  type="checkbox"
                  checked={m.active.includes(h)}
                  disabled={h === "dio" && m.mine}
                  onChange={() => m.toggle(h)}
                />
                <span>
                  <strong>{label(h)}</strong>
                  <small>
                    {h === "dio"
                      ? m.mine
                        ? "Included on the Watchlist page"
                        : "Your connected Letterboxd list"
                      : m.value.temporary.includes(h)
                        ? "Temporary Letterboxd list · this session only"
                        : `@${h} · Friend`}
                  </small>
                </span>
                <span class="social-number">
                  {m.films.filter((f) => sampleMember(f, h)).length}
                </span>
              </label>
            ))}
          </div>
          {m.active.length > 1 && (
            <fieldset class="social-match">
              <legend>Match selected watchlists</legend>
              <label>
                <input
                  type="radio"
                  name="social-match"
                  checked={m.value.mode === "all"}
                  onChange={() => m.update({ mode: "all" })}
                />{" "}
                All selected <small>Films everyone wants to see</small>
              </label>
              <label>
                <input
                  type="radio"
                  name="social-match"
                  checked={m.value.mode === "any"}
                  onChange={() => m.update({ mode: "any" })}
                />{" "}
                Any selected <small>Films at least one person wants to see</small>
              </label>
            </fieldset>
          )}
          {!addList ? (
            <button
              class="social-add"
              onClick={() => {
                setAddList(true);
                setHandle("");
                setError("");
              }}
            >
              + Use a Letterboxd watchlist
            </button>
          ) : (
            <form
              class="social-add-form"
              onSubmit={(e) => {
                e.preventDefault();
                const h = handle.trim().replace(/^@/, "").toLowerCase();
                if (!/^[a-z0-9_-]{2,30}$/.test(h)) {
                  setError("Enter a Letterboxd username, not a profile URL.");
                  return;
                }
                if (choices.includes(h)) {
                  setError("This watchlist is already available above.");
                  return;
                }
                m.update({
                  temporary: [...m.value.temporary, h],
                  selected: [...m.value.selected, h],
                });
                setAddList(false);
                setError("");
                setHandle("");
              }}
            >
              <label for="temporary-handle">Letterboxd username</label>
              <div class="social-input-row">
                <input
                  id="temporary-handle"
                  value={handle}
                  placeholder="e.g. zoe_films"
                  onInput={(e) => setHandle(e.currentTarget.value)}
                />
                <button>Use watchlist</button>
              </div>
              <p class="filter-hint">
                Public lists only. No friendship or notification. Removed when this session ends.
              </p>
              <p class="filter-hint">Prototype: any valid handle loads sample matches.</p>
              {error && <p role="alert">{error}</p>}
            </form>
          )}
          {m.value.temporary.length > 0 && (
            <div class="social-temp-actions">
              {m.value.temporary.map((h) => (
                <button
                  key={h}
                  onClick={() =>
                    m.update({
                      temporary: m.value.temporary.filter((x) => x !== h),
                      selected: m.value.selected.filter((x) => x !== h),
                    })
                  }
                >
                  Remove @{h} from session
                </button>
              ))}
            </div>
          )}
          <div class="social-dialog-actions">
            <button
              onClick={() => {
                m.setPanel("friends");
                setError("");
                setHandle("");
              }}
            >
              Manage friends
            </button>
            <button class="social-primary" onClick={close}>
              Apply watchlists
            </button>
          </div>
        </>
      )}
      {m.panel === "friends" && (
        <>
          <div class="social-identity">
            <span>Your username</span>
            <strong>@dio</strong>
          </div>
          <p class="social-intro">
            Friends can filter films by your watchlist and see what you have in common. Connect with
            their London Ciné Info username.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const h = handle.trim().replace(/^@/, "").toLowerCase();
              if (!/^[a-z0-9_-]{2,30}$/.test(h)) {
                setError("Enter an app username using letters, numbers, underscores or hyphens.");
                return;
              }
              if (
                h === "dio" ||
                m.value.friends.some((p) => p.handle === h) ||
                m.value.pending.includes(h) ||
                (h === "maya" && m.value.incoming)
              ) {
                setError("This person is already you, a friend, or a pending request.");
                return;
              }
              m.update({ pending: [...m.value.pending, h] });
              m.setStatus(`Request to @${h} is pending in this demo.`);
              setHandle("");
              setError("");
            }}
          >
            <label for="friend-handle">Add a friend</label>
            <div class="social-input-row">
              <input
                id="friend-handle"
                data-initial-focus
                value={handle}
                placeholder="App username"
                onInput={(e) => setHandle(e.currentTarget.value)}
              />
              <button>Send request</button>
            </div>
            {error && <p role="alert">{error}</p>}
          </form>
          {m.value.incoming && (
            <section class="social-section">
              <h3>Friend request</h3>
              <div class="social-person">
                <span>
                  <strong>Maya</strong>
                  <small>@maya wants to connect</small>
                </span>
                <div>
                  <button
                    onClick={() =>
                      m.update({
                        incoming: false,
                        friends: [...m.value.friends, { handle: "maya", name: "Maya" }],
                      })
                    }
                  >
                    Accept
                  </button>{" "}
                  <button onClick={() => m.update({ incoming: false })}>Decline</button>
                </div>
              </div>
            </section>
          )}
          <section class="social-section">
            <h3>Your friends · {m.value.friends.length}</h3>
            {m.value.friends.map((p) => (
              <div class="social-person" key={p.handle}>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    @{p.handle} ·{" "}
                    {
                      m.films.filter((f) => sampleMember(f, "dio") && sampleMember(f, p.handle))
                        .length
                    }{" "}
                    films in common
                  </small>
                </span>
                <div>
                  <button
                    onClick={() => {
                      m.update({ selected: [p.handle], mode: "all" });
                      close();
                      onNavigate();
                    }}
                  >
                    See shared films
                  </button>{" "}
                  <button
                    aria-label={`Remove ${p.name}`}
                    onClick={() =>
                      m.update({
                        friends: m.value.friends.filter((x) => x.handle !== p.handle),
                        selected: m.value.selected.filter((h) => h !== p.handle),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!m.value.friends.length && <p>Add your first friend above to find films in common.</p>}
          </section>
          {m.value.pending.length > 0 && (
            <section class="social-section">
              <h3>Sent requests</h3>
              {m.value.pending.map((h) => (
                <div class="social-person" key={h}>
                  <span>
                    @{h}
                    <small>Awaiting acceptance</small>
                  </span>
                  <button
                    onClick={() => m.update({ pending: m.value.pending.filter((x) => x !== h) })}
                  >
                    Cancel request
                  </button>
                </div>
              ))}
            </section>
          )}
          <section class="social-section">
            <label>
              <input
                type="checkbox"
                checked={m.value.email}
                onChange={(e) => m.update({ email: e.currentTarget.checked })}
              />{" "}
              Include friends’ shared films in my weekly email
            </label>
            <p class="filter-hint">
              Uses accepted friends only. Temporary Letterboxd lists are never included.
            </p>
            <button onClick={() => m.setPanel("email")}>Preview weekly email</button>
          </section>
          <p role="status" class="filter-hint">
            {m.status}
          </p>
        </>
      )}
      {m.panel === "email" && (
        <>
          <p class="filter-hint">
            Sample watchlists · Actual screenings in the next ten days · No email is sent
          </p>
          <div class="social-mail">
            <div class="social-mail-header">LONDON CINÉ INFO</div>
            <div class="social-mail-body">
              <h2>Your next ten days at the cinema</h2>
              {m.value.email && eligible.length > 0 && (
                <>
                  <h3>See something with friends</h3>
                  <p>These films are on your watchlist and your friends’ lists.</p>
                  {eligible.map(({ film: f, lines }) => (
                    <article key={f.id}>
                      <strong>{f.ti}</strong>
                      <span class="film-friends">
                        With{" "}
                        {m
                          .matchingPeople(f)
                          .map((p) => p.name)
                          .join(" and ")}
                      </span>
                      {lines.map((line) => (
                        <small key={line}>{line}</small>
                      ))}
                    </article>
                  ))}
                  <button
                    onClick={() => {
                      m.update({ selected: m.value.friends.map((p) => p.handle), mode: "any" });
                      close();
                      onNavigate();
                    }}
                  >
                    View shared films
                  </button>
                </>
              )}
              <h3>Also from your watchlist</h3>
              {other.map(({ film, lines }) => (
                <article key={film.id}>
                  <strong>{film.ti}</strong>
                  {lines.map((line) => (
                    <small key={line}>{line}</small>
                  ))}
                </article>
              ))}
              {!mail.length && (
                <p role="status">
                  {mailError
                    ? "Could not load the email preview. Close and reopen to retry."
                    : "Loading screening recommendations…"}
                </p>
              )}
              <p class="filter-hint">
                Screening data from Clusterflick. Availability can change; confirm with the cinema.
              </p>
              <p class="filter-hint">Unsubscribe · Change the day · Privacy</p>
            </div>
          </div>
          <button onClick={() => m.setPanel("friends")}>← Friends</button>
        </>
      )}
    </Dialog>
  );
}
