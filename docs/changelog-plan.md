# Live changelog and agent workflow — proposed plan

Status: implemented 12 October 2026 — see [changelog.md](changelog.md) for the operating guide.
Feedback is collected through PostHog Surveys and reviewed before creating GitHub engineering issues,
as described in [user-feedback-plan.md](user-feedback-plan.md). Raw responses remain private in
PostHog; engineering issues use the existing repository, public or private. No custom inbox, separate
private intake repository or D1 feedback queue is required. The changelog can ship independently.

## Reader experience

A permanent What’s new link beside Feedback in the sidebar and phone Pages menu, plus a public
`/changelog` page with stable entry anchors. The page uses the existing app layout. Entries contain
a short title, Added / Improved / Fixed category, one or two sentences about changed user behaviour,
and an optional link to try the feature. Show newest first, group by date and paginate when needed.
No changelog modal, interruption, carousel or banner on page load. Start without an unread badge.
A subtle New label can be considered later if people cannot find updates; never show a count.

Notes describe the benefit and any action a user needs to take. Do not publish commit messages,
internal refactors, agent activity, private report content, security details or speculative work.
Changes restricted behind a disabled production flag must stay unpublished until enabled.
Routine screening-data refreshes keep their current Updated timestamp and never enter this log.

Initial sample copy is based on merged Account, Friends and Settings work. At launch, publish
one deliberately reviewed baseline entry, then track future changes; do not fabricate past release
history or infer deployment dates from merge times.

## Agent contract

Every user-facing PR includes a structured fragment, e.g. `changelog/entries/<stable-id>.json`:

- `id`: immutable slug; `type`: added / improved / fixed.
- `title`, short `body`, optional safe same-origin `href` and link label.
- `visibility`: public or internal; internal entries require a reason.
- Keep raw PostHog response references and contact details in a private triage note. Link the
  sanitised engineering issue, PR and stable release-entry ID there. Public fragments/PRs/assets
  must not expose those private response references or content.

The schema and linter constrain lengths, categories, duplicate IDs, links and plain-text content.
Fragments are separate files so agents on parallel branches do not conflict in one CHANGELOG.md.
The agent writes the fragment while implementing the change, then updates it after final scope
changes. The PR reviewer sees it beside the implementation. Agents must not claim a feature is
live or announce a fix before the deployment stage has completed.

Add concise repository-owned guidance for all coding agents and a PR-template checkbox. This is
project workflow guidance, not a copy of Dio’s personal UX preferences. A generator command
scaffolds a fragment; validation and CI enforce it. There is no second LLM rewriting notes at deploy
time, so publishing remains deterministic and requires no model/API credentials.

Require a `changelog-policy` check on every PR, not just path-filtered workflow runs. It requires
a fragment or an explicit, reviewable internal-only reason. Changed UI/API paths can be flagged
for particular scrutiny, but path rules cannot decide whether copy is accurate or meaningful.
Use a required GitHub ruleset/status check for enforcement; adding a workflow alone does not
block merges. Record internal reasons in version control rather than trusting an arbitrary label.

## Publishing with the existing Cloudflare deployment

The current `.github/workflows/deploy.yml` runs on main pushes, scheduled data rebuilds and manual
runs; it checks the app, generates screening data and uploads `dist` to Cloudflare Pages.
Extend this path rather than introducing a separate publishing service.

1. Validate fragments during PR CI and production checks. Generate a sorted, sanitized public
   changelog JSON/index bundled with the app from the exact checked-out revision.
2. Bundle public notes with that same Pages deployment. A merge alone makes nothing public.
   Failed builds/uploads do not expose candidate notes. Preview hosts show a Preview label.
3. Keep entry IDs stable. Rebuilding identical code for fresh screenings produces identical notes
   and no new entry. The group date can use the fragment’s merge date, explicitly named Change
   date; never label that as the production publication date. Record actual deployment time in
   the deployment receipt separately. If exact first-publication dates are later needed in the UI,
   add a release registry rather than rewriting dates on each scheduled build.
