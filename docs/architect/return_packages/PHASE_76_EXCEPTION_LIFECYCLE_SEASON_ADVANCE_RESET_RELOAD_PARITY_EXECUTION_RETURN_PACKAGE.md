# PHASE 76: Exception Lifecycle Season Advance Reset/Reload Parity — EXECUTION RETURN PACKAGE

**Date:** 2026-02-01  
**Phase:** 76  
**Mode:** EXECUTION  
**Status:** ✅ COMPLETE

---

## Summary

Phase 76 adds exception lifecycle handling to the season advance pipeline for non-TPE exceptions (BAE, Mini MLE, NTMLE, Room). When advancing a season, exception state is now reset and recomputed using the new year's canonical cap rules, ensuring teams enter each season with fresh exception allocations.

### Key Deliverables

1. **New Exception Lifecycle Helper** - `resetTeamNonTpeExceptionsForNewSeason()` in `src/features/architect/utils/exceptions/exceptionLifecycle.js`
2. **Season Advance Integration** - Helper wired into `processTeamSeasonTransitionWithOptions()` after TPE expiry processing
3. **TPE Lifecycle Unchanged** - Helper explicitly does NOT touch `exceptions.tpe[]`
4. **20 Guardrail Tests** - Covering source scan, behavioral, reload parity, and edge cases

---

## Files Changed/Created

| File                                                                                                                         | Action     | Description                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------- |
| `src/features/architect/utils/exceptions/exceptionLifecycle.js`                                                              | **CREATE** | Exception lifecycle helper for season transitions |
| `src/features/architect/utils/exceptions/index.js`                                                                           | **CREATE** | Public API for exceptions module                  |
| `src/features/architect/utils/seasonManager.js`                                                                              | **MODIFY** | Wired helper into season advance flow             |
| `src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.js`                      | **CREATE** | Phase 76 guardrail tests                          |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`                                                                | **MODIFY** | Added Phase 76 HISTORY entry                      |
| `docs/architect/contracts/PERSISTENCE_CONTRACTS.md`                                                                          | **MODIFY** | Added Phase 76 section                            |
| `docs/architect/return_packages/PHASE_76_EXCEPTION_LIFECYCLE_SEASON_ADVANCE_RESET_RELOAD_PARITY_EXECUTION_RETURN_PACKAGE.md` | **CREATE** | This return package                               |

---

## Before/After Behavior

### Before (Pre-Phase 76)

- Season advance processed TPE expirations but ignored non-TPE exceptions
- `maxAmount` could be stale across seasons (e.g., 2025-26 BAE amount used in 2026-27)
- `usedAmount` and `remainingAmount` could incorrectly carry over
- Reload/season-advance could diverge from expected new-year state

### After (Phase 76)

- Season advance resets non-TPE exceptions using new year's cap rules:
  - `maxAmount` recomputed from `getCapRulesForYear(toYear)`
  - `usedAmount` reset to 0
  - `remainingAmount` = maxAmount (when enabled) or 0 (when disabled)
- `enabled` flag preserved (user must explicitly enable/disable via ManageExceptionsModal)
- `seasonKey` updated to new season
- Reload parity guaranteed: persist → reload yields identical exception state

### TPE Lifecycle Unchanged

- TPE expiry logic remains in `processTradeExceptions()` in `tpeLifecycle.js`
- New helper explicitly does NOT access `exceptions.tpe[]`
- TPE history logging unchanged

---

## Exception Type Mapping

| Exception Type   | Cap Rules Field | Description           |
| ---------------- | --------------- | --------------------- |
| `biAnnual`       | `bae`           | Bi-Annual Exception   |
| `miniMle`        | `taxpayerMLE`   | Taxpayer MLE          |
| `nonTaxpayerMle` | `fullMLE`       | Full/Non-Taxpayer MLE |
| `room`           | `roomMLE`       | Room Exception        |

---

## API Reference

### `resetTeamNonTpeExceptionsForNewSeason(team, toYearKey, options?)`

Resets and recomputes non-TPE exceptions for a team entering a new season.

**Parameters:**

- `toYearKey` - Target season end year (e.g., 2027) or season code (e.g., "2026-27")
- `options.customCapProjections` - Optional custom cap projections for testing

**Returns:**

- `{ hasChanges: boolean, transitionedExceptions: string[] }`

**Behavior:**

1. Recomputes `maxAmount` from new year's cap rules
2. Resets `usedAmount` to 0
3. Computes `remainingAmount` = maxAmount (enabled) or 0 (disabled)
4. Updates `seasonKey` to new season

### `validateNonTpeExceptionsForYear(team, yearKey)`

Validates that team exceptions match expected state for given year.

**Returns:**

- `{ valid: boolean, issues: string[] }`

---

## Tests

### Test File

### Test Summary (20 tests)

**A) Source Scan Guardrails (4 tests)**

- TEST 1: seasonManager.js imports helper
- TEST 2: seasonManager.js calls helper in season advance flow
- TEST 3: Helper does NOT reference exceptions.tpe
- TEST 3b: Helper does NOT call canUseRoomException

**B) Behavioral Tests (6 tests)**

- TEST 4: Reset behavior - usedAmount resets to 0

- TEST 5: Max recompute - maxAmount matches cap rules
- TEST 6: Remaining recompute - remainingAmount equals maxAmount (enabled)
- TEST 6b: Remaining recompute - remainingAmount is 0 (disabled)
- TEST 7: Enabled preserved through transition

- TEST 8: TPE array is NOT modified

**C) Validation Helper Tests (2 tests)**

- TEST 10: Validation passes for correctly transitioned exceptions
- TEST 11: Validation fails for stale maxAmount

**D) Reload Parity Tests (2 tests)**

- TEST 12: Exception state survives persist→reload cycle

**E) Edge Cases (4 tests)**

- TEST 14: Handles team with no existing exceptions
- TEST 15: Handles null team gracefully
- TEST 16: Handles invalid yearKey gracefully
- TEST 17: Preserves notes field through transition

**F) Constants Tests (2 tests)**

- TEST 18: NON_TPE_EXCEPTION_TYPES contains exactly 4 types
- TEST 19-20: NON_TPE_EXCEPTION_TYPES includes expected types, excludes tpe

---

## Validation Commands Output

```bash
# Phase 76 tests
npm run test -- --run src/tests/architect/phase76_exception_lifecycle_season_advance_reset_reload_parity_guardrails.test.js

