# PHASE 75: Room Exception Auto-Eligibility (Under-Cap Gating) + UX Guardrails — EXECUTION RETURN PACKAGE

**Date:** 2026-02-01  
**Phase Type:** EXECUTION  
**Status:** ✅ COMPLETE

---

## 1. Executive Summary

Phase 75 enforces **auto-eligibility** for Room Exception: it can only be used when the team is operating **under the salary cap**. This uses SSOT totals from `computeTeamCapTotals()` and adds UI guardrails so users understand why Room Exception is unavailable when they're over cap.

**Key Results:**

- Created `canUseRoomException(team, yearKey)` helper using SSOT totals
- Room exception blocked at validation layer if team is at or over cap
- UI guardrail in ManageExceptionsModal: toggle disabled + warning message
- 24 new guardrail tests covering all requirements
- All 647 architect tests passing
- Build passes

---

## 2. Implementation Details

### Task A: `canUseRoomException()` Helper

**File:** [src/features/architect/utils/capTotals/computeTeamCapTotals.js](src/features/architect/utils/capTotals/computeTeamCapTotals.js)

```javascript
/**
 * Phase 75: Check if a team is eligible to use the Room Exception.
 * Room Exception can only be used by teams operating UNDER the salary cap.
 * This uses SSOT totals from computeTeamCapTotals().
 *
 * @param {Object} team - Team object (capSheet or team state)
 * @param {number} yearKey - Season end year (e.g., 2025 for "2024-25")
 * @returns {{ eligible: boolean, reason?: string, totals?: { totalCapAllocations, salaryCap, delta } }}
 */
export function canUseRoomException(team, yearKey) {
  if (!team || !yearKey) {
    return {
      eligible: false,
      reason: 'Missing team or yearKey for Room Exception eligibility check',
    };
  }

  const totals = computeTeamCapTotals(team, yearKey);

  // Under-cap means totalCapAllocations < salaryCap (delta vsCap is negative)
  const isUnderCap = totals.deltas.vsCap < 0;

  if (isUnderCap) {
    return {
      eligible: true,
      totals: {
        totalCapAllocations: totals.totalCapAllocations,
        salaryCap: totals.salaryCap,
        delta: totals.deltas.vsCap,
      },
    };
  }

  // Team is at or over cap - not eligible
  const formatM = (v) => `$${(v / 1_000_000).toFixed(2)}M`;
  return {
    eligible: false,
    reason: `Room Exception requires team to be under the salary cap. Team total: ${formatM(totals.totalCapAllocations)}, Cap: ${formatM(totals.salaryCap)} (${formatM(Math.abs(totals.deltas.vsCap))} over cap)`,
    totals: {
      totalCapAllocations: totals.totalCapAllocations,
      salaryCap: totals.salaryCap,
      delta: totals.deltas.vsCap,
    },
  };
}
```

