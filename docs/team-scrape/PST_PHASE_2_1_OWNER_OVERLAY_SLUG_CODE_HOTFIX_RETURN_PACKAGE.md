# PST Phase 2.1 Hotfix: Owner Overlay Slug→Code Fix

**Date**: 2026-01-20  
**Status**: COMPLETE

---

## Summary

Fixed owner overlay swap detection that was incorrectly blocking ownership overrides for ranked distribution picks (most/second most/least favorable).

The swap-only gate recognized "option to swap" language in the normalized text (referring to a different pick) and blocked the owner override for picks like DAL_2029_1st, even though PST clearly showed HOU as the display owner.

---

## Root Cause

The `isSwapOnlyClause()` function in `pst_owner_model_utils.ts` detected swap language from unrelated clauses in the same row's normalized text and returned `true`, blocking owner override.

Example for DAL_2029_1st:

- Text contained: "Rockets option to swap 2025 first round picks" (different pick!)
- Also contained: "2029 first round pick (most favorable of Mavericks, Rockets, Suns picks)"
- Swap language triggered, but "most favorable" wasn't recognized as explicit conveyance

---

## Fix Applied

Added pattern recognition for ranked distribution language as explicit conveyance:

```typescript
// Added to explicitConveyancePatterns array
new RegExp(
  `${yearPattern}\\s+${roundText}\\s+pick[^•]*(?:most\\s+favorable|second\\s+most\\s+favorable|third\\s+most\\s+favorable|least\\s+favorable)\\s+of`,
  'i'
)
```

---

## Files Changed

| File | Change |
|------|--------|
| `team-scrape/draft-picks/scripts/pst/pst_owner_model_utils.ts` | Added ranked distribution pattern to explicit conveyance detection |
| `team-scrape/draft-picks/scripts/pst/pst_validate_owner_overlay_regressions.ts` | NEW: Regression validator for critical ownership assertions |
| `package.json` | Added `pst:validate:overlay:regressions` npm script |

---

## Commands Run

```bash
npm run pst:build-final
npm run pst:validate:overlay:regressions
```

---

## DAL_2029_1st Before/After

### BEFORE

```json
{
  "pickId": "DAL_2029_1st",
  "owner": "DAL",
  "ownershipSource": "BASE"
}
```

### AFTER

```json
{
  "pickId": "DAL_2029_1st",
  "owner": "HOU",
  "ownershipSource": "PST_DISPLAY",
  "encumbrances": {
    "selectionSpecs": [{
      "kind": "conveys",
      "order": "most",
      "rank": 2,
      "pool": ["DAL", "HOU", "PHX"],
      "description": "(second most favorable of Mavericks, Rockets, Suns picks)"
    }]
  }
}
```

---

## Regression Validator Output

```
PST Owner Overlay Regression Validator
======================================

✅ PASS: DAL_2029_1st
   owner=HOU, source=PST_DISPLAY
✅ PASS: PHX_2029_1st
   owner=HOU, source=PST_DISPLAY

--------------------------------------
Total: 2 passed, 0 failed

✅ All regression checks passed!
```

---

## Invariants Validated

| Metric | Value |
|--------|-------|
| Profiles | 480 |
| Ledger picks | 480 |
| needs_review | 0 |
| DAL_2029_1st owner | HOU ✓ |
| PHX_2029_1st owner | HOU ✓ |
| Manual views | Generated ✓ |

---

## Phase Status

**COMPLETE**
