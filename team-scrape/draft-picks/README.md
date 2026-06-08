# Draft Picks Pipeline

Collect NBA draft-pick data, build a league-wide ledger, reconcile ownership
(protections, swaps, conditions, contested cases), and produce the entitlements
and pick rules consumed by the Architect / Trade Machine.

## Sources — current vs legacy

| Source | Status | Scripts | npm |
| ------ | ------ | ------- | --- |
| **ProSportsTransactions** (`prosportstransactions.com`) | **Primary / current** | `scripts/pst/pst_*.ts` | `pst:*` |
| RealGM (`basketball.realgm.com`) | **Legacy backup** — complete and functional, kept intentionally as a fallback; not the active source | `scripts/realgm_draft_picks.ts` | `team:draft-picks`, `draft-picks:*` |

The authoritative pick data the app actually uses — `architect_baseEntitlements`,
`architect_basePickRules`, `baseTeams.entitlementIds`, and the `data/pst/`
ledger / entitlement artifacts — is produced by the **ProSportsTransactions
(PST)** pipeline. The RealGM workflow documented further below is the original
implementation, kept as a backup.

> **Heads-up:** PST fetching is **not** a fully-unattended scrape. The source
> blocks headless bots, so the pipeline has a session-capture step that opens a
> **real (headed) browser window** for a human to establish a session
> (`pst:session:capture`, `launch_chrome_debug_helper.ts`). The automated fetch
> then reuses that saved session headlessly (`pst:fetch:session`).

## ProSportsTransactions (PST) pipeline — current

Runs as a sequence of `pst:*` npm scripts, roughly:

1. **Session + fetch** — `pst:session:capture` (headed, one-time) → `pst:fetch:session` / `pst:fetch`
2. **Extract** raw rows — `pst:extract`
3. **Validate / normalize** — `pst:validate`, `pst:phase-1-2` … `pst:phase-5`
4. **Build ledger / overlay / holdings** — `pst:build:base`, `pst:build:overlay`, `pst:build:holdings`
5. **Entitlements** — `pst:entitlements`
6. **Push to Firestore** — `pst:push:base-entitlements`, `pst:patch:base-teams-entitlements`, `pst:push:base-pick-rules`

Run `npm run | grep "pst:"` for the full, authoritative list of steps and their
exact order. Outputs land under `data/pst/` (e.g.
`pst_pick_ledger_final_2026_2033.json`, `pst_entitlement_assets_2026_2033.json`).

---

## Legacy: RealGM path

> Kept intentionally as a backup. Still functional, but **not** the active
> source — the app's pick data comes from the PST pipeline above.

### Purpose

Collect and normalize NBA draft pick data from RealGM, build a league-wide
ledger, and produce per-team inventory/obligations/contested views with audits
for correctness.

### Entry Points

- `scripts/realgm_draft_picks.ts` - Scrape RealGM team pages and write mentions + structured outputs.
- `../shared/ledger/buildPickLedger.ts` - Build the league ledger and per-team views from mentions.
- `scripts/audit_realgm_rows_vs_mentions.ts` - Meaning-aware audit against live RealGM rows.
- `scripts/audit_semantic_assertions.ts` - Semantic anchor checks against mentions output.
- `scripts/audit_recipient_inventory_invariant.ts` - Invariant: unconditional "To TEAM" must be in TEAM inventory.
- `scripts/generate_ledger_tsv.ts` - 2A counts output (TSV).
- `scripts/generate_ledger_md.ts` - 2B full team lists output (Markdown).
- `scripts/generate_pretty_mentions.ts` - Pretty JSON mention outputs per team.

### Structure

- `scripts/` - CLI scripts for scrape, ledger audits, and report generation.
- `_artifacts/output/` - Scrape outputs (mentions + structured).
- `_artifacts/audits/` - Audit and manual verification outputs.
- `docs/` - Pipeline reference documentation.

### Usage

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

### Output

- Mentions: `team-scrape/draft-picks/_artifacts/output/mentions/draft_picks_mentions_{TEAM}.json`
- Structured: `team-scrape/draft-picks/_artifacts/output/structured/draft_picks_{TEAM}.json`
- Ledger: `team-scrape/shared/firestore_staging/_artifacts/output/ledger/`
- Audits: `team-scrape/draft-picks/_artifacts/audits/`

## Related Documentation

- `team-scrape/draft-picks/docs/OUTPUT_FILE_STRUCTURE.md`
- `docs/operations/DRAFT_PICKS_COMMANDS.md`
- `plans/_archive/draft-picks-invariant-guardrail/plan.md`
