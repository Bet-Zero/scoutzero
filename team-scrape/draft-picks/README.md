# Draft Picks Pipeline (RealGM)

## Purpose
Collect and normalize NBA draft pick data from RealGM, build a league-wide ledger, and produce per-team inventory/obligations/contested views with audits for correctness.

## Entry Points
- `scripts/realgm_draft_picks.ts` - Scrape RealGM team pages and write mentions + structured outputs.
- `../shared/ledger/buildPickLedger.ts` - Build the league ledger and per-team views from mentions.
- `scripts/audit_realgm_rows_vs_mentions.ts` - Meaning-aware audit against live RealGM rows.
- `scripts/audit_semantic_assertions.ts` - Semantic anchor checks against mentions output.
- `scripts/audit_recipient_inventory_invariant.ts` - Invariant: unconditional "To TEAM" must be in TEAM inventory.
- `scripts/generate_ledger_tsv.ts` - 2A counts output (TSV).
- `scripts/generate_ledger_md.ts` - 2B full team lists output (Markdown).
- `scripts/generate_pretty_mentions.ts` - Pretty JSON mention outputs per team.

## Structure
- `scripts/` - CLI scripts for scrape, ledger audits, and report generation.
- `_artifacts/output/` - Scrape outputs (mentions + structured).
- `_artifacts/audits/` - Audit and manual verification outputs.
- `docs/` - Pipeline reference documentation.

## Usage
```bash
# Scrape all teams (writes mentions + structured)
npm run team:draft-picks -- --outDir team-scrape/draft-picks/_artifacts/output

# Build the ledger from mentions
npx tsx team-scrape/shared/ledger/buildPickLedger.ts \
  --input=mentions \
  --inputDir team-scrape/draft-picks/_artifacts/output/mentions

# Run audits
npx tsx team-scrape/draft-picks/scripts/audit_realgm_rows_vs_mentions.ts --teams=ALL
npx tsx team-scrape/draft-picks/scripts/audit_semantic_assertions.ts \
  --teams=ALL \
  --mentionsDir=team-scrape/draft-picks/_artifacts/output/mentions
npx tsx team-scrape/draft-picks/scripts/audit_recipient_inventory_invariant.ts \
  --mentionsDir=team-scrape/draft-picks/_artifacts/output/mentions \
  --ledgerDir=team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team

# Fast verify (no scrape, uses existing mentions)
npm run draft-picks:verify

# Full end-to-end verify (scrape + ledger + audits)
npm run draft-picks:scrape-verify
```

## Output
- Mentions: `team-scrape/draft-picks/_artifacts/output/mentions/draft_picks_mentions_{TEAM}.json`
- Structured: `team-scrape/draft-picks/_artifacts/output/structured/draft_picks_{TEAM}.json`
- Ledger: `team-scrape/shared/firestore_staging/_artifacts/output/ledger/`
- Audits: `team-scrape/draft-picks/_artifacts/audits/`

## Related Documentation
- `team-scrape/draft-picks/docs/OUTPUT_FILE_STRUCTURE.md`
- `docs/commands/DRAFT_PICKS_COMMANDS.md`
- `docs/team-scrape/DRAFT_PICKS_PIPELINE.md`
- `plans/_archive/draft-picks-invariant-guardrail/plan.md`
