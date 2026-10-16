# Privacy policy maintenance

The published policy is `src/components/privacy.tsx`, at `/privacy`.
Operator and private contact were supplied by dio on 12 October 2026:
Diogo Diogo, diogo.seabra.diogo@gmail.com.

The text is original. Letterboxd's notice provided a reference for the topics to cover;
its advertising, payments, corporate entities and service-specific claims do not describe this site.

Sources checked on 12 October 2026:

- [Letterboxd privacy notice](https://letterboxd.com/legal/privacy-notice/)
- [ICO privacy information guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/)
- [ICO storage exceptions and objection mechanisms](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/)
- [Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/)
- [Resend privacy policy](https://resend.com/legal/privacy-policy)
- [PostHog SDK privacy controls](https://github.com/PostHog/posthog-js/blob/main/packages/browser/src/posthog-core.ts)

Verify policy statements against implementation when changing data practices:

| Topic                                                       | Implementation                                           |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| Account creation, request limits, updates and deletion      | `functions/api/[[path]].ts` and migrations               |
| Single-use 15-minute sign-in links; rolling 90-day sessions | API and `server/security.ts`                             |
| Favourite cinemas and location lookup                       | `src/lib/cinemas.ts`, `src/components/my-cinemas.tsx`    |
| Friend access and removal                                   | `server/friends.ts`, `server/friend-queries.ts`          |
| One-hour public-list cache                                  | `server/public-watchlists.ts`                            |
| Expired record cleanup                                      | `scripts/refresh-watchlists.ts`                          |
| Browser identifiers, measurements, privacy guards           | `src/lib/analytics.ts`, `packages/core/src/analytics.ts` |
| Request analytics opt-out and independent scheduled metrics | `server/analytics.ts`, API and importer                  |
| Feedback payload, Send-only capture, opt-out fallback       | `packages/core/src/feedback.ts`, `src/lib/feedback.ts`   |

The browser analytics switch stops new collection and sends the existing request-level opt-out
header. It does not promise to cancel already queued delivery, delete historical analytics,
or change scheduled importer metrics. The policy distinguishes active-database deletion from
provider delivery records, analytics and backups. Provider retention periods, processing locations
and contractual transfer safeguards cannot be inferred from source code; keep their disclosure
and private-contact route current when provider settings or arrangements change.

On 12 October 2026, the policy was restructured with a summary, section map, definition lists
and storage/retention tables. Copy was re-cut rather than rewritten; the data practices,
retention disclosures and rights remain the same.

## Phone apps

The Expo app shares accounts and API retention with the website. Its session token is held
in SecureStore (device keychain/keystore), never AsyncStorage. Guest cinema IDs, a random
reconciliation identity, display settings and the analytics choice use AsyncStorage. A
validated catalogue snapshot is held in the OS cache and may be evicted. Sign-in codes and
links expire after 15 minutes; both create the same rolling 90-day session.

Near me requests foreground coarse location only, calculates distances on-device and never
persists or sends the coordinates. Calendar actions open the system event editor; export
writes an ICS file to temporary cache and opens the native share sheet. No existing calendar
events are imported. Usage analytics is off by default in the app and is enabled only by
the Account switch; request opt-out headers use the same backend path as the website.

Store privacy disclosures must include account email, optional coarse location used on the
device, account-linked usage analytics only after opt-in, platform crash/diagnostic collection
actually enabled in the final binary, and the linked privacy policy. Recheck the built
permissions and SDK disclosure manifests before each submission (docs/mobile.md).
