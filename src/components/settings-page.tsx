import { defaultSort, type ViewState } from "@lci/core/catalogue";
import type { DisplayState } from "../lib/display";
import { usePreferenceFocus } from "../lib/preference-focus";
import type { DataMeta, Film } from "@lci/core/data";
import { DisplayControls, RatingOrderControls } from "./display-controls";
import { FilmTable } from "./film-table";

const noop = () => {};
export function SettingsPage({
  display,
  onChange,
  error,
  catalogue,
  state,
}: {
  display: DisplayState;
  onChange: (value: DisplayState) => void;
  error: string;
  catalogue: { films: Film[]; meta: DataMeta } | null;
  state: ViewState;
}) {
  const article = usePreferenceFocus();
  const film =
    catalogue?.films.find(
      (film) =>
        film.o_ti &&
        film.o_ti !== film.ti &&
        Object.values(film.ra).filter((rating) => rating?.value != null).length >= 3,
    ) ?? catalogue?.films[0];
  return (
    <article
      class="prose pref-page display-controls settings-page"
      aria-labelledby="pref-title"
      ref={article}
    >
      <h2 id="pref-title" tabIndex={-1}>
        Settings
      </h2>
      {error ? (
        <p class="pref-lede" role="status">
          {error}
        </p>
      ) : (
        <p class="pref-lede">Saved in this browser. Changes apply straight away.</p>
      )}
      <section class="pref-section" id="display" tabIndex={-1} aria-labelledby="display-h">
        <h3 id="display-h">Display</h3>
        <DisplayControls value={display} onChange={onChange} />
      </section>
      <section class="pref-section" id="ratings" tabIndex={-1} aria-labelledby="ratings-h">
        <h3 id="ratings-h">Rating column order</h3>
        <RatingOrderControls value={display} onChange={onChange} />
      </section>
      {film && catalogue && (
        <section class="pref-section" id="preview" tabIndex={-1} aria-labelledby="preview-h">
          <h3 id="preview-h">Preview</h3>
          <p>One row from the programme, drawn with your choices.</p>
          <div class="pref-preview" inert>
            <FilmTable
              films={[film]}
              meta={catalogue.meta}
              display={display}
              state={{ ...state, path: "/", page: 1, sortExplicit: undefined, ...defaultSort("/") }}
              expanded={null}
              onExpand={noop}
              onCalendar={noop}
              onChange={noop}
              showEmpty={false}
            />
          </div>
        </section>
      )}
    </article>
  );
}
