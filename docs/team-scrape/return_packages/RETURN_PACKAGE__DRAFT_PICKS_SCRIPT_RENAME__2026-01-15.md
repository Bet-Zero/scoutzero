# Return Package — Rename Draft Picks Scripts

**Date**: 2026-01-15  
**Task**: Rename verify vs scrape+verify scripts + update docs

---

## 1) What Changed (Summary)

Renamed npm scripts to make naming consistent with behavior:

| Old Name | New Name | Behavior |
|----------|----------|----------|
| `draft-picks:verify:local` | `draft-picks:verify` | Build + Reports + Audits (NO scrape) |
| `draft-picks:verify` | `draft-picks:scrape-verify` | Scrape + then run verify |

**Key clarification**: `npm run draft-picks:verify` now does **NOT** scrape—it only runs build+reports+audits on existing mentions.

---

## 2) Exact `package.json` Script Block (After Edits)

```json
"draft-picks:scrape": "npm run team:draft-picks -- --outDir team-scrape/draft-picks/_artifacts/output/mentions",
"draft-picks:build": "npx tsx team-scrape/shared/ledger/buildPickLedger.ts --input=mentions --inputDir team-scrape/draft-picks/_artifacts/output/mentions && npx tsx team-scrape/shared/ledger/buildDraftAssets.ts",
"draft-picks:reports": "npx tsx team-scrape/draft-picks/scripts/generate_ledger_tsv.ts && npx tsx team-scrape/draft-picks/scripts/generate_ledger_md.ts",
"draft-picks:audits": "npx tsx team-scrape/draft-picks/scripts/audit_semantic_assertions.ts --teams=ALL --mentionsDir=team-scrape/draft-picks/_artifacts/output/mentions && npx tsx team-scrape/draft-picks/scripts/audit_recipient_inventory_invariant.ts --mentionsDir team-scrape/draft-picks/_artifacts/output/mentions --ledgerDir team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team && npx tsx team-scrape/draft-picks/scripts/audit_draft_assets_invariant.ts",
"draft-picks:verify": "npm run draft-picks:build && npm run draft-picks:reports && npm run draft-picks:audits",
"draft-picks:scrape-verify": "npm run draft-picks:scrape && npm run draft-picks:verify",
```

---

## 3) Docs Updated

| File | Changes |
|------|---------|
| `docs/commands/DRAFT_PICKS_COMMANDS.md` | Updated Quick Reference and command table with new names |
| `docs/team-scrape/DRAFT_PICKS_PIPELINE.md` | Updated Command Map table and Quick Commands section |
| `team-scrape/draft-picks/README.md` | Updated usage examples |
| `PROJECT_SCHEMA.md` | Updated `draft-picks:verify` documentation |

> [!NOTE]
> Historical return packages (in `docs/team-scrape/return_packages/`) reference the old names. These are archival records and intentionally NOT updated.

---

## 4) Command Results

### ✅ `npm run draft-picks:verify` — PASS

Ran successfully **without scraping** (confirmed: no "Fetching" or "Scraping" output).

```
> npm run draft-picks:build && npm run draft-picks:reports && npm run draft-picks:audits

🔨 Building league-wide draft picks ledger...
   Loaded 30 team files
   Created 377 unique ledger entries

✅ Ledger build complete.
✅ Draft assets written: 415 total assets

=== SEMANTIC ASSERTIONS AUDIT ===
   PROTECTION_ANCHOR_BUT_NO_PROTECTION: 0
   SWAP_ANCHOR_BUT_NO_SWAPDETAILS: 0
   CONTROLLER_ANCHOR_BUT_CONTROLLER_MISSING: 0
   TO_ANCHOR_BUT_NO_RECIPIENT_OR_ROUTE: 0

=== RECIPIENT INVENTORY INVARIANT AUDIT ===
   failures: 0
   ✅ Invariant satisfied.

=== DRAFT ASSETS INVARIANT ===
   ✅ UTA has LAL_2027_1st as conditional_right with protection
   ✅ DAL has LAL_2029_1st as outright_pick
   sanityChecksPassed: true

Exit code: 0
```

### ✅ `npm run draft-picks:scrape-verify` — WIRING CONFIRMED

Started successfully and attempted to scrape (confirmed by "Fetching" output):

```
> npm run draft-picks:scrape && npm run draft-picks:verify

> npm run team:draft-picks -- --outDir team-scrape/draft-picks/_artifacts/output/mentions

🔍 Scraping RealGM future drafts — Teams: ATL, BOS, BKN, ...
🌐 Fetching Atlanta Hawks (ATL) → https://basketball.realgm.com/nba/teams/Atlanta-Hawks/1/draft-picks
```

**Terminated early** to avoid long runtime. Wiring is confirmed correct:

- `draft-picks:scrape-verify` calls `draft-picks:scrape` first
- Then chains to `draft-picks:verify`

---

## 5) Follow-ups / Risks

| Item | Risk | Notes |
|------|------|-------|
| Old docs in return packages | None | Historical records, intentionally preserved |
| Lint warnings in README | Low | Pre-existing formatting issues, not caused by this change |

**No blocking issues.**

---

## Quick Reference (New)

```bash
# Fast verify (no scrape, uses existing mentions)
npm run draft-picks:verify

# Full end-to-end (scrape + verify)
npm run draft-picks:scrape-verify

# Individual steps
npm run draft-picks:scrape    # Scrape only
npm run draft-picks:build     # Build ledger + assets
npm run draft-picks:reports   # Generate TSV/MD reports
npm run draft-picks:audits    # Run all audits
```
