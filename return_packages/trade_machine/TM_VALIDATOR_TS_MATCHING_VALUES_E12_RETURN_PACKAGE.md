# TM_VALIDATOR_TS_MATCHING_VALUES_E12 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative matching-values computation surface into TypeScript via `src/features/architect/utils/tradeMachine/utils/matchingValues.ts`.
- `src/features/architect/utils/tradeMachine/utils/matchingValues.js` is now a pure compatibility re-export shim only, with no remaining business logic.
- Authoritative behavior was preserved: BYC outgoing values, poison-pill incoming values, trade-kicker adjustments, guaranteed-money handling, S&T first-year salary precedence, in-place `matchIncoming` / `matchOutgoing` mutation, team warning attachment, and downstream salary-matching / hard-cap consumption remained unchanged.
- Immediate related JS holdouts stayed narrow by design:
  - `src/features/architect/utils/tradeMachine/utils/salaryUtils.js` and `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js` remain compatibility wrappers only.
  - `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`, `src/features/architect/utils/tradeMachine/utils/seasonUtils.js`, and `src/features/architect/utils/tradeMachine/utils/dataValidation.js` remained JS because E12 stopped at the authoritative matching-values boundary and did not broaden into normalization or helper-family migration.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/matchingValues.ts`
  - Added the authoritative TS implementation for matching-values computation and the deprecated helper export surface.
- `src/features/architect/utils/tradeMachine/utils/matchingValues.js`
  - Reduced to a pure compatibility re-export shim.
- `tests/tradeValidator.test.js`
  - Added a live-path BYC recompute-order assertion proving matching values are recomputed before salary-matching legality is evaluated.
- `tests/trade/input_validation.test.js`
  - Added a legacy-consumer assertion proving `normalizeTradeInput()` still uses the deprecated `getMatchingValue()` fallback contract unchanged.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E12 indexed migration entry.
- `return_packages/trade_machine/TM_VALIDATOR_TS_MATCHING_VALUES_E12_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `MatchingValuePlayer`
  - File-local player contract for the authoritative matching-values path, including BYC, poison-pill, trade-kicker, S&T, and mutation fields.
  - Applies across `getMatchingValue()`, `getEffectiveTradeSalaryForPlayer()`, and `computeMatchingValues()` in `matchingValues.ts`.
- `MatchingValueTeam`
  - File-local team contract carrying `sends` and `dataWarnings` for the canonical mutating computation pass.
  - Applies in `computeMatchingValues()` to the authoritative team iteration path.
- `EffectiveTradeSalaryResult`
  - Typed result for the authoritative salary-source resolution step.
  - Applies in `getEffectiveTradeSalaryForPlayer()` before BYC / poison-pill / kicker adjustments are applied.
- `ComputeMatchingValuesParams`
  - Typed input contract for the authoritative matching-values computation surface.
  - Applies to the exported `computeMatchingValues()` entry point.
- `ComputeMatchingValuesResult`
  - Typed return payload for aggregated data-warning outputs.
  - Applies to the value consumed by `tradeValidator.js` after recomputation.

## 4. Migration Work Completed
- `matchingValues.ts`
  - Ported the full authoritative implementation 1:1 from JS to TS.
  - Preserved all live behavior, including:
    - `getMatchingValue()` legacy poison-pill bug and BYC behavior for the legacy fallback path
    - S&T first-year salary precedence in `getEffectiveTradeSalaryForPlayer()`
    - BYC, poison-pill, trade-kicker, guaranteed-money, waiver, and BYC+poison-pill coexistence logic in `computeMatchingValues()`
    - in-place `player.matchOutgoing` / `player.matchIncoming` mutation
    - `team.dataWarnings` attachment and aggregate warning booleans
  - Typing stayed file-local; no broader validator contract migration was required.
- `matchingValues.js`
  - Converted to a pure shim so existing JS import paths continue working without touching the engine or wrapper surfaces.
- `tests/tradeValidator.test.js`
  - Added the explicit authoritative-path order lock:
    - a BYC player with raw salary that would have allowed the trade if salary matching ran on base salary
    - the validator instead uses recomputed `salaryOut = 10_000_000`, yields `allowableIncoming = 17_500_000`, and blocks an `18_000_000` incoming salary
  - This proves matching-value recomputation still happens before salary-matching legality and that downstream salary-matching behavior remains unchanged because of that preserved order.
- `tests/trade/input_validation.test.js`
  - Added the explicit deprecated-helper lock:
    - `normalizeTradeInput()` fallback salary resolution is asserted to equal `getMatchingValue()` output for a poison-pill player shape that triggers the legacy helper path
  - This proves the actual legacy consumer path remains behavior-identical after the TS migration.
