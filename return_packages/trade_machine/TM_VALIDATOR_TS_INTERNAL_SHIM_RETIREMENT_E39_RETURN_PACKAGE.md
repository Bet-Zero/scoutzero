# TM_VALIDATOR_TS_INTERNAL_SHIM_RETIREMENT_E39 — EXECUTION RETURN PACKAGE

## 1. Summary
- Completed one grouped internal-shim retirement pass across the six E38 shim candidates.
- Updated internal imports, kept public JS entrypoints, and shim-only parity coverage to direct authoritative targets without changing validator behavior, helper semantics, result shapes, or public entrypoint names.
- No E38 internal shim files remain after E39. The only JS files intentionally left in this audited slice are the four public entrypoints/barrels plus the two out-of-scope constants/message surfaces.

## 2. Files Changed
- `src/features/architect/utils/mutationPipeline.js` moved `createTPE` from `tradeUtilities` to `tpeValidation.js`. Safe because `tpeValidation.js` is the verified direct TPE ownership module and the imported symbol stayed identical.
- `src/features/architect/utils/stepienUtils.js` moved `isMeaningfulProtection` from `tradeUtilities.js` to `tradeUtilityMisc.js`. Safe because the helper already resolves to that implementation through the deleted shim.
- `src/features/architect/utils/tradeHelpers.js` moved `isPriorYearTPE` to `tpeValidation.js` and the `isMeaningfulProtection` re-export to `tradeUtilityMisc.js`. Safe because both symbols kept the same public names and authoritative implementations.
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts` replaced shim imports with `tpeValidation.js`, `validateCash.js`, and `validateReacquisition.js`. Safe because the rule/helper ownership stayed one-to-one with no logic changes.
- `src/features/architect/utils/tradeMachine/index.js` retargeted public re-exports from internal shims to `validateCash.js`, `validateRoster.ts`, and `tradeUtilityMisc.js`. Safe because the exported symbol names and public entrypoint path stayed unchanged.
- `src/features/architect/utils/tradeMachine/rules/basicRules.ts` moved `isPriorYearTPE` to `tpeValidation.js`. Safe because the helper implementation is unchanged and the import is now direct.
- `src/features/architect/utils/tradeMachine/rules/draftRules.ts` moved `isMeaningfulProtection` to `tradeUtilityMisc.js`. Safe because the helper implementation is unchanged and the import is now direct.
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js` was deleted after all runtime, barrel, and test consumers were moved to `validateCash.js`, `validateReacquisition.js`, and `validateEligibility.js`. Safe because the file was a pure shim.
- `src/features/architect/utils/tradeMachine/rules/index.js` replaced shim-based re-exports with direct exports from `validateRoster.ts`, `validateCash.js`, `validateReacquisition.js`, and `validateEligibility.js`. Safe because the barrel kept the same intended public surface and avoided widening exports.
- `src/features/architect/utils/tradeMachine/rules/miscRules.ts` moved `validateCash` to `validateCash.js`. Safe because the symbol already lived there behind the deleted shim.
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js` was deleted after all runtime, barrel, and test consumers were moved to `validateRoster.ts`. Safe because the file was a pure shim.
- `src/features/architect/utils/tradeMachine/rules/validateStepien.ts` moved `isMeaningfulProtection` to `tradeUtilityMisc.js`. Safe because the helper implementation is unchanged and the import is now direct.
- `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js` was deleted after all barrel and test consumers were moved to `matchingValues.js`. Safe because the file was a deprecated wrapper only.
- `src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js` moved `isMeaningfulProtection` to `tradeUtilityMisc.js`. Safe because the helper implementation is unchanged and the import is now direct.
- `src/features/architect/utils/tradeMachine/utils/index.js` replaced `tradeUtilities.js`, `computeMatchingValues.js`, `validateInput.js`, and `normalizeTradeInput.js` re-exports with direct exports from `tpeValidation.js`, `tradeUtilityMisc.js`, `matchingValues.js`, `validateInput.ts`, and `normalizeTradeInput.ts`. Safe because the kept JS barrel still exposes the same intended public helpers.
- `src/features/architect/utils/tradeMachine/utils/matchingValues.ts` updated a stale comment to reference `normalizeTradeInput.ts`. Safe because this was documentation-only.
- `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js` was deleted after all barrel/test consumers moved to `normalizeTradeInput.ts` and the Phase 65/66 guardrails were updated not to depend on the shim file. Safe because the file was a pure shim and there was no remaining blocker.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` was deleted after TPE consumers moved to `tpeValidation.js`, misc/protection consumers moved to `tradeUtilityMisc.js`, and parity tests were rewritten to use the surviving utils barrel. Safe because the file was a pure compatibility barrel.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.ts` updated the header comment to describe it as the direct non-TPE target. Safe because this was documentation-only.
- `src/features/architect/utils/tradeMachine/utils/validateInput.js` was deleted after all barrel/test consumers moved to `validateInput.ts`. Safe because the file was a pure shim.
- `src/features/architect/utils/tradeMachine/validators/index.js` retargeted shim-based re-exports to `validateCash.js`, `validateRoster.ts`, `matchingValues.js`, `validateInput.ts`, and `normalizeTradeInput.ts`. Safe because the kept JS entrypoint still exposes the same intended public validator helpers.
- `src/tests/architect/legacyMatchingValue.test.js` updated a stale comment from `normalizeTradeInput.js` to `normalizeTradeInput.ts`. Safe because this was documentation-only.
- `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js` removed the obsolete `normalizeTradeInput.js` allowlist entry and related comments. Safe because `normalizeTradeInput.ts` does not directly read `.tradeExceptions`, so no allowlist exception is needed.
- `src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js` changed the path-sensitive guardrail checks from `normalizeTradeInput.js` to `normalizeTradeInput.ts`. Safe because the test still verifies the same canonical `getTeamTpeList` behavior.
- `src/tests/architect/utils/seasonManager.tpe.test.js` moved `createTPE` to `tpeValidation.js`. Safe because the helper implementation is unchanged and the test now targets the authoritative module directly.
- `src/tests/fixtures/tradeMachinePicks/protection_swap_plus_minus_strings.json` updated source-path strings from `tradeUtilities.js` to `tradeUtilityMisc.ts`. Safe because this fixture documents the surviving authoritative helper location.
- `src/tests/tradeMachine/conveyancePreflight.test.js` moved `isMeaningfulProtection` and `getPickOptions` to `tradeUtilityMisc.js`. Safe because the helper behavior is unchanged and the test now targets the authoritative module directly.
- `tests/newSchemaValidation.test.js` moved `computeMatchingValues` to `matchingValues.js`. Safe because `computeMatchingValues.js` was only a wrapper around that canonical module.
- `tests/smoke/imports.smoke.test.js` updated the representative barrel assertions to prove `rules/index.js`, `validators/index.js`, and `utils/index.js` still expose the expected post-cleanup helpers. Safe because this only strengthens compatibility coverage.
- `tests/trade/cashLedger_season_tracking.test.js` moved `validateCash` to `validateCash.js`. Safe because the rule implementation is unchanged and the test now targets the authoritative module directly.
- `tests/trade/input_validation.test.js` moved `validateTradeInput` and `normalizeTradeInput` to their TS authoritative targets. Safe because these are direct-target imports with no behavior changes.
- `tests/trade/tradeKicker_zeroGuarantee.test.js` moved `computeMatchingValues` to `matchingValues.js`. Safe because the deleted shim was only a wrapper.
- `tests/trade/tradeUtilityMisc_surface.test.js` was rewritten to prove parity through `utils/index.js`, `tradeUtilityMisc.js`, and `tpeValidation.js` instead of the deleted `tradeUtilities.js` shim. Safe because it still protects the real public compatibility surface.
- `tests/validators/normalizeTradeInput.test.ts` now compares `normalizeTradeInput.ts` against the kept `validators/index.js` and `utils/index.js` entrypoints. Safe because it preserves compatibility coverage without using the deleted shim path.
- `tests/validators/roster.test.js` now imports the authoritative `validateRoster.ts` target directly while preserving validator-compatibility identity assertions. Safe because it still proves the kept compatibility entrypoint resolves to the same implementation.
- `tests/validators/validateInput.test.ts` now compares `validateInput.ts` against the kept `validators/index.js` and `utils/index.js` entrypoints. Safe because it preserves compatibility coverage without using the deleted shim path.
- `docs/architect/TRADE_MACHINE_MASTER.md` added the indexed E39 execution entry. Safe because it records the actual post-E39 state without changing runtime behavior.

## 3. Shim Retirement Work Completed
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js`
  - Outcome: fully retired.
  - Imports/re-exports changed: `tradeMachine/index.js`, `rules/index.js`, `validators/index.js`, and `tests/validators/roster.test.js` now point to `validateRoster.ts`.
  - Why correct: the deleted file was a pure re-export shim over `validateRoster.ts`, and the kept public entrypoints still expose `validateRoster` / `enforceRosterWindow`.
