import { useEffect, useState } from "preact/hooks";
import { accountApi, type AccountState } from "../lib/account";
import { Dialog } from "./dialog";
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
}: {
  account: AccountState;
  showError?: boolean;
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
      {account.notice && (
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
    queued:
      "Import queued. Waiting for a place in the import queue. You can close Account and keep browsing.",
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
export function AccountPanel({ account, onOpen }: { account: AccountState; onOpen: () => void }) {
  return (
    <section class="account-panel" aria-label="Account">
      <button aria-haspopup="dialog" onClick={onOpen}>
        {account.user ? "Account" : "Sign in"}
      </button>
      {account.user?.pending && (
        <p role="status">
          {account.user.sync?.state === "importing" ? "Importing watchlist…" : "Import queued…"}
        </p>
      )}
      <a href="/privacy">Privacy</a>
    </section>
  );
}
export function AccountDialogs({
  account,
  open,
  matches,
  onClose,
  onNavigate,
  restoreTo,
}: {
  account: AccountState;
  open: boolean;
  matches?: number;
  onClose: () => void;
  onNavigate: (path: string) => void;
  restoreTo: () => HTMLElement | null;
}) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [weekday, setWeekday] = useState("off");
  const [deleting, setDeleting] = useState(false);
  const now = useNow();
  useEffect(() => {
    setUsername(account.user?.username ?? "");
    setWeekday(account.user?.digestWeekday == null ? "off" : String(account.user.digestWeekday));
  }, [account.user?.id, account.user?.username, account.user?.digestWeekday]);
  useEffect(() => {
    if (!open || !account.user) setDeleting(false);
  }, [open, account.user?.id]);
  const dirty =
    username.trim() !== (account.user?.username ?? "") ||
    weekday !== (account.user?.digestWeekday == null ? "off" : String(account.user.digestWeekday));
  const cooling = (account.notice?.retryAt ?? 0) > now;
  return (
    <Dialog
      open={open}
      focusKey={deleting ? "delete" : account.user ? "account" : "signin"}
      title={deleting ? "Delete account" : account.user ? "Account" : "Sign in"}
      onClose={onClose}
      restoreTo={restoreTo}
    >
      <AccountFeedback account={account} />
      {account.loading ? (
        <p role="status">Checking sign-in…</p>
      ) : account.user ? (
        deleting ? (
          <>
            <p data-initial-focus tabIndex={-1}>
              Permanently delete your account, saved screenings, favourite cinemas, imported
              watchlist and email settings? This cannot be undone.
            </p>
            <div class="account-actions">
              <button
                data-initial-focus
                disabled={!!account.busy}
                onClick={() => setDeleting(false)}
              >
                Cancel
              </button>
              <button
                class="danger-action"
                disabled={!!account.busy}
                onClick={() =>
                  void account.perform(
                    "delete",
                    async () => {
                      await accountApi("/api/me", "DELETE", {});
                      account.clear();
                      setDeleting(false);
                      onClose();
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
            <p class="account-email">Signed in as {account.user.email}</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void account.perform(
                  "save",
                  async () => {
                    await accountApi("/api/me", "PUT", {
                      username,
                      digestWeekday: weekday === "off" ? null : Number(weekday),
                    });
                    await account.reload();
                  },
                  username.trim() && !account.user?.fetchedAt
                    ? "Account saved. Choose Import watchlist to fetch your public list."
                    : "Account saved.",
                );
              }}
            >
              <fieldset disabled={!!account.busy}>
                <label for="account-username">Letterboxd username</label>
                <input
                  data-initial-focus
                  id="account-username"
                  value={username}
                  maxLength={30}
                  placeholder="Your public profile"
                  autoComplete="off"
                  aria-describedby="username-help"
                  onInput={(event) => setUsername(event.currentTarget.value)}
                />
                <p id="username-help">
                  Use your username, not a profile URL. Your watchlist must be public. Changing
                  usernames removes the previous imported list.
                </p>
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
                <p>
                  Optional emails about watchlist films screening in London. A saved username is
                  required.
                </p>
                <button disabled={!dirty || (cooling && account.notice?.action === "save")}>
                  {account.busy === "save" ? "Saving…" : "Save account"}
                </button>
              </fieldset>
              {dirty && <p role="status">You have unsaved changes. Save before importing.</p>}
            </form>
            <ImportStatus account={account} matches={matches} />
            {account.user.username && <RefreshButton account={account} disabled={dirty} />}
            {account.user.fetchedAt && (
              <a
                href="/watchlist"
                onClick={(event) => {
                  if (
                    event.button ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  onClose();
                  onNavigate("/watchlist");
                }}
              >
                View your watchlist
              </a>
            )}
            <div class="account-actions">
              <button
                disabled={!!account.busy}
                onClick={() =>
                  void account.perform(
                    "logout",
                    async () => {
                      await accountApi("/api/auth/logout", "POST", {});
                      account.clear();
                      onClose();
                    },
                    "You are signed out.",
                  )
                }
              >
                {account.busy === "logout" ? "Signing out…" : "Sign out"}
              </button>
              <button
                class="danger-action"
                disabled={!!account.busy}
                onClick={() => {
                  account.dismissNotice();
                  setDeleting(true);
                }}
              >
                Delete account
              </button>
            </div>
          </>
        )
      ) : (
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
          <p>
            Import your public Letterboxd watchlist and choose an optional weekly screening email.
          </p>
          <fieldset disabled={!!account.busy}>
            <label for="account-email">Email</label>
            <input
              data-initial-focus
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
      )}
    </Dialog>
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
export function Privacy() {
  return (
    <article class="about-page">
      <h2>Privacy</h2>
      <p>
        Browsing screenings does not require an account. If you sign in, we store your email
        address, Letterboxd username, imported public watchlist, email preferences, saved screenings
        and a record of films included in screening emails.
      </p>
      <p>
        A secure, HttpOnly session cookie keeps you signed in for 90 days after your last visit. It
        is strictly necessary for accounts. Filters are in the page URL; theme choices last for this
        visit. Guest favourite cinemas and a random browser preference identifier are saved in local
        storage. Signed-in favourites are saved to your account, with a receipt preventing repeat
        guest merges. Account favourites stay separate from guest preferences and are removed on
        account deletion. Clear browser site data to remove guest favourites. Shared My cinemas
        links include the selected venue IDs. We use no advertising or analytics cookies.
      </p>
      <p>
        Cloudflare hosts the site and account data. Resend delivers sign-in links and any weekly
        emails you opt into. GitHub Actions runs watchlist imports and screening updates. Letterboxd
        receives requests for your public watchlist; posters and external links contact their
        providers.
      </p>
      <p>
        Weekly screening emails are optional and off by default. Unsubscribe using a link in any
        email or turn them off in Account. Delete account removes your account, sessions, watchlist
        saved screenings and alert history from the active database immediately. Hosting providers
        may retain routine security logs or backups under their own retention policies.
      </p>
      <p>
        To correct your data, change your username or email preferences in Account. You can sign out
        or delete your account there at any time. Sign-in tokens expire after 15 minutes; expired
        sessions and hashed request-limit records are removed by scheduled maintenance.
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
