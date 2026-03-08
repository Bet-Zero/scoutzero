# TM_VALIDATOR_TS_ENGINE_E13 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative validator engine/orchestration surface into TypeScript via `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`.
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` is now a pure compatibility re-export shim only, with no remaining business logic.
- Authoritative behavior was preserved across canonical date setup, fail-fast entitlement/player routing exits, matching-values recompute order, per-team rule order, canonical result construction, `summaryByTeamIndex`, `tradeReceipt`, and preview/apply authoritative consumption.
- Immediate engine-adjacent JS holdouts remained narrow by design:
  - `src/features/architect/utils/tradeMachine/engine/validationUtils.js`
  - `src/features/architect/utils/tradeMachine/utils/validationIssueText.js`
  - `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js`
  - `src/features/architect/utils/tradeMachine/utils/salaryUtils.js`

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`
  - Added the authoritative TS-backed engine implementation by porting the live JS engine in place and preserving engine-local orchestration logic.
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Reduced to a pure compatibility re-export shim so existing `.js` imports continue working without duplicated logic.
- `src/features/architect/utils/tradeMachine/constants/types.ts`
  - Added the narrow shared validator-engine result/context types and corrected the `TradeTeam` input contract to allow precomputed `salaryOut` / `salaryIn` to be absent before engine recomputation.
- `tests/trade/validatorContractCleanup.test.js`
  - Added an explicit engine-output parity lock for `summaryByTeamIndex` and `tradeReceipt`.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E13 indexed migration entry and recorded the post-E13 state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_ENGINE_E13_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `ValidateTradeParams`
  - Canonical input contract for the authoritative engine entrypoint.
  - Applies to `validateTrade()` in `tradeValidator.ts`.
- `TradeValidatorContext`
  - Canonical engine context shape for resolved year/date/cap settings data.
  - Applies to top-level result construction, team rule execution, receipt generation, and finish helpers.
- `TradeRuleEnvelope`
  - Canonical normalized per-rule envelope shape.
  - Applies to `createRuleEnvelope()` and to the `teamResults[*].rules` map emitted by the engine.
- `TradeTeamResult`
  - Canonical per-team authoritative validator result row.
  - Applies to `teamResults` and downstream preview/apply consumers via `_rawValidation`.
- `TradeSummaryByTeamIndexRow`
  - Canonical summary row shape for team-facing trade summaries.
  - Applies to `summaryByTeamIndex`.
- `TradeReceipt`
  - Canonical debug receipt shape emitted by the authoritative engine.
  - Applies to `tradeReceipt` and existing receipt/debug consumers.
- `TradeValidationResult`
  - Canonical top-level authoritative validator result shape.
  - Applies to `validateTrade()` and `buildValidationResult()`.
- `TradeTeam.salaryOut` / `TradeTeam.salaryIn`
  - Hardened as optional authoritative input fields instead of required fields.
  - Applies to pre-validation input teams, which do not carry computed salaries until the engine recomputes them.

## 4. Migration Work Completed
- `tradeValidator.ts`
  - Ported the live authoritative engine into TypeScript while preserving:
    - canonical `currentYear` / `tradeDate` / `asOfDate` / `offseason` setup
    - fail-fast `ENTITLEMENT_ROUTING_ERROR`, `ENTITLEMENT_LINKAGE_ERROR`, and `PLAYER_ROUTING_ERROR` exits
    - `computeMatchingValues()` recompute before salary/legality evaluation
    - per-team rule insertion and aggregation order
    - canonical `reason`, `violations`, `warnings`, `summaryByTeamIndex`, `tradeReceipt`, and `dataWarnings` behavior
    - preview/apply compatibility through `_validatedTradeContext` / `_rawValidation`
  - Kept engine-local normalization, roster validation, rule-envelope shaping, receipt generation, and final result assembly inside the engine rather than broadening the slice into helper extraction.
- `tradeValidator.js`
  - Converted to a shim-only compatibility export.
  - No business logic remains in the JS file after E13.
