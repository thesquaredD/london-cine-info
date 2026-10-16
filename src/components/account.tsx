import { Notice } from "./notice";
import { openFeedback } from "../lib/feedback";
import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { accountApi, type AccountState } from "../lib/account";
import { useFriendContext } from "../lib/friends";
import { normalizeUsername } from "@lci/core/friends";
import type { CinemasState } from "../lib/cinemas";
import type { DataMeta } from "@lci/core/data";
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
        <Notice
          kind="error"
          title="Your account didn't load"
          className="account-notice"
          actions={
            <>
              <button disabled={!!account.busy} onClick={() => void account.reload()}>
                Try loading account again
              </button>
              <button
                class="feedback-link"
                onClick={() => openFeedback({ context: { errorCode: "account_load" } })}
              >
                Report this problem
              </button>
            </>
          }
        >
          <p>{account.error}</p>
        </Notice>
      )}
      {account.notice && showNotice && (
        <Notice
          kind={account.notice.kind}
          className="account-notice"
          title={
            account.notice.retryAt
              ? `Try again after ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(account.notice.retryAt * 1000))}`
              : account.notice.kind === "error"
                ? "That action didn't finish"
                : account.notice.action === "signin"
                  ? "Sign-in link requested"
                  : account.notice.action === "delete"
                    ? "Account deleted"
                    : account.notice.action === "refresh"
                      ? "Import requested"
                      : "Account updated"
          }
          actions={
            <>
              <button
                class="notice-quiet"
                aria-label="Dismiss account message"
                onClick={account.dismissNotice}
              >
                Dismiss
              </button>
              {account.notice.kind === "error" && (
                <button
                  class="feedback-link"
                  onClick={() =>
                    openFeedback({
                      context: { errorCode: `account_${account.notice?.action ?? "action"}` },
                    })
                  }
                >
                  Report this problem
                </button>
              )}
            </>
          }
        >
          <p>{account.notice.message}</p>
          {account.notice.retryAt && (
            <p>Try again after {time(account.notice.retryAt)} (London time).</p>
          )}
        </Notice>
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
  const title = {
    submitting: "Requesting an import",
    queued: "Import queued",
    importing: "Importing your watchlist",
    completed: `Imported ${user.count} ${user.count === 1 ? "film" : "films"}`,
    failed: "The import failed",
    idle: "Watchlist not imported yet",
  }[state];
  return (
    <section class={`import-status import-${state}`} aria-label="Watchlist import">
      <Notice
        kind={state === "failed" ? "error" : state === "completed" ? "success" : "status"}
        title={title}
        actions={
          (user.pending || state === "failed") && (
            <button disabled={!!account.busy} onClick={() => void account.reload()}>
              Check import status
            </button>
          )
        }
      >
        <p>
          {state === "queued"
            ? message.replace("Import queued. ", "")
            : state === "completed" && matches === undefined
              ? "Your imported watchlist is ready to browse."
              : message}
        </p>
        {user.fetchedAt && (
          <p>
            Last successful import: {time(user.fetchedAt)} (London time).
            {active || user.stale ? " Showing your last good watchlist." : ""}
          </p>
        )}
        {user.stale && state !== "failed" && !active && (
          <p>These results are overdue for an update. Refresh to check the latest list.</p>
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
      </Notice>
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
      {friendOwner === action && friends?.error && (
        <Notice kind="error" title="That action didn't finish">
          <p>{friends.error}</p>
        </Notice>
      )}
      {friendOwner === action && friends?.notice && (
        <Notice kind="success" title="Account updated">
          <p>{friends.notice}</p>
        </Notice>
      )}
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
    <article ref={article} class="prose pref-page" aria-labelledby="pref-title">
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
            <ul class="prose-benefits">
              <li>
                <strong>See your watchlist on screen.</strong>
                <span>
                  Import your public Letterboxd watchlist to see what is screening in London.
                </span>
              </li>
              <li>
                <strong>Find films in common.</strong>
                <span>Keep friends for next time and find films in common.</span>
              </li>
              <li>
                <strong>Get a weekly email.</strong>
                <span>Choose an optional weekly email with screenings from your watchlist.</span>
              </li>
            </ul>
            <p>A link in your email signs you in. No password, no account needed to browse.</p>
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
    <article class="prose about-page">
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
