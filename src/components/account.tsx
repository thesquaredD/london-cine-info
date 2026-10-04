import { useEffect, useState } from "preact/hooks";
import { accountApi, type AccountState } from "../lib/account";
export function AccountPanel({ account, idPrefix }: { account: AccountState; idPrefix: string }) {
  const [email, setEmail] = useState(""),
    [username, setUsername] = useState(""),
    [weekday, setWeekday] = useState("off");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setUsername(account.user?.username ?? "");
    setWeekday(
      account.user?.digestWeekday === null || !account.user
        ? "off"
        : String(account.user.digestWeekday),
    );
  }, [account.user?.username, account.user?.digestWeekday]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please try again");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section class="account-panel" aria-label="Account">
      <h2 class="section-label">Account</h2>
      {account.loading ? (
        <p>Checking sign-in…</p>
      ) : account.user ? (
        <>
          <p class="account-email">{account.user.email}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void action(async () => {
                await accountApi("/api/me", "PUT", {
                  username,
                  digestWeekday: weekday === "off" ? null : Number(weekday),
                });
                await account.reload();
                setMessage("Account saved. Use Refresh now to import your public watchlist.");
              });
            }}
          >
            <label for={`${idPrefix}-username`}>Letterboxd username</label>
            <input
              id={`${idPrefix}-username`}
              value={username}
              maxLength={30}
              placeholder="Your public profile"
              onInput={(event) => setUsername(event.currentTarget.value)}
            />
            <label for={`${idPrefix}-digest`}>Weekly screening email</label>
            <select
              id={`${idPrefix}-digest`}
              value={weekday}
              onChange={(event) => setWeekday(event.currentTarget.value)}
            >
              <option value="off">Off</option>
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                (name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ),
              )}
            </select>
            <button disabled={busy}>Save account</button>
          </form>
          {account.user.username && (
            <>
              <button
                disabled={busy || account.user.pending}
                onClick={() =>
                  void action(async () => {
                    await accountApi("/api/watchlist/refresh", "POST", {});
                    await account.reload();
                    setMessage("Refresh queued. This page updates when it finishes.");
                  })
                }
              >
                Refresh now
              </button>
              <p>
                {account.user.pending
                  ? "Refreshing watchlist…"
                  : account.user.fetchedAt
                    ? `Last synced ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(account.user.fetchedAt * 1000))}`
                    : "Watchlist not imported yet."}
              </p>
              {account.user.stale && (
                <p role="status">Refresh failed or is overdue. Showing the last good watchlist.</p>
              )}
            </>
          )}
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await accountApi("/api/auth/logout", "POST", {});
                await account.reload();
              })
            }
          >
            Sign out
          </button>
          {confirmDelete ? (
            <>
              <p>Delete your account, watchlist and email settings permanently?</p>
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await accountApi("/api/me", "DELETE", {});
                    setConfirmDelete(false);
                    await account.reload();
                  })
                }
              >
                Confirm deletion
              </button>
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)}>Delete account</button>
          )}
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void action(async () => {
              await accountApi("/api/auth/request", "POST", { email });
              setMessage("Check your email for a sign-in link. It expires in 15 minutes.");
            });
          }}
        >
          <label for={`${idPrefix}-email`}>Email</label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="email"
            required
            value={email}
            onInput={(event) => setEmail(event.currentTarget.value)}
          />
          <button disabled={busy}>Send sign-in link</button>
          <p>Import your public Letterboxd watchlist and choose a weekly screening email.</p>
        </form>
      )}
      {(message || account.error) && <p role="status">{message || account.error}</p>}
      <a href="/privacy">Privacy</a>
    </section>
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
        address, Letterboxd username, imported public watchlist, email preferences and a record of
        films included in screening emails.
      </p>
      <p>
        A secure, HttpOnly session cookie keeps you signed in for 90 days after your last visit. It
        is strictly necessary for accounts. Filters are in the page URL; theme choices last for this
        visit. We use no advertising or analytics cookies.
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
        and alert history from the active database immediately. Hosting providers may retain routine
        security logs or backups under their own retention policies.
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
