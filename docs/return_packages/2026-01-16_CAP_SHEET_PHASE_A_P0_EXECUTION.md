# Return Package: Cap Sheet Phase A P0 Execution

**Date:** 2026-01-17  
**Goal:** Close the two highest-risk P0 gaps (G0-1 incomplete roster charge, G0-2 post-apron exception blocking)

---

## 1. Summary of Changes

### Phase A1 — Incomplete Roster Charge (G0-1) ✅ RESOLVED

Implemented automatic incomplete roster charge calculation in the SSOT (`computeTeamCapTotals`).

**What Changed:**

- Teams with fewer than 14 standard roster players now incur a cap charge
- Charge = (14 - standardRosterCount) × MIN_SALARY_ROOKIE
- Charge is computed at runtime, NOT stored in Firestore
- Two-way contracts do NOT count toward the 14-player minimum
- Included in `TeamCapTotals.incompleteChargesTotal` and `totalCapAllocations`

**CBA Basis:** Per CBA rules, teams must carry at least 14 players on their standard roster. If under, they're charged the rookie minimum salary per empty slot to prevent gaming of the salary cap through roster manipulation.

### Phase A2 — Post-Apron Exception Blocking (G0-2) ✅ RESOLVED

Implemented hard-block validation for illegal exception usage based on team's apron status.

**What Changed:**

- Added `exception_blocked` to `HARD_BLOCK_RULES` (cannot be overridden)
- Added `validateExceptionEligibility()` helper in `capLegalityValidation.js`
- Exception blocking is enforced in `validateSigning()` before roster/cap checks

**Exception Usage Rules Enforced:**

| Team Position | MLE (Non-Taxpayer) | Taxpayer MLE | BAE | TPE |
|---------------|-------------------|--------------|-----|-----|
| Below First Apron | ✅ | ✅ | ✅ | ✅ |
| Above First Apron (not hard-capped) | ❌ | ✅ | ❌ | ✅ |
| Hard-Capped at First Apron | ✅* | ✅ | ❌ | ✅ |
| Above Second Apron | ❌ | ❌ | ❌ | ❌ |

*Team is already hard-capped if they used NTMLE previously.

---

## 2. Files Changed

| File | Purpose |
|------|---------|
| `src/features/architect/utils/capTotals/computeTeamCapTotals.js` | Added `countStandardRoster()`, `getMinSalaryForYear()`, and incomplete roster charge calculation |
| `src/features/architect/utils/capLegalityValidation.js` | Added `exception_blocked` to HARD_BLOCK_RULES, added `validateExceptionEligibility()`, integrated into `validateSigning()` |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Updated gap analysis, added validation map entries, added change log |

---

## 3. Tests Added/Updated

### New Test Files

| Test File | Tests | Status |
|-----------|-------|--------|
| `src/tests/architect/capTotals/incompleteRosterCharge.test.js` | 9 tests | ✅ All passing |
| `src/tests/architect/capLegality/exceptionBlocking.test.js` | 14 tests | ✅ All passing |

### Updated Test Files

| Test File | Change |
|-----------|--------|
| `src/tests/architect/capTotals/deadMoney.test.js` | Added `createFullRoster()` helper to avoid incomplete roster charge noise in totalCapAllocations assertions |

### Test Coverage Summary

```
src/tests/architect/capTotals:
  ✓ deadMoney.test.js (7 tests)
  ✓ incompleteRosterCharge.test.js (9 tests)

src/tests/architect/capLegality:
  ✓ exceptionBlocking.test.js (14 tests)

Total: 30 tests passing
```

---

## 4. Evidence Snippets

### 4.1 incompleteChargesTotal in SSOT Output

```javascript
// From computeTeamCapTotals.js (lines 222-232)
const standardRosterCount = countStandardRoster(teamCapSheet?.players);
const minRoster = ROSTER_REQUIREMENTS.MIN_STANDARD_ROSTER;
const missingSlots = Math.max(0, minRoster - standardRosterCount);
const chargePerSlot = getMinSalaryForYear(yearKey);
const incompleteChargesTotal = missingSlots * chargePerSlot;

// Canonical total cap allocations
const totalCapAllocations =
  playersTotal + deadMoneyTotal + capHoldsTotal + incompleteChargesTotal;
```

### 4.2 Hard-Block Validation for Disallowed Exception Usage

