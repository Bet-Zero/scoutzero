# ARCHITECT_SMOKE_E2 — EXECUTION RETURN PACKAGE

Date: 2026-03-04  
Mode: EXECUTION  
Status: ✅ COMPLETE

---

## Summary

ARCHITECT_SMOKE_E2 is complete with minimal, deterministic scope:

1. Removed React function-component `defaultProps` deprecation warnings for:
   - `DraftPositionsInput`
   - `OffseasonTab`
   - `SeasonAdvanceModal`
2. Hardened `test:rules` emulator warm-up behavior with deterministic retry while preserving fail-closed emulator-only policy.
3. Added a smoke guardrail test that fails if the known defaultProps warning string regresses.
4. Updated required docs/ledger and validated all required commands in the requested order.

No product behavior changes were introduced.

---

## Files Changed

- `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`
- `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`
- `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`
- `scripts/ci/run_rules_integration_tests.mjs`
- `src/tests/smoke/architect.uiSmoke.e1.test.tsx`
- `docs/architect/ARCHITECT_SMOKE_MASTER.md`
- `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- `return_packages/architect_fixes/ARCHITECT_SMOKE_E2_EXECUTION_RETURN_PACKAGE.md`

---

## T1) DefaultProps Warning Removal (No Behavior Change)

### 1) DraftPositionsInput

File: `src/features/architect/GMDashboard/components/DraftPositionsInput.jsx`

Before:

- Function signature had no defaults.
- `DraftPositionsInput.defaultProps = { worldId: null, worldSeason: null }`.

After:

- Function signature now uses parameter defaults:
  - `worldId = null`
  - `worldSeason = null`
- `defaultProps` block removed.

Behavior parity:

- Missing/undefined `worldId` and `worldSeason` resolve to the same values (`null`) as before.
- `currentYear` remains required and unchanged.

### 2) OffseasonTab

File: `src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx`

Before:

- `OffseasonTab.defaultProps = { offseasonRun: false, capProjections: null, playersMap: {} }`.
- Function signature already had `playersMap = {}`.

After:

- Function signature defaults now cover all previous defaultProps values:
  - `offseasonRun = false`
  - `capProjections = null`
  - `playersMap = {}` (unchanged, retained)
- `defaultProps` block removed.

Behavior parity:

- Missing/undefined props preserve prior defaults.
- Existing falsy-but-defined values (for example explicit `false`) continue to behave identically.

### 3) SeasonAdvanceModal

File: `src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx`

Before:

- `SeasonAdvanceModal.defaultProps = { teamCapSheet: null, worldId: null, teamCode: null, onAdvanceComplete: null }`.

After:

- Function signature defaults now match previous defaultProps values:
  - `teamCapSheet = null`
  - `worldId = null`
  - `teamCode = null`
  - `onAdvanceComplete = null`
- `defaultProps` block removed.

Behavior parity:

- Missing/undefined optional props keep identical null semantics.
- No prop renames, no requiredness changes, no UI text changes.

---

## T2) Rules Warm-up Retry Policy (Fail-Closed, Emulator-Only)

File: `scripts/ci/run_rules_integration_tests.mjs`

Change:

- Added deterministic preflight retry wrapper around emulator reachability check.

Policy implemented:

- Attempts: **10**
- Delay: **400ms fixed** between attempts
- Check: existing TCP reachability (`host:port`) check

Fail-closed behavior preserved:

- If emulator still unreachable after retries, process exits non-zero.
- Existing guidance remains:
  - `Start it with npm run emu and retry npm run test:rules`
- No fallback path to production added.

---

## T3) Deterministic Guardrail for defaultProps Warning Regression

File: `src/tests/smoke/architect.uiSmoke.e1.test.tsx`

Added test:

- `does not emit function-component defaultProps deprecation warnings`

Mechanics:

- Spies on `console.warn` and `console.error` for the smoke render of `OffseasonSection`.
- Captures combined logs and asserts none include:
  - `Support for defaultProps will be removed from function components`

Scope discipline:

- Guardrail blocks only the known warning substring.
- Does not over-ban unrelated warnings.

---

## T4) Docs + Ledger Updates

Updated required docs:

1. `docs/architect/ARCHITECT_SMOKE_MASTER.md`
   - Added `ARCHITECT_SMOKE_E2` section with guarantees:
     - warning-clean smoke path
     - deterministic warning regression guardrail
     - rules warm-up retry details (`10 x 400ms`) and fail-closed stance

2. `docs/architect/ARCHITECT_SHIP_GATES_MASTER.md`
   - Updated rules integration section with deterministic warm-up retry details.
   - Updated smoke section to reflect warning-clean guarantee and guardrail.
   - Added review-history row for `ARCHITECT_SMOKE_E2`.

3. `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
   - Appended complete `ARCHITECT_SMOKE_E2` entry with scope, commands, and outcomes.

---

## Validation Outputs (Required Order)

1. `npm run validate:project`  
   Result: **PASS**  
   Key output: `✅ All validations passed!`

2. `npm run build`  
   Result: **PASS**  
   Key output: `✓ built in 56.98s`  
   Notes: Existing non-blocking Vite warnings remained (chunk size, dynamic import/chunking notices).

3. `npm run typecheck`  
   Result: **PASS**

4. `npm run test:trade -- --reporter=dot`  
   Result: **PASS**  
   Key output: `Test Files 58 passed (58)` / `Tests 537 passed (537)`

5. `npm run test:architect -- --reporter=dot`  
   Result: **PASS**  
   Key output: `Test Files 167 passed (167)` / `Tests 2454 passed (2454)`

6. `npm run test:rules`  
   Result: **PASS**  
   Key output: `Test Files 1 passed (1)` / `Tests 16 passed (16)`

7. `npm run test:smoke:architect`  
   Result: **PASS**  
   Key output: `Test Files 1 passed (1)` / `Tests 7 passed (7)`

8. `npm run smoke:architect`  
   Result: **PASS**  
   Key output: `[ARCHITECT_SMOKE_E1] PASS: all smoke gates completed.`

DefaultProps-warning verification:

- Searched smoke-run outputs for `Support for defaultProps will be removed from function components`.
- Result: no matches.

---

## 3x Back-to-Back `npm run smoke:architect` Stability Evidence

- Run 1: **PASS**
  - `ARCHITECT_GATES_E2`: PASS
  - smoke suite: `Tests 7 passed (7)`
  - `[ARCHITECT_SMOKE_E1] PASS: all smoke gates completed.`

- Run 2: **PASS**
  - `ARCHITECT_GATES_E2`: PASS
  - smoke suite: `Tests 7 passed (7)`
  - `[ARCHITECT_SMOKE_E1] PASS: all smoke gates completed.`

- Run 3: **PASS**
  - `ARCHITECT_GATES_E2`: PASS
  - smoke suite: `Tests 7 passed (7)`
  - `[ARCHITECT_SMOKE_E1] PASS: all smoke gates completed.`

Conclusion: all 3 consecutive smoke runs passed.

---

## Stop-Condition Check

- No prod fallback introduced in rules/smoke scripts.
- No new `skip`, `todo`, or disabled assertions added.
- No new warnings introduced by E2 changes; defaultProps deprecation warning is now blocked and absent.
- No observed flakiness in required validation or 3x smoke sequence.

---

## Open Questions / Remaining Gotchas

none
