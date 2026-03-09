# TM_VALIDATOR_TS_CAP_UTILS_E23 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative `capUtils` helper surface from `src/features/architect/utils/tradeMachine/utils/capUtils.js` to `src/features/architect/utils/tradeMachine/utils/capUtils.ts`.
- Behavior was preserved: apron threshold semantics, apron-status return values, normalization fallbacks, wrapper extraction order, payroll resolution order, and the `toSeasonKey` re-export surface remained unchanged.
- `src/features/architect/utils/tradeMachine/utils/capUtils.js` remains JS only as a pure compatibility re-export shim so existing `.js` imports stay stable.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/capUtils.ts`
  - Added the authoritative TS implementation for the live `capUtils` helper surface.
- `src/features/architect/utils/tradeMachine/utils/capUtils.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `tests/capUtils.test.js`
  - Expanded direct helper coverage to lock first-apron, second-apron, and apron-status branch behavior in addition to the existing numeric/normalization helpers.
- `tests/trade/secondApronBoundary.test.js`
  - Added explicit authoritative `validateTrade()` assertions proving unchanged `capUtils`-driven second-apron boundary behavior in team-level salary-matching rule blocking.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E23 migration entry and recorded the post-E23 helper state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_CAP_UTILS_E23_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `NumericLike`
  - Represents the existing number-or-string inputs that `capUtils` already accepts and coerces implicitly.
  - Applies across cap-setting, salary, and payroll fields in the authoritative `capUtils.ts` path.
- `CapUtilsCapSettingsLike`
  - Represents the raw cap-settings shape accepted by `normalizeCaps()` and the apron helpers, including legacy alias keys.
  - Applies to `isFirstApronTeam()`, `isSecondApronTeam()`, `getTeamApronStatus()`, and `normalizeCaps()`.
- `CapUtilsTeamData`
  - Represents the minimal team/payroll shape read by the helper surface.
  - Applies to apron classification and payroll resolution in `capUtils.ts`.
- `CapUtilsTeamWrapper`
  - Represents wrapper inputs using `team`, `sourceTeam`, or `ctx`.
  - Applies to `getTeamObject()` and wrapped-team handling inside `isSecondApronTeam()`.
- `NormalizedCapSettings`
  - Represents the normalized numeric return shape produced by `normalizeCaps()`.
  - Applies to the authoritative normalized cap-settings helper surface without widening broader validator contracts.

## 4. Migration Work Completed
- `capUtils.ts`
  - Ported the live helper logic 1:1 from JS to TS with narrow local types only.
  - Preserved:
    - `isFirstApronTeam()` using `>=` and the existing `firstApron || apron || 0` fallback chain
    - `isSecondApronTeam()` using strict `>` and the existing `getTeamObject()` wrapper extraction
    - `getTeamApronStatus()` returning `SECOND_APRON`, `FIRST_APRON`, `OVER_CAP`, or `UNDER_CAP` with the current threshold order
    - `toNum()` coercion behavior
    - `normalizeCaps()` alias lookup and zero-default behavior
    - `getTeamObject()` return behavior, including returning `{}` for `{}` input
    - `resolvePayroll()` candidate priority and positive-value selection behavior
    - `toSeasonKey` re-export behavior from `@/features/architect/utils/seasonFormat.js`
- `capUtils.js`
  - Converted to a shim-only compatibility export.
  - Hard rule satisfied: no business logic remains in the JS file after E23.
- Test parity
  - Expanded `tests/capUtils.test.js` to cover the full exported helper surface.
  - Strengthened `tests/trade/secondApronBoundary.test.js` so the authoritative `validateTrade()` path explicitly proves unchanged second-apron salary-matching gating at the exact boundary and above it.