- Minimal contract correction required by typing:
  - None. File-local TS types were sufficient; no shared validator contract had to change.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.js`
  - Remains JS because it is a compatibility wrapper and did not need to move for the authoritative matching-values path to become TS-backed safely.
- `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js`
  - Remains JS because it is a deprecated compatibility re-export surface only.
- `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`
  - Remains JS because it is the legacy consumer path for deprecated `getMatchingValue()` and sits outside the authoritative validator computation boundary migrated in E12.
- `src/features/architect/utils/tradeMachine/utils/seasonUtils.js`
  - Remains JS because the typed matching-values module can consume it safely as-is; migrating it here would broaden the slice into shared season helper migration.
- `src/features/architect/utils/tradeMachine/utils/dataValidation.js`
  - Remains JS because warning-shape generation was already interoperable from TS and migrating it here would broaden the slice into the data-validation helper family.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot src/tests/trade/goldenTrades.test.js src/tests/architect/legacyMatchingValue.test.js src/tests/architect/dataValidation.test.js tests/trade/byc_outgoing_max.test.js tests/trade/poisonPill_average.test.js tests/trade/tradeKicker_proration.test.js tests/trade/tradeKicker_zeroGuarantee.test.js tests/newSchemaValidation.test.js src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts tests/trade/validatorTrustFixes.test.js tests/tradeValidator.test.js tests/trade/input_validation.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new authoritative TS module interops cleanly with the remaining JS engine/wrapper surfaces and existing test consumers.
  - `src/tests/trade/goldenTrades.test.js`, `tests/trade/byc_outgoing_max.test.js`, `tests/trade/poisonPill_average.test.js`, `tests/trade/tradeKicker_proration.test.js`, and `tests/trade/tradeKicker_zeroGuarantee.test.js` are helper-level evidence for canonical BYC / poison-pill / trade-kicker / guaranteed-money behavior.
  - `src/tests/architect/dataValidation.test.js` is helper-level evidence for warning collection, warning attachment, and BYC fallback behavior.
  - `src/tests/architect/legacyMatchingValue.test.js` is helper-level evidence that the deprecated helper contract itself remained unchanged, including its intentionally non-canonical poison-pill formula.
  - `tests/trade/input_validation.test.js` is helper-/legacy-consumer-path evidence that `normalizeTradeInput()` still consumes deprecated `getMatchingValue()` identically.
  - `tests/newSchemaValidation.test.js` proves current guaranteed-money / first-year-salary extraction behavior for the live matching-values path still works with new-schema contract rows.
  - `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`, `tests/trade/validatorTrustFixes.test.js`, and `tests/tradeValidator.test.js` are authoritative live-path evidence that recomputed matching values still feed downstream `salaryOut` / `salaryIn`, salary-matching legality, and S&T first-year salary behavior unchanged.
- Results:
  - PASS.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
  - Reason: E12 was a narrow authoritative utility migration, and the targeted node gate directly covered the migrated matching-values boundary, the deprecated legacy-consumer fallback path, and the downstream validator legality path more precisely than broader suites.

## 7. Remaining TS Migration Queue
- Next best slice after E12: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
- Why this is the next best slice from the actual post-E12 state:
  - `matchingValues.ts`, `validateSalaryMatching.ts`, and `hardCapValidation.ts` now hold the typed authoritative compute/rule surfaces.
  - `matchingValues.js`, `computeMatchingValues.js`, and `salaryUtils.js` are now compatibility-only JS layers around those typed surfaces.
  - That leaves `tradeValidator.js` as the remaining authoritative live JS orchestration boundary that recomputes matching values, constructs `salaryOut` / `salaryIn`, and routes the typed rule outputs.
- Secondary follow-on after the engine, if the migration goal shifts to legacy consumer cleanup instead of validator orchestration:
  - `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`

## 8. Master Doc Update
- Added `Validator TS Matching Values E12 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the active authoritative matching-values logic now lives in `utils/matchingValues.ts`.
- Recorded that `utils/matchingValues.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that downstream salary-matching / hard-cap consumption remains unchanged because `tradeValidator.js` still recomputes `matchIncoming` / `matchOutgoing` before constructing `salaryOut` / `salaryIn`.
- Recorded that legacy normalize-input fallback behavior remains unchanged through `normalizeTradeInput.js` consuming deprecated `getMatchingValue()`.
- Recorded that, from the actual post-E12 state, the next best migration slice is `engine/tradeValidator.js`.
