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

The Vercel application has a separate Node endpoint at
`/api/architect/draft-review`. Filesystem routing precedes the SPA fallback,
and unknown API paths return 404 instead of HTML. The endpoint validates the
existing Firebase ID token with Google's project-keyed account lookup before
reading private storage. Existing anonymous GM sessions are supported; this is
access to the derived product projection, not access to private Linear evidence.
No local emulator configuration can redirect the production session check.

Hosting installation (performed by the agent/operator with hosting access):

1. Recover and verify the unchanged private projection from BZE-321 attachment
   `524e6b98-ff1c-4d94-ae9e-53bd2c2106b4`. Its SHA-256 is
   `3f288ba96decf716b25596510beb01d9f741781169e98e553d04c58409530671`.
2. Install only that derived JSON in a **private** Vercel Blob store, at
   `architect/draft-review/<sha256>.json`, with no random suffix. Keep all raw
   source bodies, claim maps, browser traces and cases in private Linear.
3. Configure server-only `SCOUTZERO_DRAFT_REVIEW_BLOB_URL` with the exact private
   object URL and `BLOB_READ_WRITE_TOKEN` with the store credential. Retain the
   application's existing `VITE_FIREBASE_PROJECT_ID=scoutzero-bf1ae` and
   `VITE_FIREBASE_API_KEY`. Never give the storage variables a `VITE_` prefix.
4. Deploy through the existing GitHub/Vercel integration. Verify a real hosted
   GM session can retrieve the unchanged bytes; verify missing/invalid sessions
   are rejected and unavailable/corrupt storage stays fail-closed. Then run the
   Trade Machine cases in that hosted application. A green deployment alone is
   not proof that the private data has been installed.

The endpoint makes read requests only, rejects redirects, caps body size and
upstream time, verifies the installed pin before responding, and disables browser
and CDN caching. It never forwards storage credentials or upstream errors.
Without hosting/storage access, record installation and hosted positive proof as
blocked; do not publish the package in GitHub or a static Vite asset as a workaround.

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
exact byte delivery with controlled auth/storage responses. Neither test claims
to verify an actual hosted Firebase session or installed Vercel Blob object.
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
