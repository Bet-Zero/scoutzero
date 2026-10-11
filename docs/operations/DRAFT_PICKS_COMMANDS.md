# Draft Picks Pipeline — Commands

> **Source note.** The commands below (`draft-picks:*` / `team:draft-picks`) are
> the **RealGM (legacy)** path, kept as a backup. The current/primary draft-pick
> source is **ProSportsTransactions (PST)** — its `pst:*` pipeline produces the
> data the app actually uses (`architect_baseEntitlements`,
> `architect_basePickRules`, `data/pst/`). See
> [`team-scrape/draft-picks/README.md`](../../team-scrape/draft-picks/README.md).

Run everything from **repo root** (the folder that contains `package.json`).

## Retained first-round review in Trade Machine

The first real-data slice reads a privately retained, pinned projection from
the BZE-321 Linear evidence attachment. Recover `real-draft-review.json` outside
the repository and start the existing development/review server with
`SCOUTZERO_DRAFT_REVIEW_RELEASE=/absolute/private/path/real-draft-review.json`.
The Vite read service returns only that exact installed projection. It never
bundles the package into public assets, retrieves raw source bodies, adopts a
release into Firestore, or enables first-round Apply. An absent or changed
installation shows a needs-input result.

The hosted application keeps the same Node endpoint at
`/api/architect/draft-review`. Vercel hosts the app; **Firebase/Firestore is the
only product data source**. Linear retains development evidence and is never
queried by the product. The browser supplies its existing Firebase ID token.
Google's project-keyed lookup validates that exact session; Firestore then
applies its security rules to read requests using that same token. Existing
anonymous GM sessions can read the derived projection. No admin/storage secret
is needed, and production never consults emulator configuration.

The endpoint reads one exact version from
`architect_draftPickReleases/<payloadSha256>`, then its four `parts/0` through
`parts/3` documents. The unchanged 1,608,904-byte projection exceeds Firestore's
1 MiB document limit; 512 KiB binary parts fit safely within it. The manifest
binds format, payload and inventory hashes, acceptance reference, byte length,
part size and count. Parts bind index and payload identity. There is no `latest`
pointer, external URL, provider selector, or source fallback. Full byte length
and SHA-256 must match before a response is sent. A hash authenticates the
retained artifact, not missing basketball facts or publication permission.

Firestore rules permit authenticated individual reads and deny client listing,
create, update and delete. Unknown paths and parts without a manifest fail
closed. These rules are code only until separately authorized deployment.
Nothing here modifies `architect_baseEntitlements`, other source collections,
saved worlds, or first-round Apply.

Release preparation and gated deployment:

1. The agent may recover the unchanged derived projection from private evidence
   for development and offline preparation. Never ship raw sources, claim maps,
   cases or traces as product data. Prepare a private, non-overwriting document
   bundle without network access:

   ```bash
   npm run architect:draft-review:prepare -- /private/real-draft-review.json /private/firestore-release.json
   ```

2. Production publication and rule deployment require separate owner authority.
   The October 11 continuation grants that authority for this exact reviewed
   release and its narrow read-only rules only. Access and live verification
   remain unsatisfied; no broader release or source write is authorized.
   The prepared bundle is reviewable input, not an installed release.
   A qualified, authorized publisher must create the four parts and
   manifest at their exact immutable IDs, with no overwrite; publish the
   manifest last. Do not run production push/admin/source pipeline commands or
   repurpose protected source collections. Later releases require their own
   qualification, publication gate and code pin; never silently replace one.
3. After that authorization and scoped Firebase access, deploy the narrow rules
   and publish only the accepted derived version. Keep the app's existing
   `VITE_FIREBASE_PROJECT_ID=scoutzero-bf1ae` and `VITE_FIREBASE_API_KEY`.
   No new provider credentials or environment-based data endpoint is accepted.
4. Use the existing GitHub/Vercel app deployment. Prove real hosted Firebase
   authentication, exact release bytes, unsigned/invalid/foreign-session
   rejection, and the Trade Machine GM review flow with no world/source writes.
   A green preview build or emulator proof does not establish live delivery.
   Keep the PR unmerged until authorized installation and hosted proof pass.

### Keyless GitHub connection for this installation

The owner confirmed there is no Firebase credential in repository Actions or
the Production environment; do not request additional GitHub metadata access.
Use Google Cloud Workload Identity Federation with service-account impersonation.
The account is `scoutzero-draft-release@scoutzero-bf1ae.iam.gserviceaccount.com`;
the pool/provider is `scoutzero-bze321/github`. These are proposed configuration
identifiers until an authorized administrator creates/verifies them, not a claim
of a live connection. No private key or permanent credential file is needed.

