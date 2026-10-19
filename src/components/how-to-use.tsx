import { ExternalLinkIcon } from "./external-link-icon";
import { ShareIcon } from "./share-icon";
import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { usePreferenceFocus } from "../lib/preference-focus";
import { PageLink } from "./page-link";
import { ScreeningRow } from "./screening-row";

const SECTIONS = [
  ["find", "Find and book"],
  ["watchlist", "Your watchlist"],
  ["together", "Watch together"],
  ["cinemas", "My cinemas"],
] as const;

/** A labelled illustration built from the app's own markup. Examples never change anything. */
function Example({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <figure class="guide-example" aria-label={label}>
      <figcaption class="prose-eyebrow">Example</figcaption>
      {children}
    </figure>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ComponentChildren;
}) {
  const id = SECTIONS[index]![0];
  return (
    <section class="prose-section guide-section" id={id} tabIndex={-1} aria-labelledby={`${id}-h`}>
      <h2 class="prose-h2" id={`${id}-h`}>
        <span class="prose-num" aria-hidden="true">
          0{index + 1}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const LISTS = {
  yours: ["Perfect Days", "Aftersun", "Past Lives"],
  theirs: ["Perfect Days", "Paris, Texas", "Past Lives"],
};

export function HowToUse({
  onNavigate,
  onNearby,
}: {
  onNavigate: (path: string) => void;
  onNearby: () => void;
}) {
  const article = usePreferenceFocus();
  const [phone, setPhone] = useState(() => matchMedia("(max-width: 899px)").matches);
  const [current, setCurrent] = useState(location.hash.slice(1) || "find");
  const [watchlistOnly, setWatchlistOnly] = useState(true);
  const [match, setMatch] = useState<"all" | "any">("all");
  const [mine, setMine] = useState(true);
  useEffect(() => {
    const media = matchMedia("(max-width: 899px)");
    const change = () => setPhone(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const sections = Array.from(
      article.current?.querySelectorAll<HTMLElement>("section[id]") ?? [],
    );
    const update = () => {
      const above = sections.filter((section) => section.getBoundingClientRect().top <= 24);
      setCurrent(above.at(-1)?.id ?? (location.hash.slice(1) || "find"));
    };
    const observer = new IntersectionObserver(update, { rootMargin: "-16px 0px -80% 0px" });
    for (const section of sections) observer.observe(section.querySelector("h2")!);
    return () => observer.disconnect();
  }, []);
  const together =
    match === "all"
      ? LISTS.yours.filter((title) => LISTS.theirs.includes(title))
      : [...new Set([...LISTS.yours, ...LISTS.theirs])];
  const map = (
    <nav aria-label="Guide sections">
      {SECTIONS.map(([id, name], index) => (
        <a href={`#${id}`} key={id} aria-current={current === id ? "location" : undefined}>
          <span class="prose-num" aria-hidden="true">
            {index + 1}
          </span>
          {name}
        </a>
      ))}
    </nav>
  );
  return (
    <article class="prose guide-page" aria-labelledby="guide-title" ref={article}>
      <header class="prose-head">
        <h2 id="guide-title" tabIndex={-1}>
          How to use London Ciné Info
        </h2>
        <p class="prose-meta">Optional · four short examples</p>
      </header>
      <p class="prose-lede">
        Less scrolling, more cinema. A few ways to turn London’s listings into a plan; use whichever
        helps and skip the rest.
      </p>
      <aside class="prose-summary" aria-label="In short">
        <p class="prose-eyebrow">In short</p>
        <ul>
          <li>Open a film to see its screenings, then book on the cinema’s own website.</li>
          <li>Sign in and add your Letterboxd username to see your watchlist on screen.</li>
          <li>Compare two public Letterboxd watchlists to find a film you both want to see.</li>
          <li>Save the cinemas you go to, then show only their screenings with My cinemas.</li>
        </ul>
      </aside>
      <div class="prose-two">
        <div class="prose-map">
          {phone ? (
            <details>
              <summary>On this page</summary>
              {map}
            </details>
          ) : (
            <>
              <p class="prose-eyebrow">On this page</p>
              {map}
            </>
          )}
        </div>
        <div>
          <Section index={0} title="Find a screening and book it">
            <ol>
              <li>Browse all films, or narrow them with the day shortcuts and Filters.</li>
              <li>Select a film to see its screenings, grouped by day.</li>
              <li>Choose Book to buy tickets on the cinema’s website.</li>
            </ol>
            <Example label="A film’s screenings">
              <div class="showtimes">
                <div class="showtime-day">
                  <h3>Friday 23 October</h3>
                  <ul>
                    <ScreeningRow
                      localTime="18:30"
                      venue="Prince Charles Cinema"
                      tags={[
                        { key: "35mm", label: "35mm" },
                        { key: "subtitled", label: "Subtitled", kind: "accessibility" },
                      ]}
                    >
                      <span class="booking-action">
                        Book <ExternalLinkIcon />
                      </span>
                      <span class="add-calendar">Add to calendar</span>
                      <span class="share-screening">
                        <ShareIcon />
                        <span class="sr-only">Share</span>
                      </span>
                    </ScreeningRow>
                    <ScreeningRow
                      localTime="20:45"
                      venue="BFI Southbank"
                      soldOut
                      tags={[{ key: "sold-out", label: "Sold out", kind: "sold-out" }]}
                    >
                      <span class="booking-action">
                        Details <ExternalLinkIcon />
                      </span>
                      <span class="add-calendar">Add to calendar</span>
                      <span class="share-screening">
                        <ShareIcon />
                        <span class="sr-only">Share</span>
                      </span>
                    </ScreeningRow>
                  </ul>
                </div>
              </div>
            </Example>
            <p class="prose-small">
              Sold-out screenings show Details instead of Book. The share button copies a link that
              opens the film with that screening highlighted. Add to calendar saves the screening;
              it does not buy a ticket.
            </p>
            <div class="prose-links guide-actions">
              <PageLink href="/" onNavigate={onNavigate}>
                Browse all films
              </PageLink>
              <span aria-hidden="true">·</span>
              <PageLink href="/?tonight=1" onNavigate={onNavigate}>
                See what’s on tonight
              </PageLink>
            </div>
          </Section>
          <Section index={1} title="Set up your watchlist">
            <ol>
              <li>Sign in with your email. A link signs you in; there is no password.</li>
              <li>In Account, add your Letterboxd username to import your public watchlist.</li>
              <li>
                Open Watchlist, or choose the My watchlist shortcut while browsing, to see the films
                from your list that are screening.
              </li>
            </ol>
            <Example label="The My watchlist shortcut">
              <div class="shortcut-strip" role="group" aria-label="Example shortcuts">
                <button aria-pressed={false} disabled>
                  Today
                </button>
                <button aria-pressed={false} disabled>
                  This weekend
                </button>
                <span class="strip-sep" aria-hidden="true" />
                <button
                  aria-pressed={watchlistOnly}
                  onClick={() => setWatchlistOnly(!watchlistOnly)}
                >
                  My watchlist
                </button>
              </div>
              <p class="guide-result" role="status">
                {watchlistOnly
                  ? "2 films from your watchlist: Perfect Days, Aftersun"
                  : "All films, including Perfect Days, Aftersun and 20 more"}
              </p>
            </Example>
            <p class="prose-small">
              Keep editing your list on Letterboxd, then refresh it in Account. Only public
              watchlists can be read, and films appear only while they have screenings.
            </p>
            <div class="prose-links guide-actions">
              <PageLink href="/account" onNavigate={onNavigate}>
                Sign in or open Account
              </PageLink>
              <span aria-hidden="true">·</span>
              <PageLink href="/watchlist" onNavigate={onNavigate}>
                Open Watchlist
              </PageLink>
            </div>
          </Section>
          <Section index={2} title="Choose something together">
            <ol>
              <li>
                In Friends, enter your public Letterboxd username and theirs, then choose Find films
                in common.
              </li>
              <li>The programme then shows films on both watchlists.</li>
              <li>Narrow by day and cinema to find a screening that suits you both.</li>
            </ol>
            <Example label="Two watchlists compared">
              <dl class="guide-lists">
                <dt>Your list</dt>
                <dd>{LISTS.yours.join(" · ")}</dd>
                <dt>Their list</dt>
                <dd>{LISTS.theirs.join(" · ")}</dd>
              </dl>
              <div class="guide-toggle" role="group" aria-label="Match watchlists">
                <button aria-pressed={match === "all"} onClick={() => setMatch("all")}>
                  On every list
                </button>
                <button aria-pressed={match === "any"} onClick={() => setMatch("any")}>
                  On any list
                </button>
              </div>
              <p class="guide-result" role="status">
                {together.length} films: {together.join(", ")}
              </p>
            </Example>
            <ul>
              <li>No account or friend request is needed; these lists last for this session.</li>
              <li>
                With accounts, choose an app username in Account and send a friend request. Accepted
                friends can filter films by each other’s watchlist.
              </li>
              <li>
                In Filters, Watchlists lets you add more lists and switch between films on every
                list and films on any list.
              </li>
            </ul>
            <p class="prose-small">Nothing is added to or changed on anyone’s Letterboxd list.</p>
            <div class="prose-links guide-actions">
              <PageLink href="/friends" onNavigate={onNavigate}>
                Find a film together
              </PageLink>
            </div>
          </Section>
          <Section index={3} title="Set up My cinemas">
            <ol>
              <li>
                In Account, choose Manage cinemas and pick venues by name, borough or distance. No
                sign-in is needed.
              </li>
              <li>Select the My cinemas shortcut to show screenings only at those venues.</li>
              <li>While My cinemas is on, Edit cinemas changes your choices.</li>
            </ol>
            <Example label="The My cinemas shortcut">
              <div class="shortcut-strip" role="group" aria-label="Example shortcuts">
                <button aria-pressed={mine} onClick={() => setMine(!mine)}>
                  My cinemas
                </button>
                <button aria-pressed={false} disabled>
                  Near me
                </button>
              </div>
              <p class="guide-result" role="status">
                {mine ? "Screenings at your 3 saved cinemas" : "Screenings at every London cinema"}
              </p>
            </Example>
            <p class="prose-small">
              Without an account, your cinemas stay in this browser; sign in to keep them on your
              account. Near me is a one-off search and does not change your saved cinemas.
            </p>
            <div class="prose-links guide-actions">
              <PageLink href="/?cinemas=mine" onNavigate={onNavigate}>
                Choose my cinemas
              </PageLink>
              <span aria-hidden="true">·</span>
              <button class="guide-link" aria-haspopup="dialog" onClick={onNearby}>
                Find cinemas near me
              </button>
            </div>
          </Section>
        </div>
      </div>
      <footer class="prose-footer guide-footer">
        <p>No tour to finish and no account needed to browse.</p>
        <PageLink href="/" onNavigate={onNavigate} class="booking-action">
          Browse all films
        </PageLink>
      </footer>
    </article>
  );
}
