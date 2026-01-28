# Phase 38: Architect Second Apron Semantics Unification (Execution Return Package)

## Summary

Successfully unified second-apron classification semantics across Architect core utilities. All "Second Apron" checks now strictly interpret the boundary as `salary > secondApron`, eliminating the `>=` drift that existed in legacy helpers.

## Files Changed + Rationale

1. **`src/features/architect/utils/capUtils.js` (Legacy)**
    * **Change:** Refactored to be a thin shell that delegates to the Trade Machine SSOT (`src/features/architect/utils/tradeMachine/utils/capUtils.js`).
    * **Rationale:** Ensures legacy consumers get the correct strict `>` semantics via the SSOT without requiring a mass refactor of call sites.
    * **Behavior:** `getApronStatus` now returns `ABOVE_SECOND_APRON` only if strictly `>` secondApron.

2. **`src/features/architect/utils/tradeHelpers.js`**
    * **Change:** Updated `getApronStatus` to use `salary > secondApron` (was `>=`).
    * **Rationale:** Aligns trade receipt UI labeling with CBA/SSOT.

3. **`src/features/architect/utils/capLegalityValidation.js`**
    * **Change:** Updated `getHardCapStatus` to use `currentCapHit > secondApron` (was `>=`).
    * **Rationale:** Ensures that landing *exactly* on the second apron is not flagged as a hard cap violation or "Second Apron" status.

## Boundary Behavior Table

| Input Salary | Second Apron Limit | Old Result (Legacy) | New Result (SSOT-Aligned) |
| :--- | :--- | :--- | :--- |
| **190M** | **189M** | `ABOVE_SECOND_APRON` | `ABOVE_SECOND_APRON` |
| **189M** | **189M** | `ABOVE_SECOND_APRON` (Incorrect) | `ABOVE_FIRST_APRON` (Correct) |
| **188M** | **189M** | `ABOVE_FIRST_APRON` | `ABOVE_FIRST_APRON` |

## Test Results

### New Guardrail Test: `src/tests/architect/apronSemantics.test.js`

* **Result:** PASS
* **assertions:**
  * Legacy `getApronStatus(130, Limit=130)` returns `ABOVE_FIRST_APRON`.
  * Legacy `getApronStatus(131, Limit=130)` returns `ABOVE_SECOND_APRON`.
  * Trade `getApronStatus(130, Limit=130)` returns `1st Apron`.
  * Trade `getApronStatus(131, Limit=130)` returns `2nd Apron`.

### Regression Tests: `src/tests/architect/capLegalityValidation.test.js`

* **Result:** PASS
* **implication:** No regressions in hard block logic for existing cap validation rules.

## Stop Conditions Encountered

None. The legacy imports mapped cleanly to the SSOT.

## Next Steps

* Monitor User Feedback for any unexpected "First Apron" labeling on teams exactly at the limit (rare but possible).
