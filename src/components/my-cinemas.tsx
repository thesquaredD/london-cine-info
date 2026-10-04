import { useEffect, useRef, useState } from "preact/hooks";
import type { DataMeta } from "../shared/data";
import type { CinemasState } from "../lib/cinemas";
import { Dialog } from "./dialog";
export function MyCinemas({
  cinemas,
  meta,
  open,
  onClose,
}: {
  cinemas: CinemasState;
  meta: DataMeta;
  open: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const initialized = useRef(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!open) initialized.current = false;
  }, [open]);
  useEffect(() => {
    if (open && !cinemas.loading && !initialized.current) {
      setDraft([...cinemas.venues]);
      setSearch("");
      setNotice("");
      initialized.current = true;
    }
  }, [open, cinemas.loading, cinemas.venues]);
  const groups = new Map<string, typeof meta.venues>();
  for (const venue of meta.venues) {
    const borough =
      meta.boroughs.find((value) => value.id === venue.borough)?.name ?? "Other cinemas";
    if (!`${venue.name} ${borough}`.toLowerCase().includes(search.toLowerCase())) continue;
    groups.set(borough, [...(groups.get(borough) ?? []), venue]);
  }
  const missing = draft.filter((id) => !meta.venues.some((venue) => venue.id === id));
  return (
    <Dialog className="cinema-dialog" open={open} title="Manage my cinemas" onClose={onClose}>
      <p>
        {cinemas.signedIn
          ? "Saved to your account and synced across devices."
          : "Saved in this browser. Sign in to sync across devices."}{" "}
        Choosing favourites does not change your screening filters.
      </p>
      {cinemas.loading && <p role="status">Loading saved cinemas…</p>}
      {cinemas.error && (
        <div role="alert">
          <p>{cinemas.error}</p>
          <button
            disabled={cinemas.busy}
            onClick={async () => {
              const loaded = await cinemas.reload();
              if (!loaded) return;
              setNotice(
                "Cinemas reloaded. Close and reopen to use the saved selection; your unsaved choices are still here.",
              );
            }}
          >
            Reload saved cinemas
          </button>
        </div>
      )}
      {cinemas.storageError && <p role="status">{cinemas.storageError}</p>}
      {notice && <p role="status">{notice}</p>}
      <label for="my-cinema-search">Find cinemas</label>
      <input
        data-initial-focus
        id="my-cinema-search"
        type="search"
        value={search}
        onInput={(event) => setSearch(event.currentTarget.value)}
      />
      <fieldset class="favourite-options" disabled={cinemas.loading || cinemas.busy}>
        <legend>{draft.length} favourite cinemas</legend>
        {[...groups]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([borough, venues]) => (
            <div key={borough}>
              <h3>{borough}</h3>
              {venues
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((venue) => (
                  <label key={venue.id}>
                    <input
                      type="checkbox"
                      checked={draft.includes(venue.id)}
                      onChange={() =>
                        setDraft(
                          draft.includes(venue.id)
                            ? draft.filter((id) => id !== venue.id)
                            : [...draft, venue.id],
                        )
                      }
                    />{" "}
                    {venue.name}
                  </label>
                ))}
            </div>
          ))}
        {missing.map((id) => (
          <label key={id}>
            <input
              type="checkbox"
              checked
              onChange={() => setDraft(draft.filter((value) => value !== id))}
            />{" "}
            {id} · not in current listings
          </label>
        ))}
        {!groups.size && <p>No listed cinemas match this search.</p>}
      </fieldset>
      <div class="account-actions">
        <button
          disabled={cinemas.loading || cinemas.busy}
          onClick={async () => {
            if (await cinemas.save(draft)) {
              setNotice("Cinemas saved.");
              onClose();
            }
          }}
        >
          {cinemas.busy ? "Saving…" : "Save my cinemas"}
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </Dialog>
  );
}
