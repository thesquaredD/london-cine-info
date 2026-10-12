import { Notice } from "./notice";
import { useEffect, useState } from "preact/hooks";
import type { ChangelogBundle, ChangelogEntry } from "../shared/changelog";
import { usePreferenceFocus } from "../lib/preference-focus";
import { PageLink } from "./page-link";
import { openFeedback } from "../lib/feedback";

const PAGE_SIZE = 20;
const TYPE_LABEL = { added: "Added", improved: "Improved", fixed: "Fixed" } as const;
const formatDay = (day: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${day}T12:00:00Z`),
  );

/** Notes are deployed beside the app they describe, so this page never runs ahead of the site. */
export function ChangelogPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState(PAGE_SIZE);
  const article = usePreferenceFocus(entries !== null);
  useEffect(() => {
    setFailed(false);
    fetch("/changelog.json", { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<ChangelogBundle>;
      })
      .then((bundle) => {
        const linked = bundle.entries.findIndex((entry) => `#${entry.id}` === location.hash);
        if (linked >= PAGE_SIZE) setShown(linked + 1);
        setEntries(bundle.entries);
      })
      .catch(() => setFailed(true));
  }, [attempt]);
  const visible = entries?.slice(0, shown) ?? [];
  const groups: { day: string | null; entries: ChangelogEntry[] }[] = [];
  for (const entry of visible) {
    const last = groups.at(-1);
    if (last && last.day === entry.changeDate) last.entries.push(entry);
    else groups.push({ day: entry.changeDate, entries: [entry] });
  }
  return (
    <article class="prose changelog-page" aria-labelledby="changelog-title" ref={article}>
      <header class="prose-head">
        <h2 id="changelog-title" tabIndex={-1}>
          What’s new
        </h2>
        <button class="feedback-link" onClick={() => openFeedback()}>
          Something missing? Tell us
        </button>
      </header>
      <p class="prose-lede">
        Improvements and fixes to London Ciné Info, newest first. Screening updates are not listed.
      </p>
      {location.hostname !== "london-cine.info" && (
        <p class="changelog-preview">Preview · these notes are not necessarily live.</p>
      )}
      {failed ? (
        <Notice
          kind="error"
          className="changelog-status"
          title="Changes didn't load"
          actions={<button onClick={() => setAttempt(attempt + 1)}>Try again</button>}
        >
          <p>The list of changes could not be loaded.</p>
        </Notice>
      ) : !entries ? (
        <p role="status" class="changelog-status">
          Loading…
        </p>
      ) : !entries.length ? (
        <p class="changelog-status">Nothing to report yet.</p>
      ) : (
        groups.map((group) => (
          <section class="changelog-day" key={group.day ?? "pending"}>
            <h3>
              <span class="sr-only">Change date: </span>
              {group.day ? formatDay(group.day) : "Not yet merged"}
            </h3>
            <div class="changelog-entries">
              {group.entries.map((entry) => (
                <section
                  class="changelog-entry"
                  id={entry.id}
                  key={entry.id}
                  tabIndex={-1}
                  aria-labelledby={`${entry.id}-title`}
                >
                  <span class={`changelog-type changelog-${entry.type}`}>
                    {TYPE_LABEL[entry.type]}
                  </span>
                  <h4 id={`${entry.id}-title`}>{entry.title}</h4>
                  <p>{entry.body}</p>
                  <div class="changelog-actions">
                    {entry.href && (
                      <PageLink href={entry.href} onNavigate={onNavigate}>
                        {entry.linkLabel} →
                      </PageLink>
                    )}
                    <button
                      class="feedback-link"
                      onClick={() => openFeedback({ context: { changelogId: entry.id } })}
                    >
                      Feedback on this change
                    </button>
                  </div>
                </section>
              ))}
            </div>
          </section>
        ))
      )}
      {entries && entries.length > shown && (
        <div class="changelog-more">
          <button onClick={() => setShown(shown + PAGE_SIZE)}>Show older changes</button>
        </div>
      )}
    </article>
  );
}
