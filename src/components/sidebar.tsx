import { useFriendContext } from "../lib/friends";
import type { ComponentChildren } from "preact";
import { accountApi } from "../lib/account";
import { PageLink } from "./page-link";
import type { AccountState } from "../lib/account";
import type { DataMeta } from "../shared/data";
import { PAGES, defaultSort, viewUrl, hasCustomSort, type ViewState } from "../lib/catalogue";

function NavLink({
  path,
  children,
  className,
  state,
  onChange,
}: {
  path: string;
  children: ComponentChildren;
  className?: string;
  state: ViewState;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
}) {
  return (
    <PageLink
      href={path}
      class={className}
      aria-current={state.path === path ? "page" : undefined}
      onNavigate={() => onChange({ path, page: 1 }, true)}
    >
      {children}
    </PageLink>
  );
}
type Props = {
  account: AccountState;
  state: ViewState;
  meta: DataMeta | null;
  /** The welcome page sits at "/" on a first visit but is not the All movies page. */
  welcome?: boolean;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
};
export function Sidebar({ state, meta, onChange, account, welcome = false }: Props) {
  const friends = useFriendContext();
  const count = friends?.pendingIncoming ?? 0;
  return (
    <div class="sidebar-content">
      <nav aria-label="Film pages">
        {["Discover", "For you"].map((group) => (
          <section key={group} aria-label={group}>
            <h2 class="section-label">{group}</h2>
            <div>
              {PAGES.filter(
                (page) =>
                  ["/watchlist", "/my-calendar"].includes(page.path) === (group === "For you"),
              ).map((page) => (
                <a
                  key={page.path}
                  href={viewUrl({
                    ...state,
                    path: page.path,
                    eventType: page.path === "/events" ? "highlights" : "",
                    page: 1,
                    director: "",
                    ...(!hasCustomSort(state) ? defaultSort(page.path) : {}),
                  })}
                  aria-current={!welcome && state.path === page.path ? "page" : undefined}
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
                    onChange(
                      {
                        path: page.path,
                        eventType: page.path === "/events" ? "highlights" : "",
                        page: 1,
                        director: "",
                        ...(!hasCustomSort(state) ? defaultSort(page.path) : {}),
                      },
                      true,
                    );
                  }}
                >
                  {page.name}
                </a>
              ))}
            </div>
            {group === "For you" && friends && (
              <div>
                <NavLink state={state} onChange={onChange} path="/friends" className="friends-link">
                  Friends
                  {count > 0 && (
                    <span
                      class="nav-badge"
                      aria-label={`${count} friend request${count === 1 ? "" : "s"}`}
                    >
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </NavLink>
              </div>
            )}
          </section>
        ))}
      </nav>
      <h2 class="section-label">Preferences</h2>
      <nav class="preferences-nav" aria-label="Preferences">
        {(account.loading || account.user) && (
          <NavLink state={state} onChange={onChange} path="/account">
            Account
          </NavLink>
        )}
        {account.user?.pending && (
          <small class="account-import" role="status">
            {account.user.sync?.state === "importing" ? "Importing watchlist…" : "Import queued…"}
          </small>
        )}
        <NavLink state={state} onChange={onChange} path="/settings">
          Settings
        </NavLink>
      </nav>
      <div class="sidebar-bottom">
        <nav class="sidebar-auth" aria-label="Account access">
          {account.loading ? (
            <span class="auth-checking" role="status">
              Checking sign-in…
            </span>
          ) : account.user ? (
            <button
              class="signout-button"
              disabled={!!account.busy}
              onClick={() =>
                void account.perform(
                  "logout",
                  async () => {
                    await accountApi("/api/auth/logout", "POST", {});
                    account.clear();
                    if (["/account", "/friends", "/watchlist", "/my-calendar"].includes(state.path))
                      onChange({ path: "/", page: 1 }, true);
                  },
                  "You are signed out.",
                )
              }
            >
              {account.busy === "logout" ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <NavLink state={state} onChange={onChange} path="/account" className="signin-link">
              Sign in
            </NavLink>
          )}
        </nav>
        <NavLink state={state} onChange={onChange} path="/how-to-use" className="about-link">
          How to use
        </NavLink>
        <NavLink state={state} onChange={onChange} path="/changelog" className="about-link">
          What’s new
        </NavLink>
        <NavLink state={state} onChange={onChange} path="/about" className="about-link">
          About & sources
        </NavLink>
        <NavLink
          state={state}
          onChange={onChange}
          path="/privacy"
          className="about-link privacy-link"
        >
          Privacy
        </NavLink>
        {meta && (
          <p class="update-note">
            Updated{" "}
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/London",
            }).format(new Date(meta.generatedAt))}
            <br />
            London time
          </p>
        )}
      </div>
    </div>
  );
}
