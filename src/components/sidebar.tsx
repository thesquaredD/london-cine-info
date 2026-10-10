import { FriendsButton } from "./friends";
import { AccountPanel } from "./account";
import type { AccountState } from "../lib/account";
import type { DataMeta } from "../shared/data";
import { PAGES, defaultSort, viewUrl, hasCustomSort, type ViewState } from "../lib/catalogue";

type Props = {
  onSettings: () => void;
  onFriends: () => void;
  account: AccountState;
  onAccount: () => void;
  state: ViewState;
  meta: DataMeta | null;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
};
export function Sidebar({
  state,
  meta,
  onChange,
  account,
  onAccount,
  onSettings,
  onFriends,
}: Props) {
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
                  aria-current={state.path === page.path ? "page" : undefined}
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
            {group === "For you" && <FriendsButton onOpen={onFriends} />}
          </section>
        ))}
      </nav>
      <h2 class="section-label">Preferences</h2>
      <AccountPanel account={account} onOpen={onAccount} />
      <button class="settings-button" aria-haspopup="dialog" onClick={onSettings}>
        Settings
      </button>
      <div class="sidebar-bottom">
        <a
          class="about-link"
          href="/about"
          aria-current={state.path === "/about" ? "page" : undefined}
          onClick={(event) => {
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
              return;
            event.preventDefault();
            onChange({ path: "/about", page: 1 }, true);
          }}
        >
          About & sources
        </a>
        <a
          class="about-link privacy-link"
          href="/privacy"
          aria-current={state.path === "/privacy" ? "page" : undefined}
          onClick={(event) => {
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
              return;
            event.preventDefault();
            onChange({ path: "/privacy", page: 1 }, true);
          }}
        >
          Privacy
        </a>
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