`scripts/architect/draftReviewCloudConnection.ts` produces the exact public IAM
configuration from a verified project number and independently accepted commit.
An agent with authorized project IAM access performs the bootstrap, not the
product owner through a technical checklist:

- Read the project number from Google Cloud for `scoutzero-bf1ae`; never guess
  it or use a project number from another account. Set that public number in
  `.github/workflows/draft-review-cloud.yml`, then finish CI and Claude review.
- Generate the plan for that exact accepted head. Create the dedicated pool,
  OIDC provider, service account and custom role only if absent. Compare any
  existing configuration first; stop on an unexpected collision. Enable only
  the required IAM Credentials/STS/Firestore/Rules APIs if necessary; do not
  create a database or change its configuration.
- Apply the plan's account and project bindings by merging into current IAM
  policies with their etags. Never replace unrelated bindings. The bootstrap
  identity needs IAM setup authority; the runtime account does not receive it.
- Provider trust requires the immutable repository and owner IDs, repository
  name, exact branch/workflow, Production environment subject, push event and
  accepted commit SHA together. Forks, PR merge refs, other workflows and later
  commits cannot reuse the grant. GitHub repository names alone are insufficient.
- The initial custom role allows database/document and Rules reads only. The
  plan separately lists publication permissions; add those only after publisher
  review and the corresponding exact-commit trust update. Even then the account
  has no document update/delete, IAM administration,
  key creation, index, source-pipeline or saved-world mutation privileges.
  Firestore IAM cannot narrow entity permissions to five document paths:
  the reviewed publisher must additionally enforce the fixed paths and
  create-only preconditions. Do not claim IAM itself supplies that path boundary.

The new workflow initially has an empty project number and skips authentication.
This is an explicit **unconfigured** state, not a passing cloud proof. Once IAM
is installed, rerun the push run for the accepted commit. The provider's commit
restriction must match that run; do not widen it just to make a run pass.
The pinned Google action obtains a ten-minute OAuth token in runner memory with
`create_credentials_file: false`. Checkout persists no GitHub credential and
dependency lifecycle scripts are disabled before authentication.

The only post-authentication command is a GET-only preflight. It checks the
actual native Firestore database, active rules release, ruleset and all five
immutable document paths. Active rules must exactly match the accepted base or
approved rules; unknown drift stops without replacement. Existing documents
must be wholly absent or reconstruct the exact accepted payload. Partial or
conflicting installation stops for agent investigation, never overwrite.
Logs contain only safe status/hashes, not tokens, rules bodies or private data.

This workflow cannot install data or rules. After its live read passes, the
agent must still perform the authorized create-only installation using a
reviewed publisher and a separately pinned trust update. The private projection
must not be committed or uploaded as a public GitHub artifact; GitHub execution
does not relax existing private-evidence handling. Remove this lane's trust or
disable its provider after the installation assignment is complete. Do not
turn it into a general production deployment service.

