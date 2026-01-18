# Phase 7.1: Cap Hold Transition Enforcement

**Date:** 2026-01-18
**Author:** Antigravity (Phase 7.1 Execution)
**Status:** ✅ Complete

---

## 1. Goal

Make `cap_hold_transition_invalid` an enforceable hard-block rule.
Address option decline logic to ensure correct cap hold creation, removal of player from roster, and valid `freeAgency` state.

## 2. Changes Implemented

### 2.1 New Helper Infrastructure

**File:** `src/features/architect/utils/capHoldTransitionHelpers.js` (Created)

Pure functions to reason about cap hold transitions:

- `didCreateCapHold()`: Detects if a cap hold appeared.
- `shouldExpectCapHoldOnDecline()`: Determines if a cap hold is required based on prior salary.
- `isCapHoldAmountValid()`: Validates structural integrity of cap hold.
- `validateDeclineFreeAgency()`: Enforces canonical `freeAgency` object shape and year correctness.

### 2.2 Validation Logic Updates

**File:** `src/features/architect/utils/capLegalityValidation.js`

Updated `validateOptionDecision()` to be pipeline-aware:

- Now accepts `updatedTeam` (from mutation result).
- **Rule Enforcement:**
  - **Accept Option:** Blocks if any cap hold is created for the player (`cap_hold_transition_invalid`).
  - **Decline Option:** Blocks if expected cap hold is MISSING.
  - **Decline Option:** Blocks if cap hold amount is invalid (negative).
  - **Decline Option:** Validates `freeAgency` object on the updated player state (if present).

### 2.3 Pipeline Fixes

**File:** `src/features/architect/utils/mutationPipeline.js`

1. **Bug Fix:** `freeAgentYear` was previously set to `targetYear` (Option Year) on decline. Fixed to `targetYear - 1` (the actual free agency year).
2. **Wiring:** Now passes `updatedTeam` from `computeResult` into `validateOptionDecision` to enable state-transition validation.
3. **Verification:** Confirmed `freeAgency.year` is correctly set to `targetYear - 1`.

### 2.4 Tests

**File:** `tests/architect/capLegalityValidation.test.js`

Added comprehensive test suite for Phase 7.1:

- Blocks Accept + Cap Hold creation (contradiction).
- Blocks Decline + Missing Cap Hold (when prior salary exists).
- Allow Valid Decline (correct cap hold + canonical `freeAgency`).
- Blocks Invalid Cap Hold (negative amount).
- Validates `freeAgency` year alignment.

**Result:** 110/110 tests passed.

---

## 3. Key Decisions & Findings

### 3.1 Cap Hold Model (Simplified)

The NBA CBA defines cap hold percentages based on Bird rights status (190% Full, 130% Early, 120% Non-Bird).
**Decision:** We maintained the existing simplified **150% model** for consistency with the rest of the codebase. This is documented in `capHoldTransitionHelpers.js` and the Master Doc. Infrastructure is now in place (`computeExpectedCapHoldAmount`) to easily swap this for a precise model in a future phase.

### 3.2 Free Agency Year Definition

**Finding:** Declining an option for Season X (e.g., 2025-26, ending 2026) makes the player a Free Agent in the summer of 2025 (`targetYear - 1`).
**Action:** Confirmed `freeAgency: { year: targetYear - 1 }` is correct. Fixed `freeAgentYear` on player object to match (`targetYear - 1`).

---

## 4. Next Steps

- **Phase 8:** Trade Validation (already in progress via other tracks).
- **Future Refinement:** Implement precise Bird-rights-based cap hold calculations (190%/130%/120%) replacing the 150% placeholder.

---

## 5. Artifacts

- `src/features/architect/utils/capHoldTransitionHelpers.js`
- `src/features/architect/utils/capLegalityValidation.js`
- `src/features/architect/utils/mutationPipeline.js`
- `tests/architect/capLegalityValidation.test.js`
- `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
