import { AccountPanel } from "./account";
import type { AccountState } from "../lib/account";
import type { DataMeta } from "../shared/data";
import { PAGES, type ViewState } from "../lib/catalogue";

type Props = {
  account: AccountState;
  onAccount: () => void;
  state: ViewState;
  meta: DataMeta | null;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
  dark: boolean;
  onTheme: () => void;
};
export function Sidebar({ state, meta, onChange, dark, onTheme, account, onAccount }: Props) {
  return (
    <div class="sidebar-content">
      <h2 class="section-label">Pages</h2>
      <nav aria-label="Film pages">
        {PAGES.map((page) => (
          <a
            key={page.path}
            href={page.path}
            aria-current={state.path === page.path ? "page" : undefined}
            onClick={(event) => {
              if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                return;
              event.preventDefault();
              onChange({ path: page.path, page: 1, director: "" }, true);
            }}
          >
            {page.name}
          </a>
        ))}
      </nav>
      <AccountPanel account={account} onOpen={onAccount} />
      <div class="sidebar-bottom">
        <button class="theme-button" onClick={onTheme}>
          {dark ? "☀" : "☾"} <span>{dark ? "Light mode" : "Dark mode"}</span>
        </button>
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
