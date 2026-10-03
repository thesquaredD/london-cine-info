import type { DataMeta } from "../shared/data";
import { PAGES, type ViewState } from "../lib/catalogue";

type Props = {
  state: ViewState;
  meta: DataMeta | null;
  onChange: (changes: Partial<ViewState>, push?: boolean) => void;
  dark: boolean;
  onTheme: () => void;
  idPrefix?: string;
};
export function Sidebar({ state, meta, onChange, dark, onTheme, idPrefix = "desktop" }: Props) {
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
      <h2 class="section-label">Filters</h2>
      <div class="sidebar-fields">
        <label for={`${idPrefix}-search`}>Search</label>
        <input
          id={`${idPrefix}-search`}
          type="search"
          placeholder="Film or director…"
          value={state.search}
          onInput={(event) => onChange({ search: event.currentTarget.value, page: 1 })}
        />
        <label for={`${idPrefix}-language`}>Original language</label>
        <select
          id={`${idPrefix}-language`}
          value={state.language}
          onChange={(event) => onChange({ language: event.currentTarget.value, page: 1 })}
        >
          <option value="">All languages</option>
          {meta?.facets.language.map((language) => (
            <option key={language.id} value={language.id}>
              {language.label} ({language.count})
            </option>
          ))}
        </select>
        {(state.search || state.language || state.director) && (
          <button
            class="reset-button"
            onClick={() => onChange({ search: "", language: "", director: "", page: 1 })}
          >
            Clear filters
          </button>
        )}
      </div>
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
