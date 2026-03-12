# TM_VALIDATOR_TS_CAP_LEGALITY_HELPERS_E61 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the helper-first portion of the non-trade cap-legality boundary to authoritative TypeScript through:
  - `src/features/architect/utils/contractNormalization.ts`
  - `src/features/architect/utils/capHoldTransitionHelpers.ts`
- Behavior was preserved across named-export surfaces, contract/free-agency normalization semantics, invariant behavior, cap-hold transition reasoning, result shapes, warning/reason behavior, fallback/default behavior, and compatibility import behavior.
- No in-scope area had to remain JS for runtime logic. The kept `.js` files are now pure compatibility re-export shims only.

## 2. Files Changed
- `src/features/architect/utils/contractNormalization.ts`
  - Added the authoritative TS implementation for the existing contract normalization helper surface.
  - Safe because the current logic was ported directly without semantic cleanup, including current defaults, deletions, and behavior-bearing validation text.
- `src/features/architect/utils/contractNormalization.js`
  - Replaced the prior JS implementation with a pure compatibility shim re-exporting `contractNormalization.ts`.
  - Safe because direct-path `.js` and extensionless imports remain intact while business logic now lives in the TS authority.
- `src/features/architect/utils/capHoldTransitionHelpers.ts`
  - Added the authoritative TS implementation for the existing cap-hold transition helper surface.
  - Safe because the current logic was ported directly without changing cap-hold reasoning, fallback behavior, or behavior-bearing violation text.
- `src/features/architect/utils/capHoldTransitionHelpers.js`
  - Replaced the prior JS implementation with a pure compatibility shim re-exporting `capHoldTransitionHelpers.ts`.
  - Safe because importer compatibility remains intact while the authoritative logic moves to TS.
- `tests/architect/contractNormalization.test.js`
  - Extended direct-surface coverage to the previously unverified team-ref normalization and free-agency plausibility helpers.
  - Safe because it verifies preserved behavior rather than changing production logic.
- `tests/architect/capHoldTransitionHelpers.test.ts`
  - Added focused direct-surface coverage for cap-hold lookup, validation, decline expectations, multiplier resolution, and decline free-agency validation.
  - Safe because it proves the helper surface without widening into hub migration work.
- `tests/smoke/capLegalityHelperImports.smoke.test.ts`
  - Added extensionless/explicit `.js` compatibility coverage and shim-only content checks for both migrated helpers.
  - Safe because it verifies compatibility without altering runtime behavior.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E61 execution entry.
  - Safe because it records the completed migration state and next-step status only.

## 3. Types Introduced or Hardened
- `TeamRefLike`, `PlayerLike`, `SalaryRowLike`, `FreeAgencyLike`, `ContractLike`
  - Local permissive input shapes for the authoritative `contractNormalization.ts` path.
  - Apply across team-ref normalization, salary-row normalization, free-agency normalization/validation, and contract/future-contract normalization.
- `FreeAgencyValidationContext`, `ValidationIssue`, `FreeAgencyValidationResult`
  - Local result/context shapes for `validateFreeAgencyState()` in `contractNormalization.ts`.
  - Apply only inside the authoritative helper path; no new public types were exported.
- `CapHoldLike`, `TeamLike`, `ComputeExpectedCapHoldAmountParams`
  - Local permissive input shapes for the authoritative `capHoldTransitionHelpers.ts` path.
  - Apply across cap-hold lookup/removal detection and cap-hold amount computation.
- `CapHoldValidationResult`, `TransitionIssue`, `DeclineFreeAgencyValidationResult`
  - Local result shapes for cap-hold object validation and option-decline free-agency validation.
  - Apply only inside the authoritative helper path; no new public types were exported.

## 4. Migration Work Completed
- `src/features/architect/utils/contractNormalization.js`
  - Moved the authoritative logic into `contractNormalization.ts` and converted the `.js` file into a shim.
  - Preserved all named exports in place, current normalization semantics, null/undefined handling, object spread/delete behavior, fallback/default behavior, and behavior-bearing validation/warning text exactly.
  - No runtime correction was required. The only typing changes were local permissive helper types and one string-narrowing adjustment inside `normalizeTeamRef()` to satisfy TypeScript without changing behavior.
- `src/features/architect/utils/capHoldTransitionHelpers.js`
  - Moved the authoritative logic into `capHoldTransitionHelpers.ts` and converted the `.js` file into a shim.
  - Preserved all named exports in place, cap-hold lookup and transition reasoning, multiplier source behavior, exact validation reasons/messages, fallback behavior, and `seasonUtils.js` dependency routing exactly.
  - No runtime correction was required. The only typing changes were local permissive helper types and safe local casting around `birdRights` access so existing TS consumers continued compiling.

## 5. JS Holdouts
- `src/features/architect/utils/capLegalityValidation.js`
  - Remains JS because E61 was explicitly limited to the helper-first phase and the validator hub is the intended next follow-up phase.
  - No blocker was encountered that required silently absorbing it into E61.
- `src/features/architect/utils/seasonUtils.js`
  - Remains JS because it is the intentionally out-of-scope deprecated wrapper from the closed E59 season-helper arc.
  - `capHoldTransitionHelpers.ts` intentionally continues resolving `toEndYear` through this wrapper to preserve current dependency behavior without reopening E59.

## 6. Regression Coverage Run
- `npm run typecheck`
  - Proved the new TS authorities compile cleanly and existing TS consumers continue resolving the migrated helper surfaces.
  - Result: PASS.
- `npm run validate:project`
  - Proved the repo structure remains valid after adding the new TS authorities and new focused tests.
  - Result: PASS.
- `npm run test:node -- --reporter=dot tests/architect/contractNormalization.test.js tests/architect/capHoldTransitionHelpers.test.ts tests/smoke/capLegalityHelperImports.smoke.test.ts tests/architect/capLegalityValidation.test.js src/tests/architect/capLegalityValidation.test.js tests/architect/renounceRights.test.js src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts`
  - Proved direct helper behavior for both migrated helpers, preserved import compatibility for extensionless plus explicit `.js` imports, and preserved unchanged downstream behavior in the narrow validator, renounce-rights, and post-state validation dependents.
  - Result: PASS (`7` files, `335` tests).
- Commands intentionally skipped
  - `npm run build`
  - Reason: no UI/routes/components changed in this pass.
  - `npm run test:diff -- --reporter=dot`
  - Reason: the focused node proof set exercised the exact migrated surfaces and their narrow downstream dependencies more directly.
  - broader suites such as `npm run test:architect -- --reporter=dot`
  - Reason: no targeted uncertainty remained after the focused proof set passed.

## 7. Post-E61 Status
- The helper-first phase is effectively complete for the approved E61 boundary.
- No additional helper-side follow-up is recommended inside `contractNormalization` or `capHoldTransitionHelpers`.
- The grouped helper-first phase succeeded cleanly.
- `src/features/architect/utils/capLegalityValidation.js` remains the intended next follow-up phase unless new evidence proves otherwise.

## 8. Master Doc Update
- Added `### Validator TS Cap Legality Helpers E61 (2026-03-12)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that:
  - `contractNormalization` and `capHoldTransitionHelpers` are now TS-backed through authoritative `.ts` implementations
  - behavior remained unchanged across named-export surfaces, normalization semantics, cap-hold transition reasoning, warning/reason behavior, fallback/default behavior, and compatibility-facing imports
  - the two original `.js` files are now pure compatibility shims only
  - the helper-first phase completed cleanly with no helper-side blocker remaining
  - `capLegalityValidation.js` remains the intended next follow-up phase