**Eligibility Rule:** `totals.deltas.vsCap < 0` (team's total cap allocations is strictly less than salary cap)

**Export added to:** [src/features/architect/utils/capTotals/index.js](src/features/architect/utils/capTotals/index.js)

---

### Task B: Validation Wiring

**File:** [src/features/architect/utils/capLegalityValidation.js](src/features/architect/utils/capLegalityValidation.js)

Added as **Rule 0** (before other exception rules) in `validateExceptionEligibility()`:

```javascript
// RULE 0: Phase 75 - Room Exception requires team to be under the salary cap (SSOT gating)
const isRoomMLEVariant =
  normalizedException === 'room' ||
  normalizedException === 'roommle' ||
  normalizedException === 'rmle';
if (isRoomMLEVariant) {
  const roomEligibility = canUseRoomException(team, year);
  if (!roomEligibility.eligible) {
    return {
      blocked: true,
      reason:
        roomEligibility.reason ||
        'Room Exception requires team to be under the salary cap',
      violation: {
        rule: 'ROOM_REQUIRES_UNDER_CAP',
        message:
          roomEligibility.reason ||
          'Room Exception requires team to be under the salary cap',
        severity: 'error',
      },
    };
  }
}
```

**Rule Code:** `ROOM_REQUIRES_UNDER_CAP`

**Validation Order:**

1. Rule 0: Room Exception under-cap check (Phase 75 - NEW)
2. Rule 1: Second apron exception blocking (existing)
3. Rule 2: First apron hard-cap check (existing)
4. Rule 3: First apron exception restrictions (existing + Phase 74 room blocking)

---

### Task C: UI Guardrail

**File:** [src/features/architect/capSheet/modals/ManageExceptionsModal.jsx](src/features/architect/capSheet/modals/ManageExceptionsModal.jsx)

**Changes:**

1. Added import: `import { canUseRoomException } from '@/features/architect/utils/capTotals/computeTeamCapTotals';`
2. Added import: `useMemo` to React imports
3. Added eligibility computation:

   ```javascript
   const roomExceptionEligibility = useMemo(() => {
     if (!teamCapSheet || !currentYear) {
       return { eligible: false, reason: 'Missing team data' };
     }
     return canUseRoomException(teamCapSheet, currentYear);
   }, [teamCapSheet, currentYear]);
   ```

4. Added disabled state for room toggle:

   ```javascript
   const isRoomException = type === 'room';
   const roomDisabledByEligibility =
     isRoomException && !roomExceptionEligibility.eligible;
   const isDisabled = roomDisabledByEligibility;
   ```

5. Added warning message when ineligible:

   ```jsx
   {
     isRoomException && roomDisabledByEligibility && (
       <span className="block text-[10px] text-amber-400 mt-0.5">
         ⚠ Only available to teams under the salary cap
       </span>
     );
   }
   ```

---

## 3. Guardrail Tests

**File:** [src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js](src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js)

### 24 Tests in 5 Categories

#### Source Scan Guardrails (7)

1. `canUseRoomException exists in computeTeamCapTotals.js and references computeTeamCapTotals`
2. `canUseRoomException is exported from capTotals/index.js`
3. `capLegalityValidation.js imports and uses canUseRoomException`
4. `capLegalityValidation.js has ROOM_REQUIRES_UNDER_CAP rule code`
5. `ManageExceptionsModal.jsx imports canUseRoomException`
6. `ManageExceptionsModal.jsx computes roomExceptionEligibility using useMemo`
7. `ManageExceptionsModal.jsx shows eligibility warning for room exception`

#### canUseRoomException Unit Tests (5)

1. `returns eligible: true when team is under the cap`
2. `returns eligible: false when team is at the cap (exactly)`
3. `returns eligible: false when team is clearly over the cap`
4. `returns eligible: false with reason when missing team or yearKey`
5. `includes cap proof numbers in reason text when ineligible`

#### Validation Behavioral Tests (6)

1. `room signing FAILS when team is clearly over cap (ROOM_REQUIRES_UNDER_CAP)`
2. `room signing PASSES when team is under cap`
3. `roommle variant triggers same under-cap check`
4. `rmle variant triggers same under-cap check`
5. `reason includes cap proof numbers for debugging`
6. `non-room exceptions are NOT affected by under-cap gating`

#### Regression Checks (2)

1. `room exception signing does NOT trigger hard cap (Phase 74 invariant)`
2. `tradeExceptions is NOT in TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST (Phase 64 invariant)`

#### Boundary and Edge Cases (4)

1. `team well under cap is eligible`
2. `team clearly over cap is NOT eligible`
3. `team with no players (zero salary) is eligible`
4. `eligibility result includes totals breakdown`

---

## 4. Test Suite Results

### Phase 75 Tests

```
✓ src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js (24)
Duration: 10.17s
```

### Full Architect Suite

```
Test Files  44 passed (44)
     Tests  647 passed (647)
Duration: 45.11s
```

### Build

```
✓ built in 29.19s
```

---

## 5. Files Modified

| File                                                                                                                                 | Change                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| [src/features/architect/utils/capTotals/computeTeamCapTotals.js](src/features/architect/utils/capTotals/computeTeamCapTotals.js)     | Added `canUseRoomException()` helper function                                            |
| [src/features/architect/utils/capTotals/index.js](src/features/architect/utils/capTotals/index.js)                                   | Added `canUseRoomException` to exports                                                   |
| [src/features/architect/utils/capLegalityValidation.js](src/features/architect/utils/capLegalityValidation.js)                       | Added Rule 0 for room exception under-cap check with `ROOM_REQUIRES_UNDER_CAP` code      |
| [src/features/architect/capSheet/modals/ManageExceptionsModal.jsx](src/features/architect/capSheet/modals/ManageExceptionsModal.jsx) | Added room exception eligibility check, disabled toggle when ineligible, warning message |

---

## 6. Files Created

| File                                                                                                                                                             | Purpose                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js](src/tests/architect/phase75_room_exception_auto_eligibility_guardrails.test.js) | 24 guardrail tests for Room Exception auto-eligibility |