# All architect tests
npm run test -- --run src/tests/architect/

# Build
npm run build
```

---

## Explicitly Deferred (Out of Scope)

Per the phase prompt, the following are explicitly NOT implemented in Phase 76:

1. **BAE cooldown** - 2-year waiting period not enforced
2. **MLE proration** - Mid-season signing proration not implemented
3. **Exception UI changes** - No new UI components added
4. **Trade validation changes** - Trade architecture unchanged
5. **Persistence ordering changes** - Mutation pipeline unchanged

These are potential follow-up phases.

---

## Acceptance Criteria Checklist

| AC  | Description                                               | Status |
| --- | --------------------------------------------------------- | ------ |
| AC1 | Canonical helper exists for non-TPE exception transition  | ✅     |
| AC2 | seasonManager persists teams with transitioned exceptions | ✅     |
| AC3 | TPE logic untouched (no changes to expiry/lifecycle)      | ✅     |
| AC4 | Phase 76 guardrail test file exists and passes            | ✅     |
| AC5 | Full architect test suite passes green                    | ✅     |
| AC6 | Build passes                                              | ✅     |
| AC7 | Master Doc + Persistence Contracts + return package       | ✅     |

---

## Stop Conditions

None triggered:

- ✅ **STOP-1:** Cap rules source is clear (`getCapRulesForYear()` from `capRulesProfile`)
- ✅ **STOP-2:** No circular dependency created (helper in separate `utils/exceptions/` module)
- ✅ **STOP-3:** Exception state model supports reset without breaking persisted shapes
