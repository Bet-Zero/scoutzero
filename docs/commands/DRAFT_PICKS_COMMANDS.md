# Draft Picks Pipeline — Commands (Saved)

Run everything from **repo root** (the folder that contains `package.json`).

---

## 0) One-time sanity check (you are in repo root)

```bash
pwd
ls
ls package.json
```

If `ls package.json` says "No such file", you are NOT in the repo root.

---

## A) Clean + Scrape (ALL teams)

```bash
rm -rf team-scrape/draft-picks/_artifacts/output/*
npm run team:draft-picks -- --outDir team-scrape/draft-picks/_artifacts/output
```

---

## B) Build the Pick Ledger (from mentions)

```bash
npx tsx team-scrape/shared/ledger/buildPickLedger.ts \
  --input=mentions \
  --inputDir team-scrape/draft-picks/_artifacts/output/mentions
```

---

## B2) Build Draft Assets (from ledger views)

```bash
npx tsx team-scrape/shared/ledger/buildDraftAssets.ts
```

Options:

- `--ledgerDir=<path>` - Override ledger input directory
- `--outDir=<path>` - Override output directory

Output:

- `team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/{TEAM}.json`

---

## C) Generate Manual Verification Outputs (2A + 2B + Pretty Mentions)

```bash
npx tsx team-scrape/draft-picks/scripts/generate_ledger_tsv.ts
npx tsx team-scrape/draft-picks/scripts/generate_ledger_md.ts
npx tsx team-scrape/draft-picks/scripts/generate_pretty_mentions.ts
```

Outputs:

- `team-scrape/draft-picks/_artifacts/audits/ledger_team_pick_counts.tsv` (2A)
- `team-scrape/draft-picks/_artifacts/audits/ledger_team_pick_lists.md` (2B)
- `team-scrape/draft-picks/_artifacts/audits/pretty_mentions/` (pretty JSON, 30 files)

---

## D) Audits (Semantic + Meaning-Aware + Invariants)

### D1) Semantic Assertions

```bash
npx tsx team-scrape/draft-picks/scripts/audit_semantic_assertions.ts \
  --teams=ALL \
  --mentionsDir=team-scrape/draft-picks/_artifacts/output/mentions
```

Report written to:

- `team-scrape/draft-picks/_artifacts/audits/semantic_assertions_report.json`

### D2) Meaning-Aware Audit

```bash
npx tsx team-scrape/draft-picks/scripts/audit_realgm_rows_vs_mentions.ts --teams=ALL
```

### D3) Recipient Inventory Invariant

```bash
npx tsx team-scrape/draft-picks/scripts/audit_recipient_inventory_invariant.ts \
  --mentionsDir=team-scrape/draft-picks/_artifacts/output/mentions \
  --ledgerDir=team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team
```

Report written to:

- `team-scrape/draft-picks/_artifacts/audits/recipient_inventory_invariant_report.json`

### D4) Draft Assets Invariant

```bash
npx tsx team-scrape/draft-picks/scripts/audit_draft_assets_invariant.ts
```

Options:

- `--assetsDir=<path>` - Override draft assets directory
- `--ledgerDir=<path>` - Override ledger directory

Report written to:

- `team-scrape/draft-picks/_artifacts/audits/draft_assets_invariant_report.json`

**Must-Pass Checks**:

- UTA must have LAL_2027_1st as `conditional_right` with protection
- DAL must have LAL_2029_1st as `outright_pick`
- All 30 teams must have draft assets files

---

## E) Quick Grep Checks (Canonical Team Codes)

```bash
grep -R '"BRK"' team-scrape/draft-picks/_artifacts/output 2>/dev/null | wc -l
grep -R '"BRO"' team-scrape/draft-picks/_artifacts/output 2>/dev/null | wc -l
grep -R '"PHO"' team-scrape/draft-picks/_artifacts/output 2>/dev/null | wc -l
```

Targets:

- BRK = 0
- BRO = 0
- PHO = 0

---

## F) "Do it all" (Full Rebuild + Outputs + Audits)

```bash
rm -rf team-scrape/draft-picks/_artifacts/output/*
npm run team:draft-picks -- --outDir team-scrape/draft-picks/_artifacts/output

npx tsx team-scrape/shared/ledger/buildPickLedger.ts \
  --input=mentions \
  --inputDir team-scrape/draft-picks/_artifacts/output/mentions

npx tsx team-scrape/shared/ledger/buildDraftAssets.ts

npx tsx team-scrape/draft-picks/scripts/generate_ledger_tsv.ts
npx tsx team-scrape/draft-picks/scripts/generate_ledger_md.ts
npx tsx team-scrape/draft-picks/scripts/generate_pretty_mentions.ts

npx tsx team-scrape/draft-picks/scripts/audit_semantic_assertions.ts \
  --teams=ALL \
  --mentionsDir=team-scrape/draft-picks/_artifacts/output/mentions

npx tsx team-scrape/draft-picks/scripts/audit_realgm_rows_vs_mentions.ts --teams=ALL

npx tsx team-scrape/draft-picks/scripts/audit_recipient_inventory_invariant.ts \
  --mentionsDir=team-scrape/draft-picks/_artifacts/output/mentions \
  --ledgerDir=team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team

npx tsx team-scrape/draft-picks/scripts/audit_draft_assets_invariant.ts
```

---

## G) One-Command Verify (Scrape + Ledger + Assets + Audits)

```bash
npm run draft-picks:verify
```

This command:

1. Cleans output directories
2. Runs RealGM scrape for all 30 teams
3. Builds ledger from mentions
4. Builds draft assets from ledger
5. Generates manual verification outputs
6. Runs all audits (semantic, meaning-aware, recipient inventory, draft assets)

---

## H) Local Verify (NO Scrape - Fast Iteration)

```bash
npm run draft-picks:verify:local
```

This command runs everything EXCEPT the scrape step. Use when you already have mentions and want to quickly rebuild/audit:

1. Builds ledger from existing mentions
2. Builds draft assets from ledger
3. Generates verification outputs
4. Runs all audits

**Prerequisite**: Mentions must already exist in `team-scrape/draft-picks/_artifacts/output/mentions/`

---

## I) Proof Print (Verify Specific Assets)

Check that specific required assets exist:

```bash
# UTA must have LAL_2027_1st (conditional)
grep -A10 "LAL_2027_1st" team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/UTA.json

# DAL must have LAL_2029_1st (outright)
grep -A10 "LAL_2029_1st" team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/DAL.json
```

---

## Output File Locations

| Output Type      | Location                                                                            |
| ---------------- | ----------------------------------------------------------------------------------- |
| Mentions         | `team-scrape/draft-picks/_artifacts/output/mentions/`                               |
| Structured picks | `team-scrape/draft-picks/_artifacts/output/structured/`                             |
| Ledger (master)  | `team-scrape/shared/firestore_staging/_artifacts/output/ledger/pick_ledger.json`    |
| Ledger (by team) | `team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team/{TEAM}.json` |
| Draft assets     | `team-scrape/shared/firestore_staging/_artifacts/output/draft_assets/{TEAM}.json`   |
| Staged baseTeams | `team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/{TEAM}.json`      |
| Audit reports    | `team-scrape/draft-picks/_artifacts/audits/`                                        |
