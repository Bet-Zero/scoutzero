# TM_VALIDATOR_TS_VALIDATION_UTILS_E15 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative engine-adjacent validation-utils helper surface into TypeScript via `src/features/architect/utils/tradeMachine/engine/validationUtils.ts`.
- Preserved existing wrapped-validator caching, monitoring, debug, tracked-validator, and template-helper behavior used by the authoritative validator engine and related consumers.
- `src/features/architect/utils/tradeMachine/engine/validationUtils.js` now contains no business logic and is a pure compatibility re-export shim only.
- Several directly related dependencies remained JS by design in this pass so the migration stayed narrow: monitor/cache/debug dependencies were consumed safely from TS without changing their contracts.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/engine/validationUtils.ts`
  - Added the authoritative TS-backed implementation for the validation-utils helper surface.
- `src/features/architect/utils/tradeMachine/engine/validationUtils.js`
  - Reduced to a pure compatibility re-export shim so existing `.js` imports remain stable and no business logic remains in JS.
- `src/tests/tradeMachine/validationUtils.contract.test.ts`
  - Added direct helper-only contract coverage for wrapped-validator caching, tracked-validator behavior, debug logging, error handling, and template-rule output.
- `tests/trade/validation_caching.test.js`
  - Added an engine-facing parity regression proving repeated authoritative `validateTrade()` calls preserve cache-observable behavior and stable `dataWarnings` / `hasDataIssues` shaping.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E15 indexed migration entry and recorded the post-E15 state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATION_UTILS_E15_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `WrappedValidatorMap`
  - Preserves the per-validator argument and return types after common caching/monitoring wrapping.
  - Applies to `wrapCommonValidators()` in the authoritative validation-utils path.
- `TrackedValidatorCacheConfig`
  - Narrows the optional cache read/write contract used by tracked validators.
  - Applies to `createTrackedValidator()` in the authoritative validation-utils path.
- `ValidatorDebugState` / `ValidatorDebugLogEntry`
  - Represents the compatibility debug surface and stored validator debug records.
  - Applies to the authoritative `validatorDebug` export that remains consumed through `validationUtils`.
- `TemplateRuleResult`
  - Represents the baseline template-helper result shape with `passed`, `violations`, and `message`.
  - Applies to `validateTemplateRule()` in the authoritative validation-utils path.

## 4. Migration Work Completed
- `validationUtils.ts`
  - Ported the live helper into TypeScript while preserving:
    - wrapped-validator cache key generation via ``${name}-${JSON.stringify(args)}`
    - cache lookup/write behavior through `validationCacheService`
    - performance monitor start/end behavior on success, cache hit, and error paths
    - debug logging/error behavior
    - truthy object-like cacheability semantics
    - tracked-validator cache short-circuit and write-through semantics
    - `validatorDebug` log storage and fallback team-name behavior
    - `validateTemplateRule()` baseline result shape
- `validationUtils.js`
  - Converted to a shim-only compatibility export.
  - No business logic remains in the JS file after E15.
- `validationUtils.contract.test.ts`
  - Added direct helper-only regression coverage for the migrated surface.
- `validation_caching.test.js`
  - Added authoritative engine-facing parity coverage proving repeated `validateTrade()` runs still expose cache hits through wrapped validators and preserve stable `dataWarnings` / `hasDataIssues` shaping.
- Minimal contract correction required by typing:
  - None. The helper surface was typed locally without changing canonical validator result or issue contracts.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/engine/validationPerformanceMonitor.js`
  - Remained JS because E15 only migrated the validation-utils helper surface; the TS helper can consume the monitor API safely without broadening into monitor migration.
- `src/features/architect/utils/tradeMachine/cache/validationCacheService.js`
  - Remained JS because E15 preserved the live cache service contract and semantics exactly; migrating it here would broaden into cache-service migration.
- `src/features/architect/utils/tradeMachine/engine/engineUtils.js`
  - Remained JS because E15 only consumes its existing debug interface and did not require debug-helper migration.
- `src/features/architect/utils/tradeMachine/engine/tradeDebug.js`
  - Remained JS because `validatorDebug` compatibility behavior was preserved by consuming the existing debug logger as-is rather than broadening into debug-surface migration.
- `src/features/architect/utils/tradeMachine/engine/validatorFactory.js`
  - Remained JS because it only consumes the stable `.js` helper import surface; migrating it would broaden this pass from helper migration into consumer migration.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot src/tests/tradeMachine/validationUtils.contract.test.ts tests/trade/validation_caching.test.js tests/trade/validatorContractCleanup.test.js src/tests/tradeMachine/validationIssueText.contract.test.ts src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts src/tests/architect/tradeApply_timingWarnings.behavior.test.ts src/tests/architect/dataValidation.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new TS-backed validation-utils helper compiles cleanly against the current engine/cache/debug dependency graph while preserving `.js` import compatibility.
  - `src/tests/tradeMachine/validationUtils.contract.test.ts` is helper-only coverage proving wrapped-validator cache behavior, no-cache primitive behavior, tracked-validator behavior, debug logging, error-path monitoring cleanup, and template-rule output.
  - `tests/trade/validation_caching.test.js` proves authoritative `validateTrade()` still exposes helper-observable cache hits across repeated identical validations and preserves top-level `dataWarnings` / `hasDataIssues` behavior.
  - `tests/trade/validatorContractCleanup.test.js`, `src/tests/tradeMachine/validationIssueText.contract.test.ts`, `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`, `src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts`, `src/tests/architect/tradeApply_timingWarnings.behavior.test.ts`, and `src/tests/architect/dataValidation.test.js` prove canonical result shaping, issue text handling, fail-closed rule behavior, warning propagation, apply-time warning consumption, and data-warning generation remain intact around the migrated helper.
- Results:
  - PASS.
  - `npm run test:node ...`: 8 files passed, 54 tests passed.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - `npm run test:ui -- --reporter=dot`
  - full-suite commands
- Reason:
  - E15 was a narrow helper migration. The targeted helper, engine, warning, and cache regressions provided more direct proof of behavior preservation for this slice than broader suites.

## 7. Remaining TS Migration Queue
- The next slice was chosen only after inspecting the actual post-E15 state.
- Most likely next candidate:
  - `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js`
- Why it is the most likely next slice now:
  - It still directly shapes cap-settings resolution, cap-settings warnings, and receipt metadata consumed by the TS-backed authoritative engine.
  - By contrast, `src/features/architect/utils/tradeMachine/utils/salaryUtils.js` is now primarily a narrower compatibility wrapper over more canonical helpers, so it is a lower-priority immediate slice.

## 8. Master Doc Update
- Added `Validator TS Validation Utils E15 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the engine-adjacent `validationUtils` helper surface now lives in `engine/validationUtils.ts`.
- Recorded that `engine/validationUtils.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator result/issue semantics remained unchanged, including wrapped-validator behavior and authoritative `dataWarnings` / `hasDataIssues` shaping.
- Recorded that the next best migration slice was selected from the actual post-E15 state, with `utils/capSettingsProvider.js` named as the most likely next candidate.
