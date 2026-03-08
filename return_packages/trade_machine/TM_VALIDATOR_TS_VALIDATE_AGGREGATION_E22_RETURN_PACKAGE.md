# TM_VALIDATOR_TS_VALIDATE_AGGREGATION_E22 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical `validateAggregation` rule surface into TypeScript via `src/features/architect/utils/tradeMachine/rules/validateAggregation.ts`.
- Behavior was preserved: second-apron gating, `outgoingPlayers` to `sends` fallback behavior, higher-paid-player aggregation blocking, multi-club incoming blocking, exact violation ordering, exact message text, exact details/calculation payload behavior, and current omission of salary-mismatch enforcement remained unchanged.
- `src/features/architect/utils/tradeMachine/rules/validateAggregation.js` now contains no remaining business logic and is a pure compatibility re-export shim only.
- Direct dependencies remained JS only where they were not blockers for the authoritative `validateAggregation` surface and migrating them would have widened E22 beyond the requested slice.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/validateAggregation.ts`
  - Added the authoritative TS implementation for the live `validateAggregation` rule surface.
- `src/features/architect/utils/tradeMachine/rules/validateAggregation.js`
  - Reduced to a pure compatibility re-export shim so existing `.js` imports remain stable with no business logic left in JS.
- `tests/trade/validateAggregation.test.ts`
  - Added direct helper-surface coverage for the exact early-return object, `sends` fallback behavior, sorted calculation payloads, exact violation ordering, and `.js` shim-path compatibility.
- `tests/tradeValidatorEdgeCases.test.js`
  - Added an authoritative `validateTrade()` assertion proving unchanged team-level `rules.aggregation` blocker semantics and top-level legality blocking in a second-apron aggregation case.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E22 migration entry and updated the authoritative second-apron aggregation implementation reference to the TS-backed surface.
- `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATE_AGGREGATION_E22_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `AggregationPlayer`
  - Represents the minimal player shape read by `validateAggregation`, including `salary` and `fromTeamId`.
  - Applies to outgoing/incoming player arrays inside the authoritative `validateAggregation.ts` path.
- `AggregationTeam`
  - Represents the narrow team-slot shape consumed by the rule, including second-apron status, outgoing/incoming player arrays, salary totals, and optional nested team/context data.
  - Applies to the authoritative `validateAggregation()` entrypoint.
- `AggregationContext`
  - Represents the minimal context surface used by the rule, including `yearKey` and `capSettings`.
  - Applies to context resolution in the authoritative `validateAggregation.ts` path.
- `AggregationValidationResult`
  - Represents the direct rule return shape, including exact string violations plus optional `calculations`.
  - Applies to the authoritative `validateAggregation()` surface without widening broader validator result contracts.

## 4. Migration Work Completed
- `validateAggregation.ts`
  - Ported the live rule behavior 1:1 from JS to TS with narrow file-local types only.
  - Preserved:
    - current `validateAggregation(team, context = {})` contract
    - current `context || team.context || {}` resolution behavior
    - current `capSettings.secondApron || 190000000` fallback for test compatibility
    - current second-apron detection order and early-return object
    - current `outgoingPlayers.length ? outgoingPlayers : sends` salary-source fallback
    - current descending sorting of `outgoingSalaries` and `incomingSalaries`
    - current violation push order: aggregation-up first, multi-team incoming second
    - current exact message text, `details`, and `calculations` payload behavior
    - current omission of salary-mismatch enforcement from this rule
- `validateAggregation.js`
  - Converted to a shim-only compatibility export.
  - No business logic remains in the JS file after E22.
- `tests/trade/validateAggregation.test.ts`
  - Added direct parity coverage proving unchanged helper behavior and `.js` import-path stability.
- `tests/tradeValidatorEdgeCases.test.js`
  - Added a validator-path assertion proving `validateTrade()` still surfaces `rules.aggregation` as a blocker and still fails overall legality in a second-apron aggregation case.