```javascript
// From capLegalityValidation.js (lines 232-244)
// RULE 1: Second Apron teams cannot use any exceptions
if (isAboveSecondApron) {
  const blockedExceptions = ['mle', 'ntmle', 'fullmle', 'bae', 'tpe', 'tpmle', 'taxpayermle'];
  if (blockedExceptions.some(e => normalizedException.includes(e))) {
    return {
      blocked: true,
      reason: 'Second apron teams cannot use exceptions',
      violation: {
        rule: 'exception_blocked',
        message: `Cannot use ${signedUsing} - team is above second apron...`,
        severity: 'error',
      },
    };
  }
}
```

### 4.3 Hard Block Rules Array

```javascript
// From capLegalityValidation.js (lines 40-48)
export const HARD_BLOCK_RULES = [
  'roster_size',           // >15 players on standard roster
  'hard_cap',              // Over hard cap ceiling
  'two_way_limit',         // >3 two-way contracts
  'option_timing',         // Acting on options outside allowed window
  'no_contract',           // Extending a player with no contract
  'unknown_type',          // Unknown mutation type
  'exception_blocked',     // Exception usage blocked due to apron/hard cap status
];
```

---

## 5. Discovered Conflicts/Decisions

### 5.1 Minimum Roster Definitions

**Finding:** Multiple definitions exist across codebase:

- `capLegalityValidation.js`: `MIN_ROSTER = 14`
- `rosterValidation.js`: `MIN_ROSTER = 14`
- `cbaConstants.js`: `ROSTER_REQUIREMENTS.MIN_STANDARD_ROSTER = 14`
- `seasonManager.js`: `MIN_ROSTER_SIZE = 12` (for empty roster charges - different context)
- `basicArchitectUtils.js`: `MIN_ROSTER_SIZE = 13` (grace period minimum)

**Decision:** Used `ROSTER_REQUIREMENTS.MIN_STANDARD_ROSTER` (14) from `cbaConstants.js` as canonical for incomplete roster charges. This aligns with CBA rules and existing validation logic.

### 5.2 Minimum Salary Source

**Finding:** `CBA_THRESHOLDS` in `cbaConstants.js` contains `MIN_SALARY_ROOKIE` for 2024-25 only.

**Decision:** Added `getMinSalaryForYear()` helper that looks up from `CBA_THRESHOLDS` with fallback to 2024-25 value. Added TODO comment for future centralization via `capSettingsProvider`.

### 5.3 Cap Settings Source Discrepancy

**Finding:** Tests initially used `CBA_THRESHOLDS` values while validation uses `getCapSettingsForYear()` (from `capProjections.js`). These have slightly different values.

**Decision:** Updated tests to use `capProjections.js` values for consistency with validation logic.

---

## 6. Master Doc Update Confirmation

Updated `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`:

| Section | Update |
|---------|--------|
| 5.2 Validation Map | Added `Exception Blocked` entry with Hard Block type |
| 5.3 Hard Block Rules | Added `exception_blocked` rule |
| 5.4 Exception Blocking Rules | NEW SECTION - Table of exception eligibility by apron |
| 7.1 P0 Gap Analysis | Marked G0-1 and G0-2 as ✅ RESOLVED |
| 7.1.1 Incomplete Roster Charge | NEW SECTION - Implementation details |
| 9. Change Log | Added 2026-01-17 entry for Phase A P0 |

---

## 7. Validation Results

```
Build: ✅ SUCCESS (33.27s)
Tests: ✅ 30/30 PASSING
  - incompleteRosterCharge.test.js: 9/9
  - deadMoney.test.js: 7/7
  - exceptionBlocking.test.js: 14/14
```

---

## 8. No New Local Cap Math Evidence

Grep search confirms no new local cap computations were added outside SSOT:

```bash
# Pattern: reduce sum operations in cap-related contexts
# Result: No new matches in modified files

# Incomplete roster charge is computed INSIDE computeTeamCapTotals (SSOT)
# Exception validation reads from team.totals (SSOT output)
```

---

## 9. Non-Goals Confirmed Not Implemented

As specified in the request:

- ❌ TPE expiration automation (G0-3) - Not implemented (no existing season advance hook found)
- ❌ Full contract min/max rules
- ❌ Manual dead money entry UI

---

## 10. Next Steps

1. **G0-3 TPE Expiration:** Requires investigation of `seasonManager.js` for appropriate hook to wire TPE expiration logic
2. **UI Updates:** Consider adding incomplete roster charge line item to Cap Sheet breakdown display
3. **Integration Testing:** Test with production team data to verify correct charge calculations
