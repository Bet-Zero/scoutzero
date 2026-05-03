# PST Ownership Model Swap Rights Hotfix — Return Package

**Date**: 2026-01-18  
**Phase**: Phase 5.2  
**Status**: IMPLEMENTATION COMPLETE — AWAITING ARTIFACT REGENERATION

---

## Summary

Fixed ownership model bug where swap rights were incorrectly treated as ownership transfers. The system now correctly separates:

- **owner** = asset holder (who holds the pick today)
- **encumbrances.swaps[].controller** = who holds swap rights (rights holder)

Swap rights no longer change owner. DAL_2030_1st will remain owned by DAL even though SAS has a swap option.

---

## Files Changed/Created

### New Files

1. **`team-scrape/draft-picks/scripts/pst/pst_owner_model_utils.ts`**
   - Swap-only detection function (`isSwapOnlyClause`, `isSwapOnlyOverlayItem`)
   - Deterministically detects swap-only clauses vs explicit ownership transfers

2. **`team-scrape/draft-picks/scripts/pst/pst_validate_swap_does_not_change_owner.ts`**
   - Regression validator for ownership model fix
   - Asserts DAL_2030_1st.owner == DAL
   - Asserts swap encumbrance still exists

### Modified Files

1. **`team-scrape/draft-picks/scripts/pst/pst_apply_display_owner_overlay.ts`**
   - Added swap-only gate before applying owner override
   - Loads normalized rows for evidence lookup
   - If swap-only: keeps base owner (skips override)
   - If explicit conveyance: applies owner override as before

2. **`docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`**
   - Added Phase 5.2 section documenting ownership model fix
   - Added ownership model rules documentation

### Files to be Regenerated (via commands below)

1. **`data/pst/pst_ledger_with_display_owner.json`** - Regenerate after overlay fix
2. **`data/pst/pst_pick_ledger_final_2026_2033.json`** - Regenerate via phase-5
3. **`data/pst/manual_check_views.txt`** - Regenerate via manual-views
4. **`data/pst/manual_check_views/DAL.txt`** - Per-team manual view

---

## Commands Run

**NOTE**: Due to sandbox restrictions, these commands need to be run outside the sandbox:

```bash
# Step 1: Rebuild overlay with swap gate
npm run pst:apply:overlay

# Step 2: Regenerate final ledger (phase-5 uses overlay output)
npm run pst:phase-5

# Step 3: Regenerate manual views
npm run pst:manual-views

# Step 4: Run regression validator
npx tsx team-scrape/draft-picks/scripts/pst/pst_validate_swap_does_not_change_owner.ts
```

**Alternative**: Use `pst:build-final` which runs phase-4, phase-5, and manual-views in sequence:

```bash
npm run pst:build-final
npx tsx team-scrape/draft-picks/scripts/pst/pst_validate_swap_does_not_change_owner.ts
```

---

## DAL_2030_1st Before/After

### Before (CURRENT STATE - WRONG)

```json
{
  "pickId": "DAL_2030_1st",
  "year": 2030,
  "round": 1,
  "originalTeam": "DAL",
  "owner": "SAS",  // ❌ WRONG - Swap right treated as ownership
  "ownershipSource": "PST_DISPLAY",
  "encumbrances": {
    "swaps": [
      {
        "controller": "SAS",
        "pool": ["BOS", "DAL"],
        "year": 2030,
        "round": 1,
        "direction": "swap_right",
        "description": "Spurs option to swap 2030 first round picks with Mavericks (?-?) in a"
      }
    ]
  }
}
```

### After (EXPECTED STATE - CORRECT)

```json
{
  "pickId": "DAL_2030_1st",
  "year": 2030,
  "round": 1,
  "originalTeam": "DAL",
  "owner": "DAL",  // ✅ CORRECT - Owner unchanged, swap right recorded separately
  "ownershipSource": "BASE",
  "encumbrances": {
    "swaps": [
      {
        "controller": "SAS",  // ✅ Swap right still recorded
        "pool": ["BOS", "DAL"],
        "year": 2030,
        "round": 1,
        "direction": "swap_right",
        "description": "Spurs option to swap 2030 first round picks with Mavericks (?-?) in a"
      }
    ]
  }
}
```

### Evidence Text

The normalized text evidence for DAL_2030_1st (rowRef: r16):

