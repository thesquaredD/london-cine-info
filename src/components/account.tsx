import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { accountApi, type AccountState } from "../lib/account";
import { useFriendContext } from "../lib/friends";
import { normalizeUsername } from "../shared/friends";
import type { CinemasState } from "../lib/cinemas";
import type { DataMeta } from "../shared/data";
import { usePreferenceFocus } from "../lib/preference-focus";
import { PageLink } from "./page-link";
function time(stamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(stamp * 1000));
}
function useNow() {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}
export function AccountFeedback({
  account,
  showError = true,
  showNotice = true,
}: {
  account: AccountState;
  showError?: boolean;
  showNotice?: boolean;
}) {
  return (
    <>
      {account.error && showError && (
        <div class="account-notice" role="alert">
          <p>{account.error}</p>
          <button disabled={!!account.busy} onClick={() => void account.reload()}>
            Try loading account again
          </button>
        </div>
      )}
      {account.notice && showNotice && (
        <div class="account-notice" role={account.notice.kind === "error" ? "alert" : "status"}>
          <p>{account.notice.message}</p>
          {account.notice.retryAt && (
            <p>Try again after {time(account.notice.retryAt)} (London time).</p>
          )}
          <button aria-label="Dismiss account message" onClick={account.dismissNotice}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
export function ImportStatus({ account, matches }: { account: AccountState; matches?: number }) {
  const user = account.user;
  if (!user?.username) return null;
  const sync = user.sync;
  const active = account.busy === "refresh" || user.pending;
  const state =
    account.busy === "refresh"
      ? "submitting"
      : (sync?.state ??
        (user.pending ? "queued" : user.stale ? "failed" : user.fetchedAt ? "completed" : "idle"));
  const message = {
    submitting: "Requesting your import…",
    queued: "Import queued. Waiting for a place in the import queue. You can keep browsing.",
    importing:
      "Importing your public Letterboxd watchlist. You can keep browsing; results update when it finishes.",
    completed:
      matches === undefined
        ? `Imported ${user.count} ${user.count === 1 ? "film" : "films"}.`
        : `${matches} of your ${user.count} watchlist ${user.count === 1 ? "film is" : "films are"} screening in London.`,
    failed: sync?.error ?? "The latest import failed. Please try again later.",
    idle: "Your watchlist has not been imported yet. Choose Import watchlist to get started.",
  }[state];
  return (
    <section class={`import-status import-${state}`} aria-label="Watchlist import">
      <p
        role={state === "failed" ? "alert" : "status"}
        aria-live={state === "failed" ? "assertive" : "polite"}
      >
        {message}
      </p>
      {user.fetchedAt && (
        <p>
          Last successful import: {time(user.fetchedAt)} (London time).
          {active || user.stale ? " Showing your last good watchlist." : ""}
        </p>
      )}
      {user.stale && state !== "failed" && !active && (
        <p role="status">
          These results are overdue for an update. Refresh to check the latest list.
        </p>
      )}
      {state === "completed" && user.count === 0 && (
        <p>Your public watchlist is empty. Add films on Letterboxd, then refresh here.</p>
      )}
      {state === "completed" && user.count > 0 && matches === 0 && (
        <p>
          None of your imported films currently have London screenings. Check back when the
          programme updates.
        </p>
      )}
      {(user.pending || state === "failed") && (
        <button disabled={!!account.busy} onClick={() => void account.reload()}>
          Check import status
        </button>
      )}
    </section>
  );
}
export function RefreshButton({
  account,
  disabled = false,
}: {
  account: AccountState;
  disabled?: boolean;
}) {
  const now = useNow();
  const retryAt = Math.max(
    account.user?.sync?.retryAt ?? 0,
    account.notice?.action === "refresh" ? (account.notice.retryAt ?? 0) : 0,
  );
  const cooling = retryAt > now;
  return (
    <div class="refresh-action">
      <button
        disabled={disabled || !!account.busy || !!account.user?.pending || cooling}
        onClick={() =>
          void account.perform(
            "refresh",
            async () => {
              await accountApi("/api/watchlist/refresh", "POST", {});
              await account.reload();
            },
            "Import requested. Check the watchlist import status for progress.",
          )
        }
      >
        {account.busy === "refresh"
          ? "Requesting import…"
          : account.user?.pending
            ? "Import in progress"
            : account.user?.fetchedAt
              ? "Refresh now"
              : "Import watchlist"}
      </button>
      {cooling && !account.user?.pending && (
        <p>Next import available after {time(retryAt)} (London time).</p>
      )}
    </div>
  );
}
function PreferenceSection({
  id,
  title,
  children,
}: {
  id: string;
  title: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <section class="pref-section" id={id} tabIndex={-1} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>{title}</h3>
      {children}
    </section>
  );
}

export function AccountPage({
  account,
  matches,
  onNavigate,
  onManageCinemas,
  cinemas,
  meta,
}: {
  account: AccountState;
  matches?: number;
  onNavigate: (path: string) => void;
  onManageCinemas: () => void;
  cinemas: CinemasState;
  meta: DataMeta | null;
}) {
  const friends = useFriendContext();
  const article = usePreferenceFocus(!account.loading);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [appUsername, setAppUsername] = useState("");
  const [weekday, setWeekday] = useState("off");
  const [friendsDigest, setFriendsDigest] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState("");
  const saveLock = useRef(false);
  const [friendOwner, setFriendOwner] = useState<"save" | "emails" | null>(null);
  const confirmation = useRef<HTMLParagraphElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const wasDeleting = useRef(false);
  const now = useNow();
  useEffect(
    () => setUsername(account.user?.username ?? ""),
    [account.user?.id, account.user?.username],
  );
  useEffect(
    () =>
      setWeekday(account.user?.digestWeekday == null ? "off" : String(account.user.digestWeekday)),
    [account.user?.id, account.user?.digestWeekday],
  );
  useEffect(
    () => setAppUsername(friends?.value.appUsername ?? ""),
    [account.user?.id, friends?.value.appUsername],
  );
  useEffect(
    () => setFriendsDigest(friends?.value.friendsDigest ?? true),
    [account.user?.id, friends?.value.friendsDigest],
  );
  useEffect(() => {
    setDeleting(false);
    setFriendOwner(null);
  }, [account.user?.id]);
  useEffect(() => {
    if (deleting) confirmation.current?.focus();
    else if (wasDeleting.current) deleteButton.current?.focus();
    wasDeleting.current = deleting;
  }, [deleting]);
  const appDirty =
    !!friends && normalizeUsername(appUsername) !== (friends.value.appUsername ?? "");
  const usernameDirty = username.trim() !== (account.user?.username ?? "");
  const profileDirty = appDirty || usernameDirty;
  const weekdayDirty =
    weekday !== (account.user?.digestWeekday == null ? "off" : String(account.user.digestWeekday));
  const digestDirty = !!friends && friendsDigest !== friends.value.friendsDigest;
  const emailsDirty = weekdayDirty || digestDirty;
  const busy = !!account.busy || !!friends?.busy || !!saving;
  const cooling = (account.notice?.retryAt ?? 0) > now;
  const owned =
    account.user && ["save", "emails", "refresh", "delete"].includes(account.notice?.action ?? "");
  const feedback = (action: string) => (
    <>
      <AccountFeedback
        account={account}
        showError={false}
        showNotice={account.notice?.action === action}
      />
      {friendOwner === action && friends?.error && <p role="alert">{friends.error}</p>}
      {friendOwner === action && friends?.notice && <p role="status">{friends.notice}</p>}
    </>
  );
  async function saveProfile() {
    if (saveLock.current || busy || !profileDirty) return;
    saveLock.current = true;
    setSaving("save");
    setFriendOwner(null);
    account.dismissNotice();
    try {
      if (appDirty && friends) {
        setFriendOwner("save");
        if (
          !(await friends.perform(
            "/api/friends/profile",
            "PUT",
            { username: normalizeUsername(appUsername) },
            "",
          ))
        )
          return;
      }
      await account.perform(
        "save",
        async () => {
          if (usernameDirty) {
            await accountApi("/api/me", "PUT", { username: username.trim() });
            await account.reload();
          }
        },
        usernameDirty && username.trim() && !account.user?.fetchedAt
          ? "Profile saved. Choose Import watchlist below to fetch your public list."
          : "Profile saved.",
      );
    } finally {
      saveLock.current = false;
      setSaving("");
    }
  }
  async function saveEmails() {
    if (saveLock.current || busy || !emailsDirty) return;
    saveLock.current = true;
    setSaving("emails");
    setFriendOwner(null);
    account.dismissNotice();
    try {
      // Finish the first partial update before attempting the second.
      if (
        weekdayDirty &&
        !(await account.perform(
          "emails",
          async () => {
            await accountApi("/api/me", "PUT", {
              digestWeekday: weekday === "off" ? null : Number(weekday),
            });
            await account.reload();
          },
          "Email preferences saved.",
        ))
      )
        return;
      if (digestDirty && friends) {
        setFriendOwner("emails");
        account.dismissNotice();
        if (!(await friends.perform("/api/friends/profile", "PUT", { friendsDigest }, ""))) return;
        await account.perform("emails", async () => {}, "Email preferences saved.");
      }
    } finally {
      saveLock.current = false;
      setSaving("");
    }
  }
  const venueNames = cinemas.venues
    .map((id) => meta?.venues.find((venue) => venue.id === id)?.name)
    .filter(Boolean);
  return (
    <article ref={article} class="pref-page" aria-labelledby="pref-title">
      <h2 id="pref-title" tabIndex={-1}>
        {account.loading || account.user ? "Account" : "Sign in"}
      </h2>
      <AccountFeedback
        account={account}
        showNotice={!owned && account.notice?.action !== "signin"}
      />
      {!friendOwner && friends?.error && (
        <div role="alert">
          <p>{friends.error}</p>
          <button disabled={busy} onClick={() => void friends.reload()}>
            Try loading friends again
          </button>
        </div>
      )}
      {account.loading ? (
        <p role="status">Checking sign-in…</p>
      ) : account.user ? (
        <>
          <p class="pref-lede">Signed in as {account.user.email}</p>
          <PreferenceSection id="profile" title="Profile">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveProfile();
              }}
            >
              <fieldset disabled={busy || !!friends?.loading}>
                <div class="profile-fields">
                  {friends && (
                    <div class="pref-field">
                      <label for="app-username">App username</label>
                      <input
                        id="app-username"
                        value={appUsername}
                        maxLength={30}
                        autoComplete="off"
                        aria-describedby="app-username-help"
                        onInput={(event) => setAppUsername(event.currentTarget.value)}
                      />
                      <p class="pref-hint" id="app-username-help">
                        Friends add you by this name.
                      </p>
                    </div>
                  )}
                  <div class="pref-field">
                    <label for="account-username">Letterboxd username</label>
                    <input
                      id="account-username"
                      value={username}
                      maxLength={30}
                      autoComplete="off"
                      aria-describedby="username-help"
                      onInput={(event) => setUsername(event.currentTarget.value)}
                    />
                    <p class="pref-hint" id="username-help">
                      Your public profile name, not a URL. Changing it removes the previous imported
                      list.
                    </p>
                  </div>
                </div>
                <div class="pref-save">
                  <button
                    disabled={!profileDirty || (cooling && account.notice?.action === "save")}
                  >
                    {saving === "save" ? "Saving…" : "Save profile"}
                  </button>
                  <span role="status">
                    {profileDirty ? "Unsaved changes" : "No unsaved changes"}
                  </span>
                </div>
              </fieldset>
            </form>
            {feedback("save")}
          </PreferenceSection>
          <PreferenceSection
            id="watchlist"
            title={
              <>
                Watchlist <small>Public Letterboxd list</small>
              </>
            }
          >
            {feedback("refresh")}
            <ImportStatus account={account} matches={matches} />
            {account.user.username ? (
              <RefreshButton account={account} disabled={profileDirty || busy} />
            ) : (
              <p>Choose a Letterboxd username above to import your public watchlist.</p>
            )}
            {account.user.fetchedAt && (
              <PageLink href="/watchlist" onNavigate={onNavigate}>
                View your watchlist
              </PageLink>
            )}
          </PreferenceSection>
          <PreferenceSection id="emails" title="Emails">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveEmails();
              }}
            >
              <fieldset disabled={busy || !!friends?.loading}>
                <label for="account-digest">Weekly screening email</label>
                <select
                  id="account-digest"
                  value={weekday}
                  onChange={(event) => setWeekday(event.currentTarget.value)}
                >
                  <option value="off">Off</option>
                  {[
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ].map((name, index) => (
                    <option key={name} value={index}>
                      {name}
                    </option>
                  ))}
                </select>
                {!account.user.username && (
                  <p class="pref-hint">
                    A saved Letterboxd username is required for weekly emails.
                  </p>
                )}
                {friends && (
                  <>
                    <label class="pref-checkbox">
                      <input
                        type="checkbox"
                        checked={friendsDigest}
                        disabled={!friends.value.appUsername}
                        aria-describedby={
                          !friends.value.appUsername ? "friends-digest-help" : undefined
                        }
                        onChange={(event) => setFriendsDigest(event.currentTarget.checked)}
                      />
                      Include films in common with friends
                    </label>
                    {!friends.value.appUsername && (
                      <p class="pref-hint" id="friends-digest-help">
                        Choose an app username above to enable this.
                      </p>
                    )}
                  </>
                )}
                <div class="pref-save">
                  <button
                    disabled={!emailsDirty || (cooling && account.notice?.action === "emails")}
                  >
                    {saving === "emails" ? "Saving…" : "Save emails"}
                  </button>
                  <span role="status">
                    {emailsDirty ? "Unsaved changes" : "No unsaved changes"}
                  </span>
                </div>
              </fieldset>
            </form>
            {feedback("emails")}
            <p class="pref-hint">
              Sent to {account.user.email}. Every email has an unsubscribe link.
            </p>
          </PreferenceSection>
        </>
      ) : (
        <>
          <p class="pref-lede">A link in your email signs you in. No password.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void account.perform(
                "signin",
                async () => {
                  await accountApi("/api/auth/request", "POST", { email });
                },
                "Check your email for a sign-in link. It expires in 15 minutes. Check your spam folder if it does not arrive.",
              );
            }}
          >
            <fieldset disabled={busy}>
              <label for="account-email">Email</label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onInput={(event) => setEmail(event.currentTarget.value)}
              />
              <button disabled={cooling && account.notice?.action === "signin"}>
                {account.busy === "signin" ? "Sending link…" : "Send sign-in link"}
              </button>
            </fieldset>
          </form>
          <AccountFeedback
            account={account}
            showError={false}
            showNotice={account.notice?.action === "signin"}
          />
          <PreferenceSection id="benefits" title="With an account">
            <p>Import your public Letterboxd watchlist to see what is screening in London.</p>
            <p>Keep friends for next time and find films in common.</p>
            <p>Choose an optional weekly email with screenings from your watchlist.</p>
          </PreferenceSection>
        </>
      )}
      {!account.loading && (
        <PreferenceSection id="cinemas" title="Favourite cinemas">
          {account.user ? (
            <>
              <p>
                {cinemas.venues.length} {cinemas.venues.length === 1 ? "cinema" : "cinemas"}{" "}
                selected.
              </p>
              {venueNames.length > 0 && (
                <p>
                  {venueNames.slice(0, 3).join(", ")}
                  {venueNames.length > 3 ? ` and ${venueNames.length - 3} more` : ""}
                </p>
              )}
            </>
          ) : (
            <p>Chosen for this browser. Sign in to keep them on your account.</p>
          )}
          <button aria-haspopup="dialog" disabled={busy || !meta} onClick={onManageCinemas}>
            Manage cinemas
          </button>
        </PreferenceSection>
      )}
      {!account.loading && account.user && (
        <PreferenceSection id="delete" title="Delete account">
          {feedback("delete")}
          {deleting ? (
            <>
              <p ref={confirmation} tabIndex={-1}>
                Permanently delete your account, saved screenings, favourite cinemas, imported
                watchlist and email settings? This cannot be undone.
              </p>
              <div class="account-actions">
                <button disabled={busy} onClick={() => setDeleting(false)}>
                  Cancel
                </button>
                <button
                  class="danger-action"
                  disabled={busy}
                  onClick={() =>
                    void account.perform(
                      "delete",
                      async () => {
                        await accountApi("/api/me", "DELETE", {});
                        account.clear();
                        onNavigate("/");
                      },
                      "Your account and watchlist were deleted.",
                    )
                  }
                >
                  {account.busy === "delete" ? "Deleting…" : "Confirm deletion"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                Delete your account, saved screenings, favourite cinemas, imported watchlist and
                email settings. This cannot be undone.
              </p>
              <button
                ref={deleteButton}
                class="danger-action"
                disabled={busy}
                onClick={() => {
                  account.dismissNotice();
                  setDeleting(true);
                }}
              >
                Delete account…
              </button>
            </>
          )}
        </PreferenceSection>
      )}
    </article>
  );
}
export function TokenPage({
  kind,
  onSignedIn,
}: {
  kind: "verify" | "unsubscribe";
  onSignedIn: () => Promise<void>;
}) {
  const [token] = useState(() => new URL(location.href).searchParams.get("token") ?? "");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  useEffect(() => {
    history.replaceState(null, "", location.pathname);
  }, []);
  const verify = kind === "verify";
  return (
    <article class="about-page">
      <h2>{verify ? "Sign in to London Ciné Info" : "Unsubscribe from screening emails"}</h2>
      <p>
        {verify
          ? "Confirm to sign in. Your link expires after 15 minutes and can be used once."
          : "Confirm to turn off weekly screening emails. Your account and watchlist stay available."}
      </p>
      <button
        disabled={busy || done || !token}
        onClick={async () => {
          setBusy(true);
          try {
            await accountApi(`/api/${verify ? "auth/verify" : "unsubscribe"}`, "POST", { token });
            setDone(true);
            if (verify) {
              await onSignedIn();
              location.assign("/watchlist");
            } else setMessage("You are unsubscribed.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Please try again");
          } finally {
            setBusy(false);
          }
        }}
      >
        {verify ? "Confirm sign-in" : "Unsubscribe"}
      </button>
      <p role="status">
        {message ||
          (!token ? "This link is incomplete. Please open the full link from your email." : "")}
      </p>
      <a href="/">Back to screenings</a>
    </article>
  );
}
export function Privacy({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <article class="about-page">
      <h2>Privacy</h2>
      <p>
        Browsing screenings does not require an account. If you sign in, we store your email
        address, app username, friendships and requests, Letterboxd username, imported public
        watchlist, email preferences, saved screenings and a record of films included in screening
        emails.
      </p>
      <p>
        A secure, HttpOnly session cookie keeps you signed in for 90 days after your last visit. It
        is strictly necessary for accounts. Filters are in the page URL; theme choices last for this
        visit. Guest favourite cinemas and a random browser preference identifier are saved in local
        storage. Signed-in favourites are saved to your account, with a receipt preventing repeat
        guest merges. Account favourites stay separate from guest preferences and are removed on
        account deletion. Clear browser site data to remove guest favourites. Shared My cinemas
        links include the selected venue IDs. Temporary Letterboxd comparisons and watchlist
        selections stay in session storage, separately for each signed-in account or guest session.
        Public watchlist pages are cached on the server for up to one hour. We use no advertising or
        analytics cookies.
      </p>
      <p>
        Cloudflare hosts the site and account data. Resend delivers sign-in links and any weekly
        emails you opt into. GitHub Actions runs watchlist imports and screening updates. Letterboxd
        receives requests for your public watchlist; posters and external links contact their
        providers.
      </p>
      <p>
        We use PostHog EU Cloud to understand visitor growth and improve the site. Analytics uses a
        random identifier stored in your browser and, after sign-in, an opaque account ID to connect
        visits. We record page visits, referral domains and campaign labels, search text and result
        counts, filter choices, film views, booking-link clicks, account and friendship milestones,
        shared-watchlist use and import outcomes, plus page-leave timing, scroll depth and page
        performance measurements. We do not send your email, app or Letterboxd usernames, friend
        identities or sign-in tokens to PostHog. We do not record your screen or replay sessions.
        Browser analytics respects Do Not Track. Earlier searches cannot be recovered.
      </p>
      <p>
        Weekly screening emails are optional and off by default. Unsubscribe using a link in any
        email or turn them off in{" "}
        <PageLink href="/account#emails" onNavigate={onNavigate}>
          Account
        </PageLink>
        . Delete account removes your account, sessions, watchlist friendships, requests, saved
        screenings and alert history from the active database immediately. Hosting providers may
        retain routine security logs or backups under their own retention policies.
      </p>
      <p>
        To correct your data, change your{" "}
        <PageLink href="/account#profile" onNavigate={onNavigate}>
          username
        </PageLink>{" "}
        or{" "}
        <PageLink href="/account#emails" onNavigate={onNavigate}>
          email preferences
        </PageLink>{" "}
        in Account. You can sign out in the sidebar or{" "}
        <PageLink href="/account#delete" onNavigate={onNavigate}>
          delete your account
        </PageLink>{" "}
        at any time. Sign-in tokens expire after 15 minutes; expired sessions and hashed
        request-limit records are removed by scheduled maintenance.
      </p>
      <p>
        This is a personal, non-commercial service. For a privacy question,{" "}
        <a href="https://github.com/thesquaredD/london-cine-info/issues/new">
          contact the maintainer
        </a>
        ; do not include private account details in a public issue.
      </p>
    </article>
  );
}
