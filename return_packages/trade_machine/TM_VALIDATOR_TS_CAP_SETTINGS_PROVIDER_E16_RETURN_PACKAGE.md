# TM_VALIDATOR_TS_CAP_SETTINGS_PROVIDER_E16 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical cap-settings-provider surface into TypeScript via `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.ts`.
- Preserved authoritative behavior for cap-settings resolution, warning text, source labels, top-level validator metadata, and receipt metadata.
- `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js` now contains no business logic and is a pure compatibility re-export shim only.
- Directly related data/consumer files remained JS by design where the TS-backed provider could consume them safely without broadening the slice.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.ts`
  - Added the authoritative TS-backed cap-settings-provider implementation.
- `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js`
  - Reduced to a pure compatibility re-export shim so existing `.js` imports remain stable and no business logic remains in JS.
- `tests/trade/validatorContractCleanup.test.js`
  - Added an explicit engine-facing parity assertion proving top-level `validateTrade()` cap-settings metadata remains unchanged.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E16 indexed migration entry and recorded the post-E16 state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_SETTINGS_PROVIDER_E16_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `CapYearInput`
  - Represents accepted public year input for the provider, including nullish invalid-input cases that must preserve current fallback and strict-mode behavior.
  - Applies to `yearToSeasonKey()`, `getCapSettings()`, `getCapSettingsForYear()`, and `getCapSettingsForReceipt()`.
- `NormalizedCapSettings`
  - Represents the normalized cap-settings object emitted by the authoritative provider.
  - Applies to provider resolution output, year-wrapper output, and receipt shaping in the authoritative cap-settings-provider path.
- `CapSettingsResolutionResult`
  - Represents the resolved provider result with `settings`, `source`, `warnings`, `resolved`, `year`, and `seasonKey`.
  - Applies to `getCapSettings()` and the live engine consumption path.
- `CapSettingsWithMeta`
  - Represents the convenience wrapper output with `_meta`.
  - Applies to `getCapSettingsForYear()` and existing UI/facade consumers.
- `CapSettingsReceiptResult`
  - Represents the receipt-facing cap settings metadata bundle.
  - Applies to `getCapSettingsForReceipt()` and receipt/result shaping.

## 4. Migration Work Completed
- `capSettingsProvider.ts`
  - Ported the live provider into TypeScript while preserving:
    - provided-settings priority
    - explicit cap projections lookup
    - default cap projections fallback
    - previous-year projection fallback
    - emergency 2024-25 fallback
    - invalid-input and strict-mode behavior
    - source-label strings and warning text
    - `getCapSettingsForYear(...)._meta`
    - receipt metadata shaping
- `capSettingsProvider.js`
  - Converted to a shim-only compatibility export.
  - No business logic remains in the JS file after E16.
- `validatorContractCleanup.test.js`
  - Added an explicit parity lock proving authoritative `validateTrade()` still emits unchanged top-level `capSettings`, `capSettingsSource`, and `capSettingsWarnings` metadata after the provider became TS-backed.
- Minimal contract correction required by typing:
  - None at the runtime contract level.
  - Typing was kept provider-local while preserving the existing engine import surface and provider output semantics.

## 5. JS Holdouts
- `src/features/architect/utils/capProjections.js`
  - Remained JS because E16 only migrated the provider logic surface; this static projection data module is consumed safely by the TS-backed provider and migrating it here would broaden the slice into data-module conversion.
- `src/features/architect/utils/seasonManager.js`
  - Remained JS because it is a consumer of the provider, not part of the provider surface itself; migrating it here would broaden the pass into consumer migration.
- `src/features/architect/utils/mutationPipeline.js`
  - Remained JS because it only consumes the stable provider result shape for post-state rules context and did not need migration for the provider to become TS-backed.
- JS/JSX UI consumers such as `src/features/architect/tradeMachine/TradeTeamCard.jsx`, `src/features/architect/capSheet/ExceptionTracker/ExceptionTracker.jsx`, and `src/features/architect/capSheet/modals/ManageExceptionsModal.jsx`
  - Remained JS/JSX by design because E16 was limited to the canonical provider surface and preserved import-path compatibility instead of broadening into UI migration.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/capSettingsProvider.test.js tests/trade/validatorContractCleanup.test.js src/tests/trade/worldless_season_mapping.guardrail.test.js src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts tests/computeTeamCapTotals.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the TS-backed provider compiles cleanly against the existing engine and consumer graph while preserving the stable `.js` import surface.
  - `tests/capSettingsProvider.test.js` proves direct provider resolution behavior, warning behavior, strict-mode behavior, and receipt helper shaping remain unchanged.
  - `tests/trade/validatorContractCleanup.test.js` proves authoritative `validateTrade()` output still preserves `summaryByTeamIndex`, `tradeReceipt`, and the explicit top-level `capSettings` / `capSettingsSource` / `capSettingsWarnings` metadata contract.
  - `src/tests/trade/worldless_season_mapping.guardrail.test.js` proves `yearToSeasonKey()` and `getCapSettingsForYear()` season mapping behavior remains unchanged.
  - `src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts` proves the `.js` import surface remains mockable and compatible for existing JS consumers.
  - `tests/computeTeamCapTotals.test.js` proves extensionless consumer compatibility remains intact for provider-backed cap totals flows.
- Results:
  - PASS.
  - `npm run test:node ...`: 5 files passed, 55 tests passed.
  - `npm run validate:project`: PASS.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - `npm run test:ui -- --reporter=dot`
  - full-suite commands
- Reason:
  - E16 was a narrow provider migration. The targeted provider, engine-metadata, season-mapping, mock-compatibility, and project-structure gates provided more direct proof of behavior preservation for this slice than broader suites.

## 7. Remaining TS Migration Queue
- The next best slice was chosen only after inspecting the actual post-E16 state.
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.js` is a likely next candidate because it remains a narrow JS compatibility wrapper directly adjacent to already-typed matching-values and salary-matching surfaces.
- This is not hardcoded as mandatory:
  - another remaining holdout should be chosen instead if the actual post-E16 dependency graph makes it the better next step.

## 8. Master Doc Update
- Added `Validator TS Cap Settings Provider E16 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the canonical cap-settings-provider surface now lives in `utils/capSettingsProvider.ts`.
- Recorded that `utils/capSettingsProvider.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator cap-settings and result-metadata semantics remained unchanged, including top-level `capSettings` / `capSettingsSource` / `capSettingsWarnings` and receipt cap-settings metadata.
- Recorded that the next best TS slice should be chosen from the actual post-E16 state, with `utils/salaryUtils.js` noted as a likely but not mandatory candidate.