- `types.ts`
  - Added the shared authoritative engine result/context types needed for the TS-backed engine surface.
  - Minimal contract correction required by typing:
    - `TradeTeam.salaryOut` and `TradeTeam.salaryIn` were changed from required to optional because authoritative engine inputs do not carry those computed values until after recompute. This matches the live engine behavior instead of changing it.
- `validatorContractCleanup.test.js`
  - Added an explicit parity lock proving `summaryByTeamIndex` and `tradeReceipt` remain structurally and semantically unchanged in authoritative engine output after the TS migration.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/engine/validationUtils.js`
  - Remains JS because E13 stopped at the authoritative engine surface and only needed its wrapper/caching behavior as-is.
- `src/features/architect/utils/tradeMachine/utils/validationIssueText.js`
  - Remains JS because the TS engine can consume canonical issue normalization/text shaping safely as-is; migrating it here would broaden the slice beyond the engine boundary.
- `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js`
  - Remains JS because the engine only consumes its resolved cap-settings output and migrating it here would broaden the slice into shared cap-settings provider migration.
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.js`
  - Remains JS because it is a compatibility wrapper around already-migrated typed matching-values logic and did not need to move for the authoritative engine to become TS-backed.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/tradeValidator.test.js tests/trade/orderOfOps_conversionsBeforeMatching.test.js tests/trade/validatorContractCleanup.test.js tests/trade/validatorTrustFixes.test.js src/tests/architect/tradeEntitlementRouting.test.ts src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts tests/capSettingsProvider.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new TS-backed authoritative engine compiles cleanly against the current rule/helper graph and public validator contracts.
  - `tests/tradeValidator.test.js` and `tests/trade/orderOfOps_conversionsBeforeMatching.test.js` prove matching-values recompute still happens before salary matching and other legality evaluation.
  - `tests/trade/validatorContractCleanup.test.js` proves canonical rule-envelope output, fail-fast top-level shape, validated-context compatibility, and the new `summaryByTeamIndex` / `tradeReceipt` parity lock.
  - `tests/trade/validatorTrustFixes.test.js` and `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts` prove preview/apply authoritative behavior, canonical date threading, and S&T / FA-exception / TPE / cash rule ownership remained unchanged.
  - `src/tests/architect/tradeEntitlementRouting.test.ts` proves entitlement-linkage fail-fast behavior remained unchanged.
  - `tests/capSettingsProvider.test.js` proves trade receipt cap-settings fields and receipt metadata remain unchanged.
- Results:
  - PASS.
  - `npm run test:node ...`: 7 files passed, 67 tests passed.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
  - Reason: E13 was a narrow authoritative engine migration, and the targeted node gate directly covered engine orchestration, output shape, receipt parity, and preview/apply authoritative behavior more precisely than broader suites.

## 7. Remaining TS Migration Queue
- Next best slice after E13 from the actual post-migration state:
  - `src/features/architect/utils/tradeMachine/utils/validationIssueText.js`
- Why this is the most likely next slice:
  - The authoritative engine is now TS-backed, but canonical issue normalization/text shaping still lives in this JS helper and is used directly by engine result construction, rule-envelope shaping, summary text, and top-level `reason` generation.
  - `validationUtils.js` and `salaryUtils.js` are narrower wrapper surfaces, and `capSettingsProvider.js` is a broader shared-provider migration. That makes `validationIssueText.js` the highest-signal remaining contract-adjacent holdout.
- Not hardcoded as mandatory:
  - The actual next slice should still be chosen from the remaining post-E13 holdouts if a smaller or more urgent immediate dependency becomes the better next step.

## 8. Master Doc Update
- Added `Validator TS Engine E13 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative validator engine now lives in `engine/tradeValidator.ts`.
- Recorded that `engine/tradeValidator.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that the canonical validator contract/result shape remained unchanged, including fail-fast routing exits, rule-envelope normalization, `summaryByTeamIndex`, `tradeReceipt`, and preview/apply validated-context consumption.
- Recorded that `validateFaExceptionUsage` remains an engine export only for public-surface parity and does not shift FA-exception rule ownership.
- Recorded that the next best TS slice should be chosen from the actual post-E13 state, with `utils/validationIssueText.js` identified as the most likely next target rather than a precommitted mandatory follow-on.
