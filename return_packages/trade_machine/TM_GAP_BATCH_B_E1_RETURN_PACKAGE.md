# TM_GAP_BATCH_B_E1 — CBA Rules Completeness (Execution Return Package)

**Phase:** E1 (Execution)
**Date:** 2026-02-15
**Scope:** Batch B — CBA Rules Completeness (5 items)
**Result:** ✅ COMPLETE — All items resolved

---

## Executive Summary

All 5 Batch B items now have definitive status:

- **2 DONE** (implemented and tested)
- **3 NOT IN SCOPE** (documented with clear rationale)

No items remain in limbo state.

---

## Work Completed

### GAP-MISS-001 — 48-Hour Re-Acquisition Rule

**Status:** 🚫 NOT IN SCOPE (v1)
**Reason:** Requires `signedDate` data field that doesn't exist in schema
**Decision:** Would need comprehensive data model changes; defer to v2

### GAP-MISS-002 — Options/Non-Guaranteed Salary Handling

**Status:** 🚫 NOT IN SCOPE (v1)
**Reason:** Requires schema extension (`hasTeamOption`, `hasPlayerOption`, `guaranteedAmount`)
**Decision:** Complex schema changes; trade machine uses full salary (conservative but legal)

### GAP-MISS-003 — Incomplete Roster Charges

**Status:** ✅ VERIFIED DONE
**Finding:** Already implemented in `computeTeamCapTotals.js`
**Code Location:** Lines 202-207

```javascript
const missingSlots = Math.max(0, minRoster - standardRosterCount);
const chargePerSlot = rules.salaries.rookieMin;
const incompleteChargesTotal = missingSlots * chargePerSlot;
```

### GAP-MISS-004 — Cash in Trades

**Status:** 🚫 NOT IN SCOPE (v1)
**Reason:** Backend constants exist (`CASH_LIMITS`), but no UI component
**Decision:** Requires UI work; defer until trade editor UI work planned

### GAP-MISS-005 — Two-Way Contract Trade Restrictions

**Status:** ✅ DONE (Batch B)
**Implementation:**

- Added `isTwoWayPlayer()` helper function
- Checks multiple detection patterns: `isTwoWay`, `contractType`, `salaryType`
- Blocks two-way players from trades with clear message
  **Code Location:** `src/features/architect/utils/tradeMachine/rules/validateEligibility.js` (L123-156)

---

## Files Modified

| File                                                                     | Change                                   |
| ------------------------------------------------------------------------ | ---------------------------------------- |
| `src/features/architect/utils/tradeMachine/rules/validateEligibility.js` | Added two-way trade block (GAP-MISS-005) |

## Files Created

| File                                          | Purpose                                         |
| --------------------------------------------- | ----------------------------------------------- |
| `src/tests/architect/batchB_cbaRules.test.js` | 16 tests covering GAP-MISS-003 and GAP-MISS-005 |

## Documentation Updated

| File                                            | Change                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| `docs/architect/audits/TM_GAPS_TRIAGE_V1.md`    | Updated all Batch B item statuses, Executive Summary, Batch table |
| `docs/architect/audits/TM_SCENARIO_SUITE_V1.md` | Added Scenario G1: Two-Way Player Trade Block                     |

---

## Test Results

```
npm run test src/tests/architect/batchB_cbaRules.test.js -- --run

 ✓ src/tests/architect/batchB_cbaRules.test.js (16 tests) 4443ms
   ✓ Batch B CBA Rules - GAP-MISS-003 Incomplete Roster Charges (5 tests)
   ✓ Batch B CBA Rules - GAP-MISS-005 Two-Way Contract Trade Block (7 tests)
   ✓ Batch B CBA Rules - NOT IN SCOPE Documentation (4 tests)

Test Files  1 passed (1)
     Tests  16 passed (16)
```

---

## CBA Rule Enforced

**Two-Way Contract Trade Block (GAP-MISS-005):**

Per CBA Two-Way Contract rules, two-way players cannot be traded between teams. Teams must waive the player if they wish to move them. This is now enforced with clear messaging:

> "Two-way contract: {playerName} cannot be traded. Two-way players must be waived, not traded."

---

## NOT IN SCOPE Rationale

| Item     | Why Deferred                  | v2 Requirements                          |
| -------- | ----------------------------- | ---------------------------------------- |
| MISS-001 | No `signedDate` field in data | Add date tracking to contract schema     |
| MISS-002 | No options/guarantee fields   | Extend contract schema with option flags |
| MISS-004 | No UI component for cash      | Build cash input in trade editor UI      |

---

## Validation Commands

```bash
# Run Batch B tests
npm run test src/tests/architect/batchB_cbaRules.test.js -- --run

# Run full test suite (includes all trade machine tests)
npm run test -- --run

# Build verification
npm run build
```

---

## Summary Counts

| Metric             | Count |
| ------------------ | ----- |
| Items Resolved     | 5/5   |
| Items Implemented  | 2     |
| Items NOT IN SCOPE | 3     |
| Tests Created      | 16    |
| Tests Passing      | 16    |

---

## Next Steps (Optional v2)

If future work addresses NOT IN SCOPE items:

1. **MISS-001**: Add `signedDate` to contract schema, then implement 48-hour rule
2. **MISS-002**: Add option fields to schema, update `computeMatchingValues()`
3. **MISS-004**: Build cash UI component, wire to existing `CASH_LIMITS` constants

---

## Appendix: Manual QA Scenario

Added to `TM_SCENARIO_SUITE_V1.md`:

**Scenario G1: Two-Way Player Trade Block**

1. Select any two teams
2. From Team A, attempt to add a two-way contract player
3. Click Validate
4. Expected: Trade shows "❌ Trade is NOT CBA Legal" with two-way message
