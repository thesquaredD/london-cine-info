import { useEffect, useState } from "preact/hooks";
import { analyticsAllowed, browserDoNotTrack, setAnalyticsAllowed } from "../lib/analytics";
import { usePreferenceFocus } from "../lib/preference-focus";
import { PageLink } from "./page-link";
import { CONTACT_EMAIL } from "../shared/feedback";

const contact = CONTACT_EMAIL;
export function Privacy({ onNavigate }: { onNavigate: (path: string) => void }) {
  const article = usePreferenceFocus();
  const [analytics, setAnalytics] = useState(analyticsAllowed);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const changed = () => setAnalytics(analyticsAllowed());
    window.addEventListener("cine-analytics-choice", changed);
    return () => window.removeEventListener("cine-analytics-choice", changed);
  }, []);
  const [phone, setPhone] = useState(() => matchMedia("(max-width: 699px)").matches);
  const [current, setCurrent] = useState(location.hash.slice(1) || "operator");
  useEffect(() => {
    const media = matchMedia("(max-width: 699px)");
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
      setCurrent(above.at(-1)?.id ?? (location.hash.slice(1) || "operator"));
    };
    const observer = new IntersectionObserver(update, { rootMargin: "-16px 0px -80% 0px" });
    for (const section of sections) observer.observe(section.querySelector("h2")!);
    const hash = () => setCurrent(location.hash.slice(1) || "operator");
    window.addEventListener("hashchange", hash);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  const map = (
    <nav aria-label="Privacy policy sections">
      {[
        ["operator", "Contact"],
        ["information", "Information"],
        ["purposes", "Purposes"],
        ["storage", "Browser storage"],
        ["analytics", "Analytics choice"],
        ["feedback", "Feedback"],
        ["sharing", "Providers"],
        ["retention", "Retention"],
        ["security", "Security"],
        ["rights", "Your rights"],
        ["changes", "Updates"],
      ].map(([id, name], index) => (
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
    <article class="prose privacy-page" aria-labelledby="privacy-title" ref={article}>
      <header class="prose-head">
        <h2 id="privacy-title" tabIndex={-1}>
          Privacy
        </h2>
        <p class="prose-meta">
          Last updated 12 October 2026 · Operator Diogo Diogo ·{" "}
          <a href={`mailto:${contact}`}>Contact</a>
        </p>
      </header>
      <p class="prose-lede">
        London Ciné Info is a personal, non-commercial service for finding cinema screenings. You
        can browse without an account. This policy explains what happens to your information when
        you browse, sign in or use the optional watchlist, friends and email features.
      </p>
      <aside class="prose-summary" aria-label="In short">
        <p class="prose-eyebrow">In short</p>
        <ul>
          <li>You can browse without an account.</li>
          <li>
            Account information provides the features you choose; weekly emails are off by default.
          </li>
          <li>
            You can turn off <a href="#analytics">site analytics</a> in this browser.
          </li>
          <li>
            You can{" "}
            <PageLink href="/account#delete" onNavigate={onNavigate}>
              remove your account
            </PageLink>{" "}
            and ask us about separately held records.
          </li>
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
          <section class="prose-section" id="operator" tabIndex={-1} aria-labelledby="operator-h">
            <h2 class="prose-h2" id="operator-h">
              <span class="prose-num" aria-hidden="true">
                01
              </span>
              Who is responsible
            </h2>
            <p>
              Diogo Diogo operates London Ciné Info and is the controller of the personal
              information described here. For privacy questions or requests about your data, email{" "}
              <a href={`mailto:${contact}`}>{contact}</a>.
            </p>
            <p>Please use email for private account details, rather than a public GitHub issue.</p>
          </section>
          <section
            class="prose-section"
            id="information"
            tabIndex={-1}
            aria-labelledby="information-h"
          >
            <h2 class="prose-h2" id="information-h">
              <span class="prose-num" aria-hidden="true">
                02
              </span>
              Information we use
            </h2>
            <dl>
              <dt>When you sign in</dt>
              <dd>Requesting a sign-in link creates an account record with your email address.</dd>
              <dt>If you use the features</dt>
              <dd>
                If you use the relevant features, we also store your app username, Letterboxd
                username, imported public watchlist, favourite cinemas, saved screenings, friend
                requests and friendships, email choices, and a record of films already included in
                screening emails. Account identifiers and import status help keep these records
                connected and show whether an import succeeded.
              </dd>
              <dt>Watchlist imports</dt>
              <dd>
                Watchlist imports come from public Letterboxd pages for the username you supply. We
                do not ask for your Letterboxd password or access private Letterboxd lists.
              </dd>
              <dt>What friends see</dt>
              <dd>
                Accepted friends can see your app username and connected Letterboxd username and use
                your imported watchlist to find films in common. Your email address is not shown to
                friends.
              </dd>
              <dt>Automatically</dt>
              <dd>
                The hosting service receives connection information, including your IP address and
                browser details, when it serves a page or API request. Our request limits use hashed
                keys derived from IP addresses, email addresses or account identifiers to prevent
                repeated or abusive requests.
              </dd>
              <dt>Near me</dt>
              <dd>
                Near me is optional. A postcode you enter is sent to postcodes.io to look up its
                coordinates; with your browser’s permission, your device location can be used
                instead. Distances are worked out in your browser, and the postcode and coordinates
                are never stored or sent to us. The cinemas you pick become a filter in the page
                address and are not saved. Only cinemas you add in My cinemas are saved, as cinema
                IDs, to your cinema preferences.
              </dd>
            </dl>
          </section>
          <section class="prose-section" id="purposes" tabIndex={-1} aria-labelledby="purposes-h">
            <h2 class="prose-h2" id="purposes-h">
              <span class="prose-num" aria-hidden="true">
                03
              </span>
              Why we use this information
            </h2>
            <dl>
              <dt>To do what you ask</dt>
              <dd>
                We use account information to provide the features you request: signing in, saving
                preferences and screenings, importing public watchlists and connecting with friends.
                This processing is necessary to provide those services. Providing an email is
                necessary for sign-in; the other profile and preference fields are optional.
              </dd>
              <dt>To keep the site working</dt>
              <dd>
                We use limited security and operational information for our legitimate interests in
                preventing misuse, keeping the service reliable and improving it. Site analytics
                supports our legitimate interest in understanding how the service is used; you can
                object using the switch below or by contacting us.
              </dd>
              <dt>Weekly screening emails</dt>
              <dd>
                Weekly screening emails are sent only when you choose an email day. They are off by
                default. You can withdraw that choice through the unsubscribe link in any screening
                email or through{" "}
                <PageLink href="/account#emails" onNavigate={onNavigate}>
                  Account
                </PageLink>
                . Sign-in links you request are separate from a weekly email subscription.
              </dd>
            </dl>
          </section>
          <section class="prose-section" id="storage" tabIndex={-1} aria-labelledby="storage-h">
            <h2 class="prose-h2" id="storage-h">
              <span class="prose-num" aria-hidden="true">
                04
              </span>
              Cookies and browser storage
            </h2>
            <div class="prose-scroll" role="region" aria-label="Browser storage" tabIndex={0}>
              <table class="prose-wide">
                <thead>
                  <tr>
                    <th scope="col">Where</th>
                    <th scope="col">What it holds</th>
                    <th scope="col">How long</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Session cookie</td>
                    <td>
                      A secure, HttpOnly session cookie keeps you signed in. It expires 90 days
                      after its most recent renewal when your account is checked. Signing out
                      removes the current session. This cookie is needed for account features.
                    </td>
                    <td>90 days after its most recent renewal; removed on sign-out.</td>
                  </tr>
                  <tr>
                    <td>Local storage</td>
                    <td>
                      Local storage holds guest favourite cinemas, a random cinema-preference
                      identifier and the hide-watchlist-ratings setting. Guest choices stay separate
                      from signed-in favourites; a merge receipt prevents repeated imports of the
                      same guest choices into an account.
                    </td>
                    <td>Until you clear site data.</td>
                  </tr>
                  <tr>
                    <td>Session storage and this visit</td>
                    <td>
                      Temporary watchlist comparisons and selections use session storage, separately
                      for each account or guest session. Display title and rating-order choices last
                      for the current visit.
                    </td>
                    <td>For the browser session or current visit.</td>
                  </tr>
                  <tr>
                    <td>Page URL</td>
                    <td>
                      Filters are included in the page URL, and shared My cinemas URLs include the
                      selected venue IDs.
                    </td>
                    <td>In the current or shared link.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="prose-small">
              Analytics uses local storage for a browser identifier and session storage for limited
              visit attribution. The analytics choice below is also saved locally. We do not use
              advertising cookies. Clearing site data removes local choices and identifiers; browser
              controls can block storage, although some preferences then last only for the visit.
            </p>
          </section>
          <section class="prose-section" id="analytics" tabIndex={-1} aria-labelledby="analytics-h">
            <h2 class="prose-h2" id="analytics-h">
              <span class="prose-num" aria-hidden="true">
                05
              </span>
              Site analytics and your choice
            </h2>
            <div class="prose-control">
              <label>
                <input
                  type="checkbox"
                  checked={analytics}
                  disabled={browserDoNotTrack()}
                  onChange={(event) => {
                    const allowed = event.currentTarget.checked;
                    setStorageError(!setAnalyticsAllowed(allowed));
                    setAnalytics(analyticsAllowed());
                  }}
                />
                Allow site analytics in this browser
              </label>
              <span role="status">
                {browserDoNotTrack()
                  ? "Your browser’s Do Not Track setting has disabled browser analytics."
                  : analytics
                    ? "Site analytics is on for this browser."
                    : "Site analytics is off for this browser."}
              </span>
            </div>
            {storageError && (
              <p role="status">
                Browser storage is unavailable. This analytics choice lasts only for this visit.
              </p>
            )}
            <div class="prose-cols">
              <div>
                <p class="prose-eyebrow">PostHog EU measures</p>
                <ul>
                  <li>Page visits, referral domains and campaign labels.</li>
                  <li>
                    Searches and result counts, filters, film views and outbound booking clicks.
                  </li>
                  <li>Account and friendship milestones and watchlist imports.</li>
                  <li>Page duration, scroll depth and performance.</li>
                </ul>
              </div>
              <div>
                <p class="prose-eyebrow">Never sent</p>
                <ul>
                  <li>Email addresses, app and Letterboxd usernames.</li>
                  <li>Friend identities and sign-in tokens.</li>
                  <li>
                    GeoIP enrichment, session replay, automatic click recording and heatmaps are
                    disabled.
                  </li>
                </ul>
              </div>
            </div>
            <p>
              A random browser identifier connects visits; signing in links it to an opaque account
              ID.
            </p>
            <p>
              URLs are reduced to page paths. Search text is limited and common email addresses,
              URLs and tokens are redacted, but the filter cannot recognise every piece of personal
              information: please do not put private details in film searches.
            </p>
            <p>
              Turning analytics off stops new browser measurements and analytics for requests made
              by this browser. Measurements already collected may finish delivery and are not erased
              by this switch. Scheduled watchlist imports can still record limited operational
              outcomes independently of browser preferences.
            </p>
          </section>
          <section class="prose-section" id="feedback" tabIndex={-1} aria-labelledby="feedback-h">
            <h2 class="prose-h2" id="feedback-h">
              <span class="prose-num" aria-hidden="true">
                06
              </span>
              Feedback you send
            </h2>
            <p>
              The Feedback form sends your message, an optional topic and an optional reply email to
              PostHog only when you press Send. Nothing you type is sent before that.
            </p>
            <dl>
              <dt>Sent with it</dt>
              <dd>
                With it go the page path, app version, a broad screen size, the screening-data
                version and, where you started from one, a film, error code or change identifier.
              </dd>
              <dt>Stored under</dt>
              <dd>
                It is stored under this browser’s analytics identifier, or your opaque account ID if
                you are signed in, so it is not anonymous. Your account email is never attached; a
                reply email is used only to answer you.
              </dd>
              <dt>Who reads it</dt>
              <dd>
                Feedback is read privately. When it points to work on the site, a reviewed summary
                without your words, email or identifiers may become a public issue in the project’s
                GitHub repository.
              </dd>
              <dt>When it does not work</dt>
              <dd>
                Feedback is not sent from the form when analytics is off or Do Not Track is set; you
                can email it instead. Ask us at any time to delete feedback you sent.
              </dd>
            </dl>
          </section>
          <section class="prose-section" id="sharing" tabIndex={-1} aria-labelledby="sharing-h">
            <h2 class="prose-h2" id="sharing-h">
              <span class="prose-num" aria-hidden="true">
                07
              </span>
              Service providers and external sites
            </h2>
            <dl>
              <dt>
                <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare</a>
              </dt>
              <dd>
                Hosts the site, account database, cached data and request-limit infrastructure.
              </dd>
              <dt>
                <a href="https://resend.com/legal/privacy-policy">Resend</a>
              </dt>
              <dd>
                Receives email addresses and message content to deliver sign-in links and screening
                emails.
              </dd>
              <dt>
                <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
                  GitHub
                </a>
              </dt>
              <dd>Runs screening updates, watchlist imports and email jobs.</dd>
              <dt>
                <a href="https://posthog.com/privacy">PostHog</a>
              </dt>
              <dd>Processes the analytics described above.</dd>
              <dt>Letterboxd</dt>
              <dd>Receives server requests for public watchlists.</dd>
            </dl>
            <p>
              Loading film posters contacts the image provider. Opening booking, ratings, trailer or
              other external links takes you to services with their own privacy policies; booking
              purchases are handled by the cinema or ticket provider, rather than London Ciné Info.
            </p>
            <p>
              These providers operate internationally, so some processing can take place outside the
              UK. PostHog is configured to use its EU service. The linked provider policies describe
              their processing locations and transfer arrangements; contact us for information about
              the arrangements relevant to your data.
            </p>
          </section>
          <section class="prose-section" id="retention" tabIndex={-1} aria-labelledby="retention-h">
            <h2 class="prose-h2" id="retention-h">
              <span class="prose-num" aria-hidden="true">
                08
              </span>
              How long information stays
            </h2>
            <div>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Record</th>
                    <th scope="col">Kept until</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Account records and saved preferences</td>
                    <td>
                      Account records and saved preferences remain in the active database until you
                      remove them or delete your account.
                    </td>
                  </tr>
                  <tr>
                    <td>Imported lists and friendships</td>
                    <td>
                      Changing your Letterboxd username clears the previous imported list. Removing
                      a friendship revokes watchlist access on both sides.
                    </td>
                  </tr>
                  <tr>
                    <td>Public watchlist cache</td>
                    <td>
                      Public watchlist pages are cached for up to one hour; expired cache entries
                      are removed when subsequent public-list requests are processed.
                    </td>
                  </tr>
                  <tr>
                    <td>Sign-in tokens</td>
                    <td>Sign-in tokens expire after 15 minutes and are single use.</td>
                  </tr>
                  <tr>
                    <td>Sessions</td>
                    <td>Sessions expire after 90 days without renewal.</td>
                  </tr>
                  <tr>
                    <td>Expired records</td>
                    <td>
                      Expired tokens, sessions and hashed request-limit records are removed by
                      scheduled maintenance.
                    </td>
                  </tr>
                  <tr>
                    <td>Browser choices</td>
                    <td>
                      Guest browser storage remains until you clear it; session choices are held for
                      the browser session.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Deleting your account removes its sessions, imported watchlist, friendships, requests,
              saved screenings, cinema preferences and alert history from the active database. It
              does not automatically delete separately collected analytics, provider delivery
              records or backups. Those records have separate retention settings; you can contact us
              to request access or erasure. We consider the purpose of the record, security needs
              and any applicable legal obligations when handling a retention or deletion request.
            </p>
          </section>
          <section class="prose-section" id="security" tabIndex={-1} aria-labelledby="security-h">
            <h2 class="prose-h2" id="security-h">
              <span class="prose-num" aria-hidden="true">
                09
              </span>
              Keeping information secure
            </h2>
            <p>
              The site uses HTTPS. Sign-in tokens and session credentials are stored as hashes, and
              account API responses are not publicly cached. Access to another person’s imported
              watchlist requires an accepted friendship.
            </p>
            <p class="prose-small">
              No system can guarantee absolute security: keep sign-in emails private and sign out on
              shared devices.
            </p>
          </section>
          <section class="prose-section" id="rights" tabIndex={-1} aria-labelledby="rights-h">
            <h2 class="prose-h2" id="rights-h">
              <span class="prose-num" aria-hidden="true">
                10
              </span>
              Your choices and data rights
            </h2>
            <div class="prose-cols">
              <div>
                <p class="prose-eyebrow">Do it yourself</p>
                <ul>
                  <li>
                    Change your{" "}
                    <PageLink href="/account#profile" onNavigate={onNavigate}>
                      username
                    </PageLink>{" "}
                    and{" "}
                    <PageLink href="/account#emails" onNavigate={onNavigate}>
                      email preferences
                    </PageLink>{" "}
                    in Account.
                  </li>
                  <li>Remove individual saved items or friends.</li>
                  <li>
                    <PageLink href="/account#delete" onNavigate={onNavigate}>
                      delete your account
                    </PageLink>
                    .
                  </li>
                  <li>Sign out is at the bottom of the sidebar.</li>
                </ul>
              </div>
              <div>
                <p class="prose-eyebrow">Ask us by email</p>
                <p>Depending on the applicable law and the processing involved, you can request:</p>
                <ul>
                  <li>Access, correction or deletion of your personal information.</li>
                  <li>A portable copy or restriction of your personal information.</li>
                  <li>
                    An objection to processing based on legitimate interests, including site
                    analytics.
                  </li>
                </ul>
                <p>
                  You can withdraw an optional email subscription without affecting earlier
                  processing. Email <a href={`mailto:${contact}`}>{contact}</a> to make a request.
                  We may ask for enough information to verify that a request concerns your account.
                </p>
              </div>
            </div>
            <p class="prose-small">
              You can also raise a concern with the UK{" "}
              <a href="https://ico.org.uk/make-a-complaint/">Information Commissioner’s Office</a>{" "}
              or the data-protection authority where you live. The site does not make automated
              decisions with legal or similarly significant effects on you.
            </p>
          </section>
          <section class="prose-section" id="changes" tabIndex={-1} aria-labelledby="changes-h">
            <h2 class="prose-h2" id="changes-h">
              <span class="prose-num" aria-hidden="true">
                11
              </span>
              Changes to this policy
            </h2>
            <p>
              We will update this page when the service’s data practices change. The date above
              identifies the current version. For questions about a change, contact Diogo Diogo at{" "}
              <a href={`mailto:${contact}`}>{contact}</a>.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
