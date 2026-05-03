# Phase 5.3: SelectionSpecs for All Swaps (Return Package)

**Date**: 2026-01-18
**Status**: ✅ COMPLETE

## Problem

Phase 7 Rights Views was **BLOCKED** because `DAL_2030_1st` (and similar swap-only picks) had empty `selectionSpecs[]`. The `buildSelectionSpecs()` function only generated specs when `swap.mostLeast` was explicitly set.

## Root Cause

The PST source text was: *"Spurs option to swap 2030 first round picks with Mavericks"*

This simple swap text does NOT contain explicit ranked language like "2nd most favorable of..." — the parser correctly set `mostLeast: null` but then skipped spec generation entirely.

## Solution

Modified [buildSelectionSpecs()](file:///Users/brenthibbitts/Desktop/ScoutZero/team-scrape/draft-picks/scripts/pst/pst_pick_rule_parser.ts#L835-L856) to:

- Generate a selectionSpec for **every** swap entry
- Default `order` to `'most'` when `mostLeast` is null

```diff
-  // 1. Convert existing swaps to SelectionSpecs (rank 1 only)
+  // 1. Convert ALL existing swaps to SelectionSpecs (rank 1)
+  // Phase 5.2: Generate specs for all swaps, not just those with mostLeast
   for (const swap of profile.swaps) {
-    if (swap.mostLeast) {
-      const order: 'most' | 'least' = swap.mostLeast === 'most_favorable' ? 'most' : 'least';
+    const order: 'most' | 'least' = swap.mostLeast === 'least_favorable' ? 'least' : 'most';
```

## Validation

| Check | Result |
|-------|--------|
| DAL_2030_1st has selectionSpecs | ✅ `[{ kind:'swap', controller:'SAS', order:'most', pool:['BOS','DAL','SAS'] }]` |
| DAL Rights View for 2030 | ✅ `2030 \| 1 \| owes most favorable to SAS \| pool (BOS,DAL,SAS)` |
| MIL_2026_2nd clean | ✅ No first-round encumbrances |
| Pick count | ✅ 480 |
| needs_review | ✅ 0 |

## Files Modified

- [pst_pick_rule_parser.ts](file:///Users/brenthibbitts/Desktop/ScoutZero/team-scrape/draft-picks/scripts/pst/pst_pick_rule_parser.ts) — `buildSelectionSpecs()` updated
- [PST_PICK_LEDGER_MASTER_PLAN.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md) — Added Phase 5.3 entry

## Data Regenerated

- `data/pst/pst_pick_rule_profiles_final_2026_2033.json`
- `data/pst/pst_pick_ledger_final_2026_2033.json`
- `data/pst/manual_rights_views/*.txt`

## Impact

**Phase 7 Rights Views is now UNBLOCKED** — all swap-encumbered picks have selectionSpecs for entitlement computation.