- `src/features/architect/utils/tradeMachine/rules/eligibilityRules.js`
  - Outcome: fully retired.
  - Imports/re-exports changed: `tradeValidator.ts` now imports `validateCash` from `validateCash.js` and `validateReacquisition` from `validateReacquisition.js`; `miscRules.ts` now imports `validateCash` from `validateCash.js`; `rules/index.js` now re-exports `validateCash`, `validateReacquisition`, and `enforceEligibility` directly; `validators/index.js` and `tests/trade/cashLedger_season_tracking.test.js` now use `validateCash.js` directly.
  - Why correct: the old shim only bundled already-stable direct modules, and the replacement preserved the exact pre-existing public surface without adding `validateEligibility` to `rules/index.js`.
- `src/features/architect/utils/tradeMachine/utils/validateInput.js`
  - Outcome: fully retired.
  - Imports/re-exports changed: `validators/index.js`, `utils/index.js`, `tests/validators/validateInput.test.ts`, and `tests/trade/input_validation.test.js` now point to `validateInput.ts`.
  - Why correct: the deleted file was a pure re-export shim over `validateInput.ts`, and the kept public entrypoints still expose `validateTradeInput`.
- `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
  - Outcome: fully retired.
  - Imports/re-exports changed: `validators/index.js`, `utils/index.js`, `tests/validators/normalizeTradeInput.test.ts`, and `tests/trade/input_validation.test.js` now point to `normalizeTradeInput.ts`; Phase 65/66 guardrails were updated to inspect `normalizeTradeInput.ts` directly.
  - Why correct: the deleted file was a pure re-export shim, and verification showed the guardrails only needed the authoritative implementation content, not the `.js` shim path itself.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
  - Outcome: fully retired.
  - Imports/re-exports changed: TPE consumers moved to `tpeValidation.js` (`tradeValidator.ts`, `mutationPipeline.js`, `basicRules.ts`, `tradeHelpers.js`, `seasonManager.tpe.test.js`); misc/protection consumers moved to `tradeUtilityMisc.js` (`stepienUtils.js`, `draftRules.ts`, `validateStepien.ts`, `conveyanceResolution.js`, `conveyancePreflight.test.js`, `tradeHelpers.js`, `tradeMachine/index.js`, `utils/index.js`); the shim-parity test was rewritten to prove parity via `utils/index.js`.
  - Why correct: E38 already verified exact symbol ownership between `tpeValidation.js` and `tradeUtilityMisc.js`, and all surviving public barrel behavior stayed stable.
- `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js`
  - Outcome: fully retired.
  - Imports/re-exports changed: `validators/index.js`, `tests/newSchemaValidation.test.js`, and `tests/trade/tradeKicker_zeroGuarantee.test.js` now point to `matchingValues.js`; `utils/index.js` now relies on `matchingValues.js` directly.
  - Why correct: the deleted file was a deprecated wrapper over `matchingValues.js`, and `matchingValues.js` remains the canonical implementation.

## 4. Public Entrypoint Preservation
- `src/features/architect/utils/tradeMachine/index.js`
  - Internal change: rewired `validateCash`, `validateRoster`, `isMeaningfulProtection`, and `normalizeProtectionValue` away from internal shims.
  - Stability preserved by keeping the same JS entrypoint path and export names while only changing the backing modules.
- `src/features/architect/utils/tradeMachine/validators/index.js`
  - Internal change: rewired `validateCash`, `validateRoster`, `computeMatchingValues`, `validateTradeInput`, and `normalizeTradeInput` to direct targets.
  - Stability preserved by keeping the same JS compatibility entrypoint path and export names; validator-surface identity tests now pass through the surviving barrel.
- `src/features/architect/utils/tradeMachine/rules/index.js`
  - Internal change: replaced `validateRoster.js` and `eligibilityRules.js` references with direct exports from `validateRoster.ts`, `validateCash.js`, `validateReacquisition.js`, and `validateEligibility.js`.
  - Stability preserved by keeping the same JS barrel path and explicitly avoiding any new `validateEligibility` export.
- `src/features/architect/utils/tradeMachine/utils/index.js`
  - Internal change: replaced `tradeUtilities.js`, `computeMatchingValues.js`, `validateInput.js`, and `normalizeTradeInput.js` references with direct exports from `tpeValidation.js`, `tradeUtilityMisc.js`, `matchingValues.js`, `validateInput.ts`, and `normalizeTradeInput.ts`.
  - Stability preserved by keeping the same JS barrel path and verifying representative helper exports through smoke and parity coverage.

## 5. Remaining Internal Shims After E39
- None.
- Remaining JS in the audited E38 slice is intentional and not an internal shim layer:
  - `src/features/architect/utils/tradeMachine/index.js`
  - `src/features/architect/utils/tradeMachine/validators/index.js`
  - `src/features/architect/utils/tradeMachine/rules/index.js`
  - `src/features/architect/utils/tradeMachine/utils/index.js`
  - `src/features/architect/utils/tradeMachine/constants/cbaConstants.js`
  - `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`

## 6. Validation Run
- Commands run:
  - `npm run typecheck`
    - Proved the TS/TSX import rewiring and shim deletions still typecheck cleanly.
    - Result: PASS.
  - `npm run validate:project`
    - Proved the repo structure still satisfies the project schema after deleting the six shim files.
    - Result: PASS.
  - `npm run test:node -- --reporter=dot tests/validators/roster.test.js tests/validators/validateInput.test.ts tests/validators/normalizeTradeInput.test.ts tests/trade/input_validation.test.js tests/trade/cashLedger_season_tracking.test.js tests/trade/tradeUtilityMisc_surface.test.js tests/trade/tradeKicker_zeroGuarantee.test.js tests/newSchemaValidation.test.js tests/smoke/imports.smoke.test.js src/tests/tradeMachine/conveyancePreflight.test.js src/tests/architect/utils/seasonManager.tpe.test.js src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js src/tests/architect/phase66_no_legacy_tradeExceptions_persisted_guardrails.test.js`
    - Proved the direct import-path cleanup did not break validator behavior, kept JS entrypoint/barrel behavior stayed intact, TPE/protection helper rewiring remained correct, and the Phase 65/66 guardrails still pass after removing `normalizeTradeInput.js`.
    - Result: PASS (`13` files, `143` tests).
- Non-failing command output observed during the targeted run:
  - `src/tests/architect/utils/seasonManager.tpe.test.js` still emits the existing expected invalid-date warning.
  - `tests/trade/cashLedger_season_tracking.test.js` still emits the existing validation breakdown log.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Why skipped:
  - The targeted node slice exercised every changed import path, kept JS barrel, direct target, and `normalizeTradeInput` guardrail path that E39 touched. There was no remaining uncertainty that required a broader suite.

## 7. Post-E39 Status
- The internal shim retirement goal is effectively complete for the audited E38 scope.
- No E38 internal shim files remain; the only remaining JS files in this slice are intentionally kept public entrypoints/barrels and the two non-target constants/message surfaces.
- The grouped cleanup succeeded as one pass. No follow-up pass is required unless the project later chooses to retire the kept public JS entrypoints themselves.

## 8. Master Doc Update
- Added `### Validator TS Internal Shim Retirement E39 (2026-03-10)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- The new entry states that:
  - the six internal shim files were retired in one grouped pass,
  - the internal shim layer is now effectively retired for the E38 scope,
  - the four JS public entrypoints remain intentionally in place, and
  - no immediate follow-up remains beyond any future repo-wide public-entrypoint cleanup.
