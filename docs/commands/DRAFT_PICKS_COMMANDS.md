# Draft Picks Pipeline — Commands (Saved)

Run everything from **repo root** (the folder that contains `package.json`).

---

## 0) One-time sanity check (you are in repo root)

```bash
pwd
ls
ls package.json
```

If `ls package.json` says “No such file”, you are NOT in the repo root.

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

## D) Audits (Semantic + Meaning-Aware)

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

## F) “Do it all” (Full Rebuild + Outputs + Audits)

```bash
rm -rf team-scrape/draft-picks/_artifacts/output/*
npm run team:draft-picks -- --outDir team-scrape/draft-picks/_artifacts/output

npx tsx team-scrape/shared/ledger/buildPickLedger.ts \
  --input=mentions \
  --inputDir team-scrape/draft-picks/_artifacts/output/mentions

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
```

---

## G) One-Command Verify (Scrape + Ledger + Audits)

```bash
npm run draft-picks:verify
```
