# Changelog and release evidence

How a change travels from a PR to the public What’s new page, and how to prove it is live.
Plan and reasoning: [changelog-plan.md](changelog-plan.md).

## Fragments

Each PR adds `changelog/entries/<id>.json` (schema: `src/shared/changelog.ts`). Rules for
writing one live in `AGENTS.md`.

| Command                              | Purpose                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| `npm run changelog:new -- <id>`      | Scaffold an internal fragment to edit                    |
| `npm run changelog:validate`         | Schema, duplicate IDs, links, registered features        |
| `npm run changelog:policy -- <base>` | The PR check: a fragment was added, none removed/renamed |
| `npm run changelog:build`            | Writes `public/changelog.json` + `public/version.json`   |

`changelog:build` runs before every `dev` and `build`. It needs full git history: the
**Change date** shown on the page is the London date of the commit that first added the
fragment to the checked-out history (the squash-merge date on `main`). It is not the date the
change went live. Uncommitted fragments show as “Not yet merged”. Rebuilding the same commit for
fresh screenings produces byte-identical output, so the twice-daily data deploy never adds
entries.

`changelog/features.json` registers flags (`"name": true|false`). A public fragment with
`feature` set to a disabled flag stays out of the build; an unknown name fails validation.

## Enforcement

`.github/workflows/ci.yml` runs the `changelog-policy` job on every pull request. A repository
ruleset on `main` makes that check required — a workflow alone does not block merges.

## Deploy and verification

`.github/workflows/deploy.yml` builds the app and `changelog.json` from the same commit and
uploads both in one Pages deployment, so a note can never be live ahead of its code. Then
`npm run deployment:verify` polls the new deployment URL and `https://london-cine.info` until
`/version.json` and `/changelog.json` match the revision and content hash just built (up to
two minutes each). On success it writes `deployment-receipt.json` (SHA, Pages deployment ID and
URL, entry IDs, run link), kept as a workflow artifact for 90 days.

If verification fails the workflow fails and GitHub notifies the owner. **The deployment may
already be live** — check the site before re-running. Do not mark issues released.

## Releasing linked issues (manual in v1)

A merged PR closing an issue means implemented, not released. After a Deploy run whose
verification passed, on each linked engineering issue:

1. Add the `released` label.
2. Comment with the evidence so it outlives the artifact:
   `Released in <sha> — Pages deployment <id> — entry <entry-id> — <run link>`.

Listing/data corrections fixed by a data refresh have no fragment; note the data
`generatedAt` from the About page as evidence instead.

## Rollback

1. Cloudflare dashboard → Pages → london-cine-info → Deployments → roll back to the previous
   production deployment. App and changelog roll back together.
2. Confirm `https://london-cine.info/version.json` shows the earlier SHA.
3. On issues released by the rolled-back deployment: remove `released`, comment
   `Rolled back <date>: <reason>`, and reopen the canonical issue if the problem is live again.
   Keep the earlier release comments.
4. D1 migrations are not undone by a Pages rollback; migrations must stay compatible with the
   previous app.
5. Fix forward on `main`; the next verified deploy restores the entry.