---

## 7. Acceptance Criteria Verification

| Criterion                                                         | Status                                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AC1: Room Exception eligibility enforced by SSOT under-cap gating | ✅ `canUseRoomException()` uses `computeTeamCapTotals()`                            |
| AC2: Room exception signings fail when not under cap              | ✅ Rule 0 in `validateExceptionEligibility()` blocks with `ROOM_REQUIRES_UNDER_CAP` |
| AC3: ManageExceptionsModal prevents enabling room when ineligible | ✅ Toggle disabled + warning message shown                                          |
| AC4: Phase 75 guardrail test file exists and passes               | ✅ 24/24 tests passing                                                              |
| AC5: Full architect test suite passes                             | ✅ 647/647 tests passing                                                            |
| AC6: Build passes                                                 | ✅ Built in 29.19s                                                                  |
| AC7: Master Doc updated with Phase 75 entry                       | ✅ History entry added                                                              |

---

## 8. Important Note: Incomplete Roster Charges

During testing, discovered that **incomplete roster charges** affect under-cap calculations:

- Teams with fewer than 14 standard players incur charges (~$1.1M per missing slot)
- Example: A team with 1 player at $130M has 13 missing slots × $1.1M = ~$14M charges
- Total: $130M + $14M = $144M > $141M cap = **NOT eligible for Room Exception**

This is **correct behavior** - the SSOT totals include all cap allocations including incomplete roster charges.

---

## 9. Master Doc Update

Added Phase 75 history entry to [CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md](docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md):

```markdown
- 2026-02-01: Phase 75 Room Exception Auto-Eligibility (EXECUTION) - Added under-cap gating for Room Exception using SSOT totals. (1) Created `canUseRoomException(team, yearKey)` helper in `computeTeamCapTotals.js` using SSOT totals; returns `{ eligible: boolean, reason?: string, totals: { totalCapAllocations, salaryCap, delta } }`. (2) Wired into `validateExceptionEligibility()` as Rule 0: room exception variants now check under-cap eligibility BEFORE apron checks; returns `ROOM_REQUIRES_UNDER_CAP` rule code with cap proof numbers in reason. (3) Added UI guardrail in `ManageExceptionsModal.jsx`: room toggle disabled when ineligible, inline warning "Only available to teams under the salary cap" shown. (4) 24 new guardrail tests in `phase75_room_exception_auto_eligibility_guardrails.test.js` covering: source scan (7), unit tests (5), validation behavioral (6), regression checks (2), boundary cases (4). (5) All 647 architect tests passing. Build passes.
```

---

## 10. Follow-Up Work (From Previous Phases)

| Priority | Item                           | Notes                                                                                 |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| 1        | Season Advance Exception Reset | No existing reset logic for any exception type - should reset all exceptions annually |
| 2        | BAE Cooldown Logic             | BAE has a 2-year cooldown rule that isn't currently enforced                          |
| 3        | MLE Proration                  | MLEs used late in season should be prorated                                           |

---

**Phase 75 Complete.** Room Exception now has proper under-cap gating with SSOT totals, validation blocking, UI guardrails, and comprehensive test coverage.