```
"Traded • 2024 second round pick (?-?) • 2028 second round pick (?-?) • Spurs option to swap 2030 first round picks with Mavericks (?-?) in a 3-team trade with Celtics, Mavericks for • Reggie Bullock • Spurs option to swap 2030 first round picks with Mavericks (?-?) on 2023-07-12"
```

**Analysis**: This contains "option to swap" language and does NOT contain explicit conveyance patterns (e.g., "2030 first round pick to SAS"). Therefore, this is swap-only and should NOT change owner.

---

## Dallas Manual View Expected Output

### Before (CURRENT - MISSING)

Dallas manual view does not show 2030 1st (because owner was incorrectly set to SAS).

### After (EXPECTED)

```
════════════════════════════════════════════════════════════════════════════════
# DAL — DALLAS MAVERICKS

────────────────────────────────────────────────────────────────────────────────
...
2030 | 1 | own | swap SAS
...
```

The pick should appear under Dallas with "swap SAS" tag indicating the swap right.

---

## Validation Outputs

**NOTE**: These will be available after running the commands above.

### Expected Validation Results

1. **Final ledger count**: 480 ✓
2. **needs_review**: 0 ✓
3. **DAL_2030_1st.owner == DAL**: ✓
4. **DAL_2030_1st swap encumbrance exists**: controller = SAS ✓
5. **Dallas manual view includes 2030 1st line**: ✓

### Regression Validator Output (Expected)

```
🔍 PST Swap Rights Ownership Model Validator
===========================================

✓ Loaded final ledger (480 picks)

📋 DAL_2030_1st Details:
   Owner: DAL
   Original Team: DAL
   Swaps: 1
   ✓ Owner is DAL (correct)
   ✓ Swap encumbrance with controller: SAS exists
     Pool: BOS, DAL

✓ DAL manual view includes 2030 1st line

✓ Final ledger count: 480

📊 Validation Summary
===================

✅ All validations passed!
✅ Swap rights ownership model fix is CORRECT
```

---

## Implementation Details

### Swap-Only Detection Logic

The `isSwapOnlyClause()` function in `pst_owner_model_utils.ts` uses the following logic:

1. **Check for swap language**: "option to swap", "right to swap", "can swap", "swap right", "swap with"
2. **Check for explicit conveyance patterns**:
   - "Traded ... {YEAR} {round} pick to {TEAM}" (without swap mention)
   - "{YEAR} {round} pick to {TEAM} for"
   - "(from {TEAM})" pattern near pick mention
3. **Classification**:
   - If swap language exists AND no explicit conveyance patterns → swap-only (do not change owner)
   - If explicit conveyance patterns exist → explicit conveyance (can change owner)
   - If no swap language → not swap-only (could be conveyance)

### Overlay Application Logic

The modified `pst_apply_display_owner_overlay.ts` now:

1. Loads normalized rows for evidence lookup
2. For each overlay item, checks if it's swap-only using `isSwapOnlyOverlayItem()`
3. If swap-only: keeps base owner (ownershipSource: 'BASE')
4. If explicit conveyance: applies owner override (ownershipSource: 'PST_DISPLAY')

---

## Known Issues / Next Steps

**NONE** - Implementation is complete and ready for artifact regeneration.

**Action Required**: Run the commands listed above to regenerate artifacts and validate the fix.

---

## Phase Status

**STATUS**: IMPLEMENTATION COMPLETE — AWAITING ARTIFACT REGENERATION

- ✅ Code implementation complete
- ✅ Swap-only detection logic implemented
- ✅ Overlay application modified
- ✅ Regression validator created
- ✅ Master doc updated
- ⏳ Artifacts need to be regenerated (commands above)
- ⏳ Validation needs to be run (command above)

**Once artifacts are regenerated and validation passes**: Status will be **COMPLETE**

---

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| Final ledger count remains 480 | ⏳ Pending regeneration |
| needs_review remains 0 | ⏳ Pending regeneration |
| DAL_2030_1st.owner == DAL | ⏳ Pending regeneration |
| Swap right still recorded for DAL_2030_1st (encumbrance, not ownership) | ⏳ Pending regeneration |
| Manual views regenerate and Dallas shows a 2030 1st line | ⏳ Pending regeneration |
| No schema-breaking changes (only owner values change) | ✅ Code complete |

---

**Implementation Date**: 2026-01-18  
**Next Step**: Run artifact regeneration commands and validation