4. After deploy, verify the production version endpoint/manifest matches the intended SHA and
   that the matching changelog is served. Save a receipt with SHA, deployment ID, URL, timestamp
   and entry IDs. A failed smoke check fails the workflow and alerts the owner; it cannot silently
   mark linked engineering issues `released`. The deployment might already be live, so report that distinction.
5. For v1, retain the successful deployment receipt as a workflow artifact with explicit retention,
   and link the run/production entry on the GitHub engineering issue. No D1 feedback-status writes
   or custom inbox integration. If the workflow closes an engineering issue at merge, treat
   that as implementation complete only; a `released` label/comment requires the production check.
   Store the SHA, deployment ID and entry ID in the engineering issue release comment so the evidence survives
   artifact expiry. A source-data correction without a code PR needs its own verified data snapshot
   evidence and need not produce an app changelog entry.

User-visible flags need explicit handling: validate that a public entry’s feature is included and
active in the deployed artifact. If runtime flags are introduced later, publishing must share their
activation process. Do not let an agent mark a dormant feature public just to satisfy CI.

Rollback restores the earlier app and bundled changelog together. The rollback checklist also
removes `released` from affected engineering issues, adds a rollback comment and reopens the canonical
engineering issue when the problem is live again. Retain the prior release evidence. Test this with
preview deployments and synthetic test issues. D1 schema changes must remain compatible with the
previous app; a Pages rollback does not undo a database migration.

External GitHub Releases, email and social announcements are out of v1. They are separate channels
with delivery/retraction semantics. The live website changelog satisfies the initial publication
requirement without creating a second source of truth or posting to users automatically.

## Implementation sequence and checks

1. Fragment schema, scaffold/validate/build commands, agent guidance and required CI check.
2. Public page/navigation and baseline note. Include stable anchors and accessible responsive layout.
3. Deploy version manifest, post-deploy verification, receipts and retry/rollback checks.
4. Document the handoff: PostHog response → reviewed GitHub engineering issue/PR → release-entry ID
   → verified deployment. Keep response links in the private triage note. Manual/agent triage and
   manual replies are sufficient for v1; changelog publication is automatic.

Exercise: public feature, bug fix, internal-only change, missing/duplicate/invalid fragment,
invalid external link, disabled feature, failed build/deploy, repeated scheduled deployment,
several merged PRs in one deployment, a failed receipt upload and a rollback.

Acceptance: a user-facing PR cannot merge without a valid note or reviewed exclusion; no merged
but undeployed change appears on the production page; no daily-refresh duplicates; live note and
app SHA agree; retries are idempotent; rollback restores consistent public content; entry links
work at desktop and phone widths. Human review assesses factual copy; CI assesses the contract.

## Optional later automation

If manual release labelling becomes repetitive, add an idempotent post-deploy job that updates only
explicitly linked GitHub engineering issues. Use narrowly scoped repository credentials,
verify the current production SHA, and key a comment/update by deployment ID + entry ID. A rerun must
not create duplicate comments. Retry failed GitHub writes separately from deployment; make failures
visible without claiming the deployment itself failed. Handle rollback for the canonical issue;
use the private PostHog triage mapping for any later reporter follow-up. No raw survey payload or
PostHog contact information enters the deployment job. Never infer authorisation to implement or
publish from a user's report.

This is an optional reduction in triage work, not a prerequisite for an automatically published
changelog. This is also separate from optional PostHog survey-to-GitHub routing, whose mapping and
reliability require an integration test. Reporter emails remain a deliberate manual action unless
separately designed and enabled.

Platform references checked for this plan:

- GitHub required checks: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Cloudflare Pages rollbacks: https://developers.cloudflare.com/pages/configuration/rollbacks/

## Prototype

`/changelog` in the isolated worktree demonstrates reader-facing copy and layout, with explicit
sample-date labelling. It does not implement generation, publication, a release registry or CI.