References: [Google's GitHub federation setup](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
and [Firebase CI authentication](https://firebase.google.com/docs/cli#cli-ci-systems).

The endpoint makes GET requests for data only, rejects redirects, bounds each
response and upstream time, and disables browser/CDN caching. Provider errors
never reach the browser. Unavailable/invalid releases remain needs-input. Missing
access must be reported precisely; it never permits another data provider,
a static public copy, or an unapproved production publication.

Architecture enforcement: the mandatory CI guard walks the actual endpoint
import closure and network call sites, rejects new provider dependencies and
non-Firebase release calls, and checks the client still uses the same-origin
endpoint. Its negative cases include the rejected Blob approach and Linear
runtime access. Transport tests separately inspect every effective request URL,
method and credential. The governing Architect boundary requires independent
review to trace this actual flow against both owner architecture comments.

Select a first-round entitlement in the normal Trade Machine. Its June 5
starting-position review distinguishes recorded grants, future exercise
alternatives, archived pool entries, independent component results, and the
missing facts relevant to transfer. It does not certify later saved-world
changes. All 278 inventory records and their original occurrence links remain
in the package; the current 29-fact action/source crosswalk is retained with it.
Only selected accepted grant/election scopes and one complete ownership scope
are mapped in this slice. Unmapped facts cannot be inferred from a release hash.

After a complete diagnostic browser run, freeze and push the clean candidate.
Retain the exact-head proof through the existing wrapper:

```bash
SCOUTZERO_DRAFT_REVIEW_RELEASE=/absolute/private/path/real-draft-review.json \
SCOUTZERO_DRAFT_REVIEW_CASES=/absolute/private/path/browser-cases.json \
npm run architect:proof:trade-receipt -- --real-draft
```

The scenario file contains real selected IDs and expected outcomes, not runtime
authority. The proof uses emulator-only presentation worlds, the installed
product loader, all nine changed states at 1280×720, reload/stale-response/date
checks, and saved-state comparisons proving review creates no writes. Keep its
source-bearing manifest, trace, cases, and projection in private Linear.
The browser proof also checks that the existing session token accompanies API
requests. It uses the local read service; the separate Node HTTP adapter test
can load the real private file with `SCOUTZERO_DRAFT_REVIEW_RELEASE` and prove
exact byte delivery with controlled Google/Firestore responses. The Firestore
emulator gate checks authenticated reads and denied writes with the actual rules;
its optional private-file case reconstructs all real bytes. None of these proofs
substitutes for an actual hosted Firebase session and authorized release.
This review does not complete the outstanding source closure or V1 gates.

---

## Quick Reference

**If you want fresh data (full end-to-end scrape + verify):**

```bash
npm run draft-picks:scrape-verify
```

**If you already scraped and just want to re-check (fast, no scrape):**

```bash
npm run draft-picks:verify
```

**If you're debugging individual steps:**

```bash
npm run draft-picks:build    # Build ledger + assets only
npm run draft-picks:reports  # Generate TSV/MD reports
npm run draft-picks:audits   # Run all audits
npm run draft-picks:assets-manual-check  # Generate clean manual check output
```

---

## What Each Command Does

| Command                     | Description                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| `draft-picks:scrape`        | Scrape RealGM draft picks for all 30 teams                       |
| `draft-picks:build`         | Build ledger from mentions + build draft assets (no audits)      |
| `draft-picks:reports`       | Generate TSV counts and MD pick lists for manual verification    |
| `draft-picks:audits`        | Run semantic, recipient inventory, and draft assets audits       |
| `draft-picks:verify`        | Build + Reports + Audits (no scrape, uses existing mentions)     |
| `draft-picks:scrape-verify` | Scrape + verify (full end-to-end)                                |
| `draft-picks:assets-manual-check` | Generate clean one-line-per-pick manual check output       |
| `team:publish`              | Stage and push all teams to Firestore (runs stage:team + push)   |

---

## Audit Outputs

All audits write to: `team-scrape/draft-picks/_artifacts/audits/`

| Audit                        | Report File                                    |
| ---------------------------- | ---------------------------------------------- |
| Semantic Assertions          | `semantic_assertions_report.json`              |
| Recipient Inventory Invariant | `recipient_inventory_invariant_report.json`   |
| Draft Assets Invariant       | `draft_assets_invariant_report.json`           |

---

## Verification Outputs

| Output Type      | Location                                                                            |
| ---------------- | ----------------------------------------------------------------------------------- |
| Mentions         | `team-scrape/draft-picks/_artifacts/output/mentions/`                               |
| Structured picks | `team-scrape/draft-picks/_artifacts/output/structured/`                             |
| Ledger (master)  | `team-scrape/shared/firestore_staging/_artifacts/output/ledger/pick_ledger.json`    |
| Ledger (by team) | `team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team/{TEAM}.json` |
| Draft assets     | `team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/{TEAM}.json`   |
| Staged baseTeams | `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/{TEAM}.json`      |
| Audit reports    | `team-scrape/draft-picks/_artifacts/audits/`                                        |
| Draft Asset Review | `team-scrape/draft-picks/_artifacts/audits/draft_assets_team_lists.md`            |
| **Manual Check** | `team-scrape/draft-picks/_artifacts/audits/draft_assets_manual_check.md`            |

---

## Staging and Push

> [!IMPORTANT]
> Verify commands do NOT push to Firestore. To push:

```bash
# Stage first (prepares baseTeams JSONs)
npm run stage:team

# Push to Firestore
npm run team:push LAL BOS CHI  # specify teams

# Or do both in one command:
npm run team:publish
```

---

## Sanity Checks

**Must-Pass Invariants** (checked by `draft-picks:audits`):

- UTA must have `LAL_2027_1st` as `conditional_right` with `tradeableNow: true`
- DAL must have `LAL_2029_1st` as `outright_pick` with `tradeableNow: true`
- All 30 teams must have draft assets files

**Quick grep checks for canonical team codes:**

```bash
grep -R '"BRK"' team-scrape/draft-picks/_artifacts/output 2>/dev/null | wc -l  # Target: 0
grep -R '"PHO"' team-scrape/draft-picks/_artifacts/output 2>/dev/null | wc -l  # Target: 0
```
