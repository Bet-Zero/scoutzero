# PST Phase 7: Rights Views Return Package

## Summary

Phase 7 implementation of "Rights / Entitlements Views" is **BLOCKED**.
While the generation script (`pst_phase_7_rights_views.ts`) was successfully implemented and validated against ATL 2026 and DAL 2029, the mandatory validation case for **DAL 2030 1st** failed because the underlying ledger data lacks `selectionSpecs` and `mostLeast` information for the complex swap.

## Phase Status

**BLOCKED**

## Files Created/Modified

- `team-scrape/draft-picks/scripts/pst/pst_phase_7_rights_views.ts` (New Generator)
- `data/pst/manual_rights_views.txt` (Combined Output)
- `data/pst/manual_rights_views/*.txt` (Per-team Outputs)
- `package.json` (Added `pst:manual-rights-views`)
- `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md` (Updated)

## Blocking Issue Details

**Target**: DAL 2030 1st
**Requirement**: "DAL receives 2nd most favorable" (from pool DAL, MIN, SAS)
**Actual Data in Ledger**:

- `encumbrances.selectionSpecs`: `[]` (Empty)
- `encumbrances.swaps`: `[{ controller: "SAS", pool: ["BOS", "DAL"], mostLeast: null }]`
**Impact**:
- Impossible to deterministically calculate "2nd most favorable" entitlement.
- Violates Stop Condition: "selectionSpecs are absent for swaps that require ranked outcomes".

## How to Run (Once Unblocked)

```bash
npm run pst:manual-rights-views
```

## Validated Outputs (Success Cases)

### ATL — ATLANTA HAWKS (2026)

*Validated: ATL receives least favorable from pool (ATL, SAS)*

```
2026 | 1 | receives least favorable | pool (ATL,SAS) | controller ATL
```

### DAL — DALLAS MAVERICKS (2029)

*Validated: DAL owes most favorable to HOU*

```
2029 | 1 | owes most favorable to HOU | pool (DAL,HOU,PHX) | via HOU swap rights
```

## Deduplication Logic

The script collapses multiple rows contributing to the same entitlement into a single line by using a unique key composed of:

- Team + Year + Round
- Description (e.g., "receives most favorable")
- Pool Members
- Controller Info

This ensures that if 3 picks in a pool all generate the same rights outcome for a team, only one line appears in the report.
