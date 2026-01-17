# PST Phase 6.1 OutcomeSpec — Return Package

**Date**: 2026-01-17  
**Phase**: 6.1 - OutcomeSpec + Manual View Upgrade  
**Status**: COMPLETE

---

## Summary

Implemented Phase 6.1 of the PST Pick Ledger pipeline: OutcomeSpec generation for manual check views. This upgrade replaces vague tags like `swap ATL, least` with structured OutcomeSpec strings like `swap:ATL — least of (ATL,SAS)`.

Key features:

- **SelectionSpec type**: New structured schema for swap/conveyance selection logic
- **Ranked pool parsing**: Detects "2nd most favorable", "3rd least favorable" patterns
- **OutcomeSpec composer**: Formats specs into readable strings with pools and ranks
- **Deterministic output**: All specs derived from existing parsed data without guessing

---

## Files Changed

**Created:**

| File | Description |
|------|-------------|
| `docs/team-scrape/PST_PHASE_6_1_OUTCOME_SPEC_RETURN_PACKAGE.md` | This return package |

**Modified:**

| File | Changes |
|------|---------|
| `team-scrape/draft-picks/scripts/pst/pst_pick_rule_parser.ts` | Added SelectionSpec interface, parseRankedFavorablePool(), parseBetterOf(), buildSelectionSpecs() |
| `team-scrape/draft-picks/scripts/pst/pst_phase_5_finalize.ts` | Added selectionSpecs to FinalLedgerPick encumbrances |
| `team-scrape/draft-picks/scripts/pst/pst_phase_6_manual_check_views.ts` | Replaced generateTags() with composeOutcomeSpec() |
| `package.json` | Updated `pst:build-final` to include manual views |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` | Added Phase 6.1 documentation and OutcomeSpec grammar |

---

## How to Run

```bash
npm run pst:build-final
```

This command runs the complete pipeline:

1. `pst:phase-4` - Deterministic parser (builds pick rule profiles with selectionSpecs)
2. `pst:phase-5` - Ledger builder + finalize (generates final artifacts)
3. `pst:phase-5:validate` - Validation (confirms invariants)
4. `pst:manual-views` - Manual check views generator (with OutcomeSpec format)

---

## Output Paths

| Output | Path |
|--------|------|
| Combined Report | `data/pst/manual_check_views.txt` |
| Per-Team Reports | `data/pst/manual_check_views/{TEAM}.txt` |
| Final Profiles | `data/pst/pst_pick_rule_profiles_final_2026_2033.json` |
| Final Ledger | `data/pst/pst_pick_ledger_final_2026_2033.json` |

---

## Validation Examples

### Example 1: 2-Team Swap Line

**Line from `manual_check_views.txt`:**

```
2026 | 1 | via CLE | swap:ATL — least of (ATL,SAS)
```

**Format matches required grammar:**

- `swap:{CONTROLLER} — {order} of ({POOL})`
- Controller: ATL
- Order: least
- Pool: ATL, SAS (sorted alphabetically)

---

### Example 2: 3+ Team Ranked Swap Line

**Line from `manual_check_views.txt`:**

```
2026 | 1 | own | swap:HOU — most of (DAL,HOU,PHX); swap:HOU — 2nd most of (DAL,HOU,PHX)
```

**Format matches required grammar:**

- First spec: `swap:HOU — most of (DAL,HOU,PHX)` (rank 1)
- Second spec: `swap:HOU — 2nd most of (DAL,HOU,PHX)` (rank 2)
- Controller: HOU
- Pool: DAL, HOU, PHX (3 teams)

---

### Example 3: Ranked Conveys Line

**Line from `manual_check_views.txt`:**

```
2030 | 2 | via POR | Top 4; conveys — 2nd most of (BOS,MIL,POR)
```

**Format matches required grammar:**

- Protection: `Top 4`
- Selection: `conveys — {rank} {order} of ({POOL})`
- Rank: 2nd
- Order: most
- Pool: BOS, MIL, POR (3 teams)

---

## OutcomeSpec Grammar

```
OutcomeSpec = [Protection] ["; " SelectionSpec]*

Protection = "Top N" | "protected #start-end" | "lottery"

SelectionSpec = SwapSpec | ConveysSpec
SwapSpec = "swap:" Controller " — " RankOrder " of (" Pool ")"
ConveysSpec = "conveys — " RankOrder " of (" Pool ")"

RankOrder = "most" | "least" | "2nd most" | "2nd least" | "3rd most" | ...
Pool = TeamCode ["," TeamCode]*  (sorted alphabetically)
```

---

## SelectionSpec Schema

```typescript
interface SelectionSpec {
  kind: 'swap' | 'conveys';
  controller?: TeamCode;     // Required for swap, optional for conveys
  order: 'most' | 'least';
  rank: number;              // 1 for most/least, 2 for 2nd, etc.
  pool: TeamCode[];          // Sorted alphabetically
  year: number;
  round: 1 | 2;
  evidenceRowRefs: string[];
  description: string;       // Short matched phrase
}
```

---

## Phase Status

**COMPLETE**

All acceptance criteria met:

- SelectionSpecs generated deterministically from existing parsed data
- Manual views use OutcomeSpec format with pools, ranks, and controllers
- 2-team swap lines display correctly (e.g., `swap:ATL — least of (ATL,SAS)`)
- Ranked pool lines display correctly (e.g., `swap:HOU — 2nd most of (DAL,HOU,PHX)`)
- Conveys selections display for ranked specs (e.g., `conveys — 2nd most of (BOS,MIL,POR)`)
- No guessing - all specs derived from existing swap/favorable pool data

---

## Next Steps

1. Use updated `data/pst/manual_check_views.txt` to verify against Fanspo and Spotrac
2. Proceed to Phase 6.2 (Hard Guarantees) for trade-machine integration invariants
