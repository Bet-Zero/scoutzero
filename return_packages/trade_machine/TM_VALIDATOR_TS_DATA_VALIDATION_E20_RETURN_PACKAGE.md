# TM_VALIDATOR_TS_DATA_VALIDATION_E20 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical `dataValidation` helper surface into TypeScript via `src/features/architect/utils/tradeMachine/utils/dataValidation.ts`.
- Behavior was preserved: warning codes, warning text, severity values, timestamps, null guards, salary-field validation behavior, summary counts, and validator-adjacent `dataWarnings` / `hasDataIssues` behavior remained unchanged.
- No immediate helper dependency had to remain JS as a blocker for the authoritative `dataValidation` surface itself.
- `src/features/architect/utils/tradeMachine/utils/dataValidation.js` now contains no business logic and is a pure compatibility re-export shim only.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/dataValidation.ts`
  - Added the authoritative TS implementation for the `dataValidation` helper surface.
- `src/features/architect/utils/tradeMachine/utils/dataValidation.js`
  - Reduced to a pure compatibility re-export shim so existing `.js` import paths remain stable with no business logic left in JS.
- `src/features/architect/utils/tradeMachine/utils/matchingValues.ts`
  - Switched the local warning typing to consume the shared `DataWarning` type from the TS-backed `dataValidation` surface while preserving runtime behavior.
- `tests/trade/validation_caching.test.js`
  - Strengthened the authoritative validator-facing parity assertion so `validateTrade()` top-level `dataWarnings` and `hasDataIssues` behavior remains explicitly locked after the migration.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E20 migration entry and recorded the post-E20 state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_DATA_VALIDATION_E20_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `DataWarningSeverity`
  - Represents the canonical runtime severity values emitted by `dataValidation`.
  - Applies across warning creation, helper return values, and UI/validator-adjacent warning consumers importing from the authoritative helper surface.
- `DataWarningCode`
  - Represents the canonical data-warning codes emitted by `dataValidation`.
  - Applies across BYC and salary-field warning generation and the matching-values aggregate warning checks.
- `DataWarning`
  - Represents the authoritative warning payload shape, including `code`, `message`, `severity`, `details`, and `timestamp`.
  - Applies to `createDataWarning()`, `validateBYCPlayerData()`, `validateSalaryFieldData()`, `validateTradeData()`, and `matchingValues.ts` warning aggregation.
- `TradeDataValidationSummary`
  - Represents the summary counters returned by `validateTradeData()`.
  - Applies to the authoritative aggregate helper surface still consumed by `useTradeMachine.js`.
- `TradeDataValidationResult`
  - Represents the authoritative `validateTradeData()` result shape, including the preserved non-array early-return shape and the full warning-state shape for array input.
  - Applies at the top-level helper boundary without widening broader validator result contracts.
- `DataValidationPlayer`
  - Represents the minimal player shape read by the authoritative helper logic.
  - Applies across BYC validation, salary-field validation, and aggregate trade-data validation.
- `SalaryFieldValidationOptions`
  - Represents the narrow salary-source options consumed by salary-field validation.
  - Applies to the typed matching-values path when fallback salary sources are tracked.

## 4. Migration Work Completed
- `dataValidation.ts`
  - Ported the authoritative helper logic 1:1 from JS to TS.
  - Preserved:
    - `createDataWarning()` timestamp creation through `Date.now()`
    - exact BYC warning text, payload fields, and missing-`previousSalary` criteria
    - exact salary-field fallback/missing warning branching and payload fields
    - `validateTradeData()` summary counting and its preserved behavior of calling `validateSalaryFieldData(player, yearKey)` without adding salary-source inference
    - `formatDataWarning()` output semantics
  - Kept typing file-local and narrow; no broader validator/result redesign was introduced.
- `dataValidation.js`
  - Converted to a pure shim-only compatibility export.
  - No business logic remains in the JS file after E20.
- `matchingValues.ts`
  - Removed duplicate local warning typing in favor of the shared `DataWarning` type exported by the authoritative TS helper.
  - Preserved warning collection, team attachment, and aggregate BYC/salary warning booleans unchanged.
- `tests/trade/validation_caching.test.js`
  - Preserved the existing validator-facing parity lock and made it more explicit by asserting top-level `dataWarnings` length and `hasDataIssues` values on repeated authoritative `validateTrade()` calls.
- Minimal contract correction required by typing:
  - None. File-local helper types and a narrow `matchingValues.ts` type import were sufficient.

## 5. JS Holdouts
- `src/features/architect/hooks/useTradeMachine.js`
  - Remained JS because E20 was limited to the authoritative `dataValidation` helper surface; migrating the Trade Machine hook would broaden into UI consumer migration, which is explicitly out of scope.
- `src/features/architect/tradeMachine/DataWarningsSection.jsx`
  - Remained JSX because E20 preserved the existing UI consumer contract and did not broaden into UI migration.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot src/tests/architect/dataValidation.test.js tests/trade/validation_caching.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new TS-backed `dataValidation` surface interops cleanly with the existing JS/TS consumer graph, including `.js` shim-path imports.
  - `src/tests/architect/dataValidation.test.js` is helper-level coverage proving direct `dataValidation` behavior remains unchanged for BYC warnings, salary-field warnings, combined summary behavior, warning formatting, matching-values warning collection, and `.js` import-path compatibility.
  - `tests/trade/validation_caching.test.js` is authoritative validator-facing coverage proving `validateTrade()` still emits unchanged top-level `dataWarnings` and `hasDataIssues` behavior across repeated validations, including preserved warning payload shape and cache-observable parity.
  - `npm run validate:project` proves the new TS file and shim layout remain valid for the repo’s structural/project rules.
- Results:
  - PASS.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason:
  - E20 was a narrow helper/module-boundary migration. `typecheck`, targeted helper coverage, the validator-facing parity test, and `validate:project` provided the required proof of behavior preservation more directly than broader suites. `build` was not run because this slice did not touch a build-sensitive UI/route boundary and repo policy does not require `build` for this utility-only change.

## 7. Remaining TS Migration Queue
- Based on the actual post-E20 holdouts, `src/features/architect/utils/tradeMachine/rules/basicRules.js` is a likely next TS slice.
- Why:
  - it remains live JS business logic in the authoritative validator path
  - it is consumed directly by the TS engine via `enforceSecondApronHandcuffs`
  - it is also consumed by TS-backed `miscRules.ts`
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the post-E20 dependency/risk review makes it the better next slice

## 8. Master Doc Update
- Added `Validator TS Data Validation E20 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `dataValidation` surface now lives in `utils/dataValidation.ts`.
- Recorded that `utils/dataValidation.js` is now a pure compatibility re-export shim with no business logic.
- Recorded that validator-adjacent data-warning semantics remained unchanged.
- Recorded that targeted parity still includes an authoritative `validateTrade()` assertion for top-level `dataWarnings` and `hasDataIssues`.
- Recorded that `rules/basicRules.js` is a likely next TS slice based on the actual post-E20 holdouts.