- Minimal contract correction required by typing:
  - None. File-local types were sufficient and no runtime contract or rule semantics had to change.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/utils/capUtils.js`
  - Remained JS because E22 consumed the existing second-apron SSOT helper as-is; migrating it here would broaden this pass into shared apron-helper migration.
- `src/features/architect/utils/tradeHelpers.js`
  - Remained JS because E22 preserved the existing canonical salary lookup dependency rather than widening into general trade-helper migration.
- `src/features/architect/utils/tradeMachine/constants/secondApronMessages.js`
  - Remained JS because it is a stable shared constants surface already consumed safely by TS and was not a blocker for the authoritative `validateAggregation` migration.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/trade/validateAggregation.test.ts tests/tradeValidatorEdgeCases.test.js src/tests/trade/secondApron_SSOT_guardrail.test.js tests/trade/secondApronBoundary.test.js src/tests/trade/goldenTrades.test.js src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the new TS-backed `validateAggregation` surface compiles cleanly against the existing JS/TS consumer graph while preserving `.js` import compatibility.
  - `tests/trade/validateAggregation.test.ts`
    - Helper-only coverage proving the direct `validateAggregation` contract remains unchanged for the exact non-second-apron early return, `sends` fallback behavior, sorted calculation payloads, and exact violation ordering.
  - `tests/tradeValidatorEdgeCases.test.js`
    - Proves the authoritative `validateTrade()` path still surfaces unchanged `rules.aggregation` blocker behavior and still fails overall legality in a second-apron aggregation case.
  - `src/tests/trade/secondApron_SSOT_guardrail.test.js`
    - Preserves the existing strict `>` second-apron guardrail coverage for direct `validateAggregation` and salary-matching interaction boundaries.
  - `tests/trade/secondApronBoundary.test.js`
    - Proves the live validator path still avoids spurious second-apron aggregation blockers at the exact apron boundary and still blocks once the threshold is exceeded.
  - `src/tests/trade/goldenTrades.test.js`
    - Preserves existing golden-path coverage for second-apron aggregation in the authoritative validator flow.
  - `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js`
    - Was included per prompt, but its failure was unrelated to E22 and not caused by `validateAggregation.js` becoming a shim.
  - `npm run validate:project`
    - Proves the final file layout still satisfies repo structural validation.
- Results:
  - `npm run typecheck`: PASS
  - `npm run validate:project`: PASS
  - `npm run test:node -- --reporter=dot ...`: MIXED
    - E22-relevant tests passed:
      - `tests/trade/validateAggregation.test.ts`
      - `tests/tradeValidatorEdgeCases.test.js`
      - `src/tests/trade/secondApron_SSOT_guardrail.test.js`
      - `tests/trade/secondApronBoundary.test.js`
      - `src/tests/trade/goldenTrades.test.js`
    - Unrelated pre-existing failure:
      - `src/tests/architect/phase43_apron_drift_prevention_guardrails.test.js`
      - Failure reason: existing allowlist drift flagged raw apron-comparison patterns in `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.ts` and `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.ts`
      - No change was made to that guardrail because it did not fail due to the E22 shim conversion, and changing it here would have violated the prompt’s guardrail rule.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason:
  - E22 was a narrow validator-rule migration. The targeted helper and authoritative validator-path tests gave more direct proof of behavior preservation than broader suites, and the prompt did not authorize a full-suite run.

## 7. Remaining TS Migration Queue
- Based on the actual post-E22 state, `src/features/architect/utils/tradeMachine/utils/capUtils.js` is the next best likely TS slice.
- Why it is the best likely next step:
  - it remains live shared JS business logic
  - it is consumed directly by multiple already-TS-backed validator surfaces, including `validateAggregation.ts`, `basicRules.ts`, `validateSalaryMatching.ts`, `validateCash.ts`, and `validateTradeExceptions.ts`
  - migrating it would reduce repeated TS-to-JS dependency edges without broadening into UI or persistence code
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the post-E22 dependency graph or risk profile makes it the better next slice.

## 8. Master Doc Update
- Added `Validator TS Validate Aggregation E22 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `validateAggregation` surface now lives in `rules/validateAggregation.ts`.
- Recorded that `rules/validateAggregation.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent aggregation semantics remained unchanged.
- Recorded that targeted parity now includes direct helper coverage and an authoritative `validateTrade()` assertion proving unchanged `rules.aggregation` blocker behavior and top-level legality blocking.
- Updated the second-apron aggregation implementation row so the authoritative implementation reference now points at `rules/validateAggregation.ts`.
- Recorded that the next best TS slice should be selected from the actual post-E22 state, with `utils/capUtils.js` noted as the best likely next candidate rather than a hardcoded requirement.
