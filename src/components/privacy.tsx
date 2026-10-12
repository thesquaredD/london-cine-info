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
  return (
    <article class="prose about-page privacy-page" aria-labelledby="privacy-title" ref={article}>
      <h2 id="privacy-title" tabIndex={-1}>
        Privacy
      </h2>
      <p class="privacy-updated">Last updated: 12 October 2026</p>
      <p>
        London Ciné Info is a personal, non-commercial service for finding cinema screenings. You
        can browse without an account. This policy explains what happens to your information when
        you browse, sign in or use the optional watchlist, friends and email features.
      </p>
      <nav class="privacy-contents" aria-label="Privacy policy sections">
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
        ].map(([id, name]) => (
          <a href={`#${id}`} key={id}>
            {name}
          </a>
        ))}
      </nav>
      <section class="prose-section" id="operator" tabIndex={-1} aria-labelledby="operator-h">
        <h3 id="operator-h">Who is responsible</h3>
        <p>
          Diogo Diogo operates London Ciné Info and is the controller of the personal information
          described here. For privacy questions or requests about your data, email{" "}
          <a href={`mailto:${contact}`}>{contact}</a>. Please use email for private account details,
          rather than a public GitHub issue.
        </p>
      </section>
      <section class="prose-section" id="information" tabIndex={-1} aria-labelledby="information-h">
        <h3 id="information-h">Information we use</h3>
        <p>
          Requesting a sign-in link creates an account record with your email address. If you use
          the relevant features, we also store your app username, Letterboxd username, imported
          public watchlist, favourite cinemas, saved screenings, friend requests and friendships,
          email choices, and a record of films already included in screening emails. Account
          identifiers and import status help keep these records connected and show whether an import
          succeeded.
        </p>
        <p>
          Watchlist imports come from public Letterboxd pages for the username you supply. We do not
          ask for your Letterboxd password or access private Letterboxd lists. Accepted friends can
          see your app username and connected Letterboxd username and use your imported watchlist to
          find films in common. Your email address is not shown to friends.
        </p>
        <p>
          The hosting service receives connection information, including your IP address and browser
          details, when it serves a page or API request. Our request limits use hashed keys derived
          from IP addresses, email addresses or account identifiers to prevent repeated or abusive
          requests.
        </p>
        <p>
          Near me is optional. With your browser’s permission, location coordinates are used in the
          browser to calculate cinema distances. A postcode you enter is sent to postcodes.io to
          look up coordinates. We save your chosen cinema IDs, rather than the postcode or
          coordinates, to your cinema preferences.
        </p>
      </section>
      <section class="prose-section" id="purposes" tabIndex={-1} aria-labelledby="purposes-h">
        <h3 id="purposes-h">Why we use this information</h3>
        <p>
          We use account information to provide the features you request: signing in, saving
          preferences and screenings, importing public watchlists and connecting with friends. This
          processing is necessary to provide those services. Providing an email is necessary for
          sign-in; the other profile and preference fields are optional.
        </p>
        <p>
          We use limited security and operational information for our legitimate interests in
          preventing misuse, keeping the service reliable and improving it. Site analytics supports
          our legitimate interest in understanding how the service is used; you can object using the
          switch below or by contacting us.
        </p>
        <p>
          Weekly screening emails are sent only when you choose an email day. They are off by
          default. You can withdraw that choice through the unsubscribe link in any screening email
          or through{" "}
          <PageLink href="/account#emails" onNavigate={onNavigate}>
            Account
          </PageLink>
          . Sign-in links you request are separate from a weekly email subscription.
        </p>
      </section>
      <section class="prose-section" id="storage" tabIndex={-1} aria-labelledby="storage-h">
        <h3 id="storage-h">Cookies and browser storage</h3>
        <p>
          A secure, HttpOnly session cookie keeps you signed in. It expires 90 days after its most
          recent renewal when your account is checked. Signing out removes the current session. This
          cookie is needed for account features.
        </p>
        <p>
          Local storage holds guest favourite cinemas, a random cinema-preference identifier and the
          hide-watchlist-ratings setting. Guest choices stay separate from signed-in favourites; a
          merge receipt prevents repeated imports of the same guest choices into an account.
          Temporary watchlist comparisons and selections use session storage, separately for each
          account or guest session. Display title and rating-order choices last for the current
          visit. Filters are included in the page URL, and shared My cinemas URLs include the
          selected venue IDs.
        </p>
        <p>
          Analytics uses local storage for a browser identifier and session storage for limited
          visit attribution. The analytics choice below is also saved locally. We do not use
          advertising cookies. Clearing site data removes local choices and identifiers; browser
          controls can block storage, although some preferences then last only for the visit.
        </p>
      </section>
      <section class="prose-section" id="analytics" tabIndex={-1} aria-labelledby="analytics-h">
        <h3 id="analytics-h">Site analytics and your choice</h3>
        <p>
          PostHog EU Cloud helps us measure page visits, referral domains and campaign labels,
          searches and result counts, filters, film views, outbound booking clicks, account and
          friendship milestones, watchlist imports, page duration, scroll depth and performance. A
          random browser identifier connects visits; signing in links it to an opaque account ID.
        </p>
        <p>
          We exclude email addresses, app and Letterboxd usernames, friend identities and sign-in
          tokens from analytics. URLs are reduced to page paths. Search text is limited and common
          email addresses, URLs and tokens are redacted, but the filter cannot recognise every piece
          of personal information: please do not put private details in film searches. We disable
          GeoIP enrichment, session replay, automatic click recording and heatmaps.
        </p>
        <label class="privacy-choice">
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
        <p role="status">
          {browserDoNotTrack()
            ? "Your browser’s Do Not Track setting has disabled browser analytics."
            : analytics
              ? "Site analytics is on for this browser."
              : "Site analytics is off for this browser."}
        </p>
        {storageError && (
          <p role="status">
            Browser storage is unavailable. This analytics choice lasts only for this visit.
          </p>
        )}
        <p>
          Turning analytics off stops new browser measurements and analytics for requests made by
          this browser. Measurements already collected may finish delivery and are not erased by
          this switch. Scheduled watchlist imports can still record limited operational outcomes
          independently of browser preferences.
        </p>
      </section>
      <section class="prose-section" id="feedback" tabIndex={-1} aria-labelledby="feedback-h">
        <h3 id="feedback-h">Feedback you send</h3>
        <p>
          The Feedback form sends your message, an optional topic and an optional reply email to
          PostHog only when you press Send. Nothing you type is sent before that. With it go the
          page path, app version, a broad screen size, the screening-data version and, where you
          started from one, a film, error code or change identifier. It is stored under this
          browser’s analytics identifier, or your opaque account ID if you are signed in, so it is
          not anonymous. Your account email is never attached; a reply email is used only to answer
          you.
        </p>
        <p>
          Feedback is read privately. When it points to work on the site, a reviewed summary without
          your words, email or identifiers may become a public issue in the project’s GitHub
          repository. Feedback is not sent from the form when analytics is off or Do Not Track is
          set; you can email it instead. Ask us at any time to delete feedback you sent.
        </p>
      </section>
      <section class="prose-section" id="sharing" tabIndex={-1} aria-labelledby="sharing-h">
        <h3 id="sharing-h">Service providers and external sites</h3>
        <p>
          <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare</a> hosts the site, account
          database, cached data and request-limit infrastructure.{" "}
          <a href="https://resend.com/legal/privacy-policy">Resend</a> receives email addresses and
          message content to deliver sign-in links and screening emails.{" "}
          <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
            GitHub
          </a>{" "}
          runs screening updates, watchlist imports and email jobs.{" "}
          <a href="https://posthog.com/privacy">PostHog</a> processes the analytics described above.
        </p>
        <p>
          Letterboxd receives server requests for public watchlists. Loading film posters contacts
          the image provider. Opening booking, ratings, trailer or other external links takes you to
          services with their own privacy policies; booking purchases are handled by the cinema or
          ticket provider, rather than London Ciné Info.
        </p>
        <p>
          These providers operate internationally, so some processing can take place outside the UK.
          PostHog is configured to use its EU service. The linked provider policies describe their
          processing locations and transfer arrangements; contact us for information about the
          arrangements relevant to your data.
        </p>
      </section>
      <section class="prose-section" id="retention" tabIndex={-1} aria-labelledby="retention-h">
        <h3 id="retention-h">How long information stays</h3>
        <p>
          Account records and saved preferences remain in the active database until you remove them
          or delete your account. Changing your Letterboxd username clears the previous imported
          list. Removing a friendship revokes watchlist access on both sides. Public watchlist pages
          are cached for up to one hour; expired cache entries are removed when subsequent
          public-list requests are processed.
        </p>
        <p>
          Sign-in tokens expire after 15 minutes and are single use. Sessions expire after 90 days
          without renewal. Expired tokens, sessions and hashed request-limit records are removed by
          scheduled maintenance. Guest browser storage remains until you clear it; session choices
          are held for the browser session.
        </p>
        <p>
          Deleting your account removes its sessions, imported watchlist, friendships, requests,
          saved screenings, cinema preferences and alert history from the active database. It does
          not automatically delete separately collected analytics, provider delivery records or
          backups. Those records have separate retention settings; you can contact us to request
          access or erasure. We consider the purpose of the record, security needs and any
          applicable legal obligations when handling a retention or deletion request.
        </p>
      </section>
      <section class="prose-section" id="security" tabIndex={-1} aria-labelledby="security-h">
        <h3 id="security-h">Keeping information secure</h3>
        <p>
          The site uses HTTPS. Sign-in tokens and session credentials are stored as hashes, and
          account API responses are not publicly cached. Access to another person’s imported
          watchlist requires an accepted friendship. No system can guarantee absolute security: keep
          sign-in emails private and sign out on shared devices.
        </p>
      </section>
      <section class="prose-section" id="rights" tabIndex={-1} aria-labelledby="rights-h">
        <h3 id="rights-h">Your choices and data rights</h3>
        <p>
          You can change your{" "}
          <PageLink href="/account#profile" onNavigate={onNavigate}>
            username
          </PageLink>{" "}
          and{" "}
          <PageLink href="/account#emails" onNavigate={onNavigate}>
            email preferences
          </PageLink>{" "}
          in Account, remove individual saved items or friends, and{" "}
          <PageLink href="/account#delete" onNavigate={onNavigate}>
            delete your account
          </PageLink>
          . Sign out is at the bottom of the sidebar.
        </p>
        <p>
          Depending on the applicable law and the processing involved, you can request access,
          correction, deletion, a portable copy or restriction of your personal information. You can
          object to processing based on legitimate interests, including site analytics, and withdraw
          an optional email subscription without affecting earlier processing. Email{" "}
          <a href={`mailto:${contact}`}>{contact}</a> to make a request. We may ask for enough
          information to verify that a request concerns your account.
        </p>
        <p>
          You can also raise a concern with the UK{" "}
          <a href="https://ico.org.uk/make-a-complaint/">Information Commissioner’s Office</a> or
          the data-protection authority where you live. The site does not make automated decisions
          with legal or similarly significant effects on you.
        </p>
      </section>
      <section class="prose-section" id="changes" tabIndex={-1} aria-labelledby="changes-h">
        <h3 id="changes-h">Changes to this policy</h3>
        <p>
          We will update this page when the service’s data practices change. The date above
          identifies the current version. For questions about a change, contact Diogo Diogo at{" "}
          <a href={`mailto:${contact}`}>{contact}</a>.
        </p>
      </section>
    </article>
  );
}