- Minimal contract correction required by typing:
  - None. File-local helper types were sufficient and no runtime contract or apron-policy behavior had to change.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/utils/capUtils.js`
  - Remains JS only as the required compatibility shim for stable `.js` imports; it now contains no business logic.
- `src/features/architect/utils/seasonFormat.js`
  - Remained JS because E23 only re-exports `toSeasonKey` from it; migrating that separate season helper would broaden this slice unnecessarily.
- `src/features/architect/utils/tradeMachine/utils/salaryMargin.js`
  - Remained JS because it is a separate live helper family that consumes `capUtils` through the stable shim path and should be migrated in its own narrow slice.
- `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
  - Remained JS because it safely consumes the TS-backed `capUtils` surface through the shim and was not required to complete E23.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/capUtils.test.js tests/salaryMargin.test.js tests/tradeValidatorEdgeCases.test.js tests/trade/secondApronBoundary.test.js src/tests/trade/secondApron_SSOT_guardrail.test.js src/tests/architect/phase42_apron_derivation_consolidation.test.js tests/smoke/imports.smoke.test.js tests/smoke/utilities.smoke.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the new TS-backed `capUtils` helper compiles cleanly against the existing JS/TS consumer graph while preserving `.js` import-path compatibility.
  - `tests/capUtils.test.js`
    - Helper-only coverage proving unchanged direct helper behavior for apron thresholds, apron-status branches, numeric coercion, cap normalization, wrapper extraction, and payroll resolution.
  - `tests/salaryMargin.test.js`
    - Helper-only coverage proving transitive consumers of `toNum()`, `getTeamObject()`, `resolvePayroll()`, and `isSecondApronTeam()` still behave unchanged.
  - `tests/tradeValidatorEdgeCases.test.js`
    - Proves the authoritative `validateTrade()` path still surfaces unchanged team-level second-apron blocker behavior in live validator rule results.
  - `tests/trade/secondApronBoundary.test.js`
    - Proves the authoritative `validateTrade()` path still sees unchanged `capUtils`-driven apron status at the exact second-apron boundary and above it, including team-level salary-matching blocking only once the strict `>` threshold is crossed.
  - `src/tests/trade/secondApron_SSOT_guardrail.test.js`
    - Preserves the existing strict `>` second-apron SSOT guardrail for direct helper and validator-adjacent rule usage.
  - `src/tests/architect/phase42_apron_derivation_consolidation.test.js`
    - Proves the Architect-facing facade and related consolidated consumers still align with the migrated SSOT helper behavior.
  - `tests/smoke/imports.smoke.test.js`
    - Proves the `.js` import surface remains loadable after the shim conversion.
  - `tests/smoke/utilities.smoke.test.js`
    - Proves core utility access through the `.js` path remains intact.
  - `npm run validate:project`
    - Proves the final file layout still satisfies repo structural validation.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot ...`: PASS (8 files, 67 tests)
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason:
  - E23 was a narrow validator-helper migration. The targeted helper, transitive-helper, smoke, and authoritative validator-path tests provided direct proof of behavior preservation without broadening into unrelated suites.

## 7. Remaining TS Migration Queue
- Based on the actual post-E23 state, `src/features/architect/utils/tradeMachine/utils/salaryMargin.js` is the next best likely TS slice.
- Why it is the best likely next step:
  - it remains live shared JS helper logic
  - it builds directly on the newly TS-backed `capUtils` surface
  - it still owns authoritative incoming-margin / incoming-ceiling behavior exercised by existing helper tests
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the post-E23 dependency graph or risk profile makes it the better next slice.

## 8. Master Doc Update
- Added `Validator TS Cap Utils E23 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `capUtils` surface now lives in `utils/capUtils.ts`.
- Recorded that `utils/capUtils.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent `capUtils` semantics remained unchanged.
- Recorded that targeted parity now includes expanded direct helper coverage plus an authoritative `validateTrade()` boundary assertion proving unchanged second-apron salary-matching blocking behavior.
- Recorded that `utils/salaryMargin.js` is the best likely next TS slice based on the actual post-E23 holdouts.
