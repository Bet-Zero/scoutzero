# PST Phase 7.2: Swap Labels and Pool Fix Return Package

## Summary

Completed Phase 7.2 to refine swap semantics and accuracy:

1. **Task A (Display):** Shortened controller swap view from "swap vs {TEAM}" to "swap {TEAM}".
2. **Task B (Accuracy):** Fixed "stray team" issue in simple swaps (e.g., DAL 2030 including BOS in pool) by implementing strict clause-local team extraction in the rule parser.

## Files Changed

- `team-scrape/draft-picks/scripts/pst/pst_pick_rule_parser.ts` (Core pool extraction fix)
- `team-scrape/draft-picks/scripts/pst/pst_phase_7_rights_views.ts` (Display update)
- `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` (Updated)

## Commands Run

```bash
npm run pst:build-final        # Rebuilt profiles/ledger
npm run pst:manual-rights-views # Regenerated rights views
```

## Validation Proof

### 1. Display Shortening (Task A)

**File:** `data/pst/manual_rights_views.txt` (SAS Section)

```
2026 | 1 | swap ATL         <-- Was "swap vs ATL"
2030 | 1 | swap DAL         <-- Was "swap vs DAL"
```

### 2. Pool Correction (Task B - DAL 2030 Case)

**Before:** Pool contained `{BOS, DAL, SAS}` because "Celtics" appeared in the trade context string.
**After:** Pool contains `{DAL, SAS}` only. Validated via empty poolInfo string (hides when size <= 2) in rights views.

**File:** `data/pst/manual_rights_views.txt` (DAL Section)

```
2030 | 1 | swap owed SAS    <-- No "pool (BOS,DAL,SAS)" shown, means pool size is 2 (Correct)
```

## Status

Phase 7.2 COMPLETE
