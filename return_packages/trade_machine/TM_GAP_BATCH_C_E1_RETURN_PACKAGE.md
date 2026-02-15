# TM_GAP_BATCH_C_E1 — Data Model Hardening — Return Package

**Completed:** 2026-02-15  
**Mode:** EXECUTION  
**Batch:** C — Data Model Hardening  
**Source Triage:** `docs/architect/audits/TM_GAPS_TRIAGE_V1.md`

---

## Executive Summary

| Item         | Description                            | Status  |
| ------------ | -------------------------------------- | ------- |
| GAP-DATA-001 | Missing previousSalary for BYC Players | ✅ DONE |
| GAP-DATA-002 | Inconsistent Player Salary Field Names | ✅ DONE |

**Approach:** Rather than blocking trades with missing data, we implemented a structured warning system that:

1. Surfaces data quality issues to the UI with appropriate severity levels
2. Allows trade validation to proceed with clear documentation of data limitations
3. Provides actionable details about what specific data is missing

---

## Items Completed

### GAP-DATA-001 — Missing previousSalary for BYC Players

**Problem:** BYC players require `previousSalary` for accurate outgoing matching value calculation: `max(previousSalary, 50% of newSalary)`. Without this data, the calculation silently falls back to just 50%, which may undervalue the player's trade impact.

**Solution Implemented:**

- Created `dataValidation.js` utility with structured warning system
- `validateBYCPlayerData()` detects BYC players missing `previousSalary`
- WARNING-level severity indicating reduced calculation accuracy
- Warning includes CBA implication explanation for user understanding
- BYC calculation continues with 50% fallback but surfaces the limitation

**Behavior Change:**

- **Before:** Silent fallback to 50% of new salary when previousSalary missing
- **After:** Same fallback behavior, but warning surfaced in validation result

---

### GAP-DATA-002 — Inconsistent Player Salary Field Names

**Problem:** Multiple salary field names exist across the codebase:

- Canonical: `contract.salariesByYear[].capHit`
- Legacy: `contract.salariesByYear[].salary`
- Fallback: `player.salary`, `player.newSalary`

**Solution Implemented:**

- `validateSalaryFieldData()` tracks when non-canonical sources are used
- INFO-level severity for fallback field usage (not an error, just data quality note)
- WARNING-level severity when no salary data is found at all
- Canonical source documented as `contract.salariesByYear[].capHit`

**Behavior Change:**

- **Before:** Silent normalization across field names
- **After:** Same normalization, but tracking surfaced for data quality monitoring

---

## Files Changed

| File                                                                 | Change Type | Description                                        |
| -------------------------------------------------------------------- | ----------- | -------------------------------------------------- |
| `src/features/architect/utils/tradeMachine/utils/dataValidation.js`  | NEW         | Data validation utilities with structured warnings |
| `src/features/architect/utils/tradeMachine/utils/matchingValues.js`  | UPDATED     | Integrated data validation, now returns warnings   |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | UPDATED     | Captures and surfaces data warnings in result      |
| `src/tests/architect/dataValidation.test.js`                         | NEW         | 20 unit tests covering all validation scenarios    |
| `docs/architect/audits/TM_GAPS_TRIAGE_V1.md`                         | UPDATED     | Marked Batch C items DONE with evidence            |

---

## New Tests Added

**File:** `src/tests/architect/dataValidation.test.js`

**Test Count:** 20 tests (all PASS)

**Test Command:**

```bash
npm run test src/tests/architect/dataValidation.test.js -- --run
```

**Coverage:**
| Test Suite | Tests | Description |
| ---------- | ----- | ----------- |
| validateBYCPlayerData | 7 | BYC player missing previousSalary detection |
| computeMatchingValues with BYC | 3 | Integration of warnings in matching value computation |
| validateSalaryFieldData | 3 | Salary field fallback tracking |
| computeMatchingValues with salary fields | 1 | Salary field issue detection in computation |
| validateTradeData (combined) | 2 | Multi-player validation aggregation |
| formatDataWarning | 4 | Warning formatting for UI display |

---

## Validation Results

```bash
$ npm run test src/tests/architect/dataValidation.test.js -- --run

 ✓ src/tests/architect/dataValidation.test.js  (20 tests) 14ms

 Test Files  1 passed (1)
      Tests  20 passed (20)
```

---

## Data Warning Structure

New validation result includes:

```javascript
{
  legal: true/false,
  teamResults: [...],
  dataWarnings: [
    {
      code: 'BYC_MISSING_PREVIOUS_SALARY',
      message: 'BYC player "Player Name" is missing previousSalary...',
      severity: 'warning',
      details: {
        playerId: 'abc123',
        playerName: 'Player Name',
        fallbackUsed: true,
        fallbackMethod: '50% of new salary',
        cbaImplication: 'BYC matching value = max(previousSalary, 50% of newSalary)...'
      }
    }
  ],
  hasDataIssues: true/false
}
```

---

## UI Integration Notes

To display data warnings in the trade machine UI:

1. Check `validationResult.hasDataIssues` to determine if warning banner needed
2. Iterate `validationResult.dataWarnings` to show individual warnings
3. Use `formatDataWarning()` helper for consistent formatting with emoji prefixes
4. Severity levels: ERROR (❌), WARNING (⚠️), INFO (ℹ️)

**Recommended placement:** Below trade legality indicator, before detailed validation breakdown.

---

## Triage Document Updates

**File:** `docs/architect/audits/TM_GAPS_TRIAGE_V1.md`

**Changes:**

- Executive Summary: Data Issues now 2/2 fixed
- Batch C status: ✅ COMPLETE (2026-02-15)
- GAP-DATA-001: Status changed to ✅ DONE with implementation details
- GAP-DATA-002: Status changed to ✅ DONE with implementation details
- Summary Status table: Both items marked ✅ DONE
- Remaining estimate: Updated to ~4-6 hours (Batch B only)
- Document References: Added Batch C Return Package

---

## Verification Checklist

- [x] BYC player without previousSalary triggers warning
- [x] BYC calculation still works (uses 50% fallback)
- [x] Warning message includes CBA implication
- [x] Non-canonical salary sources tracked with INFO severity
- [x] Missing salary data tracked with WARNING severity
- [x] Warnings attached to team objects for per-team display
- [x] Validation result includes dataWarnings array
- [x] All 20 new tests pass
- [x] Triage doc updated with DONE status

---

## Related Documents

- **Triage Doc:** `docs/architect/audits/TM_GAPS_TRIAGE_V1.md`
- **Test File:** `src/tests/architect/dataValidation.test.js`
- **Data Validation Module:** `src/features/architect/utils/tradeMachine/utils/dataValidation.js`
