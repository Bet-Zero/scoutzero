# TM_FIXPACK_E1 — EXECUTION RETURN PACKAGE
**Date:** 2026-03-01  
**Status:** COMPLETE

## 1) Summary
TM_FIXPACK_E1 is implemented for Trade Machine with three outcomes:
- Hard-cap typing is now canonicalized and preserved through hydration/snapshot/validation.
- Allowable incoming now has reliable hard-cap-aware effective ceiling plumbing (`effectiveAllowableIncoming = min(salaryMatchingCeiling, hardCapIncomingCeiling)`), and UI consumes the same canonical value/label path.
- A DEV-only Sign-and-Trade injector is now available in Development Tools, with synthetic eligible/ineligible players in local TM state only (no Firestore writes).

## 2) Files Changed
### Core hard-cap typing + ceiling
- `src/features/architect/utils/firebaseTeamPlanHelpers.js`
- `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js`
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
- `src/features/architect/utils/tradeMachine/rules/hardCapValidation.js`
- `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
- `src/features/architect/hooks/useTradeMachine.js`

### Snapshot/UI parity
- `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`
- `src/features/architect/hooks/useTradeMachineSnapshot.js`
- `src/features/architect/tradeMachine/TradeTeamCard.jsx`

### DEV S&T injector
- `src/features/architect/tradeMachine/utils/devSntInjector.js` (new)
- `src/features/architect/tradeMachine/TradeEditor.jsx`
- `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`

### Tests (new/updated)
- `tests/trade/salaryMatching.test.js`
- `src/tests/trade/hardCap_salaryMatching.guardrail.test.js`
- `src/tests/trade/tradeMultiSurfaceOfficialValues.test.js`
- `src/tests/tradeMachine/tradeAllowableIncomingParity.guardrail.test.ts`
- `src/tests/architect/devSntInjector.utils.test.ts` (new)
- `src/tests/architect/tradePlayerRow.signAndTradeInjector.test.tsx` (new)
- `src/tests/architect/validationDetailsPanel.devSntInjector.test.tsx` (new)
- `src/tests/architect/useTradeMachine.devSntInjector.test.tsx` (new)
- `src/tests/architect/tradeEditor.devSntInjectorGate.guardrail.test.ts` (new)

## 3) Hard-Cap Type Integrity — Before vs After
### Before
- Hydration flattened hard-cap state toward boolean-only usage in key paths.
- Legacy/ambiguous flags could lose apron-type fidelity.
- UI/display and effective limiter proofs were not reliable for near-apron hard-cap cases.

### After
- Canonical hard-cap status now returns:
  - `isHardCapped: boolean`
  - `hardCapType: "FIRST_APRON" | "SECOND_APRON" | "UNKNOWN"`
  - `hardCapCeiling`, plus label/type/fail-closed metadata
- Backward-compat helpers remain exported (`isTeamHardCapped`, `getHardCapStatusFromContext`).
- Hydration now preserves typed `hardCapLevel` while keeping legacy `hardCapped` compatibility.
- Unknown hard-cap type is fail-closed to restrictive ceiling (`1st Apron` when available), without silently defaulting boolean `true` to first apron as an asserted type.

## 4) Numeric Proof (Expected vs Actual)
### Case A — First Apron hard-cap effective limiter
- Scenario: `salaryOut=10.0M`, salary-matching ceiling `17.5M`, hard-cap incoming ceiling `11.0M`.
- Expected: `effectiveAllowableIncoming = min(17.5, 11.0) = 11.0M`.
- Actual (test): `allowableIncoming=17.5M`, `hardCapIncomingCeiling=11.0M`, `effectiveAllowableIncoming=11.0M`.
- Evidence: `tests/trade/salaryMatching.test.js`.

### Case B — Second Apron typed hard cap selection
- Scenario uses typed second-apron hard cap.
- Expected: second-apron ceiling branch is selected, effective limiter uses `min(...)`.
- Actual (test): `hardCapType=SECOND_APRON`, `hardCapCeiling.apronLabel='2nd Apron'`, effective value matches expected branch.
- Evidence: `tests/trade/salaryMatching.test.js`.

### Case C — Unknown hard-cap fail-closed
- Scenario: legacy boolean hard-cap without typed level.
- Expected: `hardCapType=UNKNOWN`, restrictive fail-closed ceiling applied.
- Actual (test): unknown type emitted, fail-closed label/ceiling surfaced; trade-level hard-cap rule blocks breach path.
- Evidence: `tests/trade/salaryMatching.test.js`, `src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts`.

## 5) DEV S&T Injector — How To Use
1. Start emulators and dev server:
   - `npm run emu`
   - `npm run dev`
2. In browser console on TM route, enable flag:
   - `localStorage.setItem('hz.dev.injectSntPlayers', 'true')`
3. Open Trade Machine -> `Development Tools`.
4. In `S&T Runtime Injector` section click `Inject S&T Test Players`.
5. Verify rows appear:
   - `TM DEV S&T Eligible`
   - `TM DEV S&T Ineligible`
6. Open eligible player row menu:
   - `Sign-and-Trade` action is shown.
7. Open ineligible row menu:
   - `Sign-and-Trade` is not shown.
8. Click `Clear Injected Players` or `Reset Trade` to clear synthetic players.

## 6) Validation Commands Run
- `npm run validate:project` -> PASS
- `npm run build` -> PASS (non-blocking warnings)
- `npm run test:trade -- --reporter=dot` -> PASS
  - 58 files, 536 tests: 532 passed, 1 skipped, 3 todo
- `npm run test:architect -- --reporter=dot` -> PASS
  - 158 files, 2412 tests: 2408 passed, 1 skipped, 3 todo

## 7) Runtime Spot-Check Notes
- `npm run emu` was run successfully (emulators reached `All emulators ready`).
- `npm run dev` was sandbox-blocked on `::1:5173` and rerun with escalation successfully (`http://localhost:5175`).
- Headless Playwright runtime automation attempt was blocked by missing browser binary (`playwright install` required in this environment).
- Runtime S&T injector behavior was therefore validated via targeted UI/state tests added in this fixpack.

## 8) Commands Intentionally Skipped
- `npm run test:full` / raw `vitest` commands
  - Skipped by policy (no `RUN FULL SUITE` directive).

## 9) Safety/Scope
- No source-data write paths were changed (`players_v2`, `architect_base*` remain read-only surfaces).
- DEV injector mutates local in-memory TM state only and is gated behind:
  - `import.meta.env.DEV`
  - `localStorage['hz.dev.injectSntPlayers'] === 'true'`
