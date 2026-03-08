# TM_VALIDATOR_TS_BASIC_RULES_E21 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical `basicRules` rule/helper surface into TypeScript via `src/features/architect/utils/tradeMachine/rules/basicRules.ts`.
- Behavior was preserved: second-apron detection, prior-year TPE blocking, multi-player aggregation blocking, cash blocking, exact violation ordering, alias exports, and validator-facing blocker behavior remained unchanged.
- `src/features/architect/utils/tradeMachine/rules/basicRules.js` now contains no business logic and is a pure compatibility re-export shim only.
- Directly related areas remained JS only where they were existing adjacent dependencies or neighboring holdouts; they were not required blockers for the authoritative `basicRules` surface itself and were left unchanged to keep E21 narrow.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/basicRules.ts`
  - Added the authoritative TS implementation for the live `basicRules` second-apron rule/helper surface.
- `src/features/architect/utils/tradeMachine/rules/basicRules.js`
  - Reduced to a pure compatibility re-export shim so existing `.js` import paths remain stable with no business logic left in JS.
- `tests/trade/basicRules.test.ts`
  - Added direct helper-surface coverage for exact result shape, strict boundary pass behavior, alias parity, reject-callback behavior, and `.js` shim-path compatibility.
- `tests/tradeValidatorEdgeCases.test.js`
  - Strengthened the authoritative validator-path cash blocker assertion so `validateTrade()` explicitly proves unchanged team-level and top-level legality blocking when `enforceSecondApronHandcuffs` contributes second-apron cash violations.
- `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
  - Updated the Phase 65 guardrail only enough to follow a single local `.ts` authoritative implementation behind a `.js` shim when verifying `getTeamTpeList` usage.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E21 migration entry and updated authoritative `basicRules` implementation references to the TS-backed surface.
- `return_packages/trade_machine/TM_VALIDATOR_TS_BASIC_RULES_E21_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `BasicRulesTeam`
  - Represents the narrow team-slot shape consumed by the authoritative `basicRules` logic, including salary fallbacks, outgoing-player arrays, cash, TPE storage, and second-apron context flags.
  - Applies across `validateSecondApronRules()` and `enforceSecondApronHandcuffs()` in `basicRules.ts`.
- `BasicRulesContext`
  - Represents the narrow context shape used by `basicRules`, including `capSettings` and the preserved legacy `year` field used for prior-year TPE checks.
  - Applies to the authoritative validation and enforcement entrypoints in `basicRules.ts`.
- `BasicRulesValidationResult`
  - Represents the direct `basicRules` result shape of `{ passed, violations, warningsOnly }`.
  - Applies to the authoritative second-apron helper boundary without widening broader validator result contracts.
- `BasicRulesEnforcementCallbacks`
  - Represents the narrow enforcement callback surface used by `enforceSecondApronHandcuffs()`.
  - Applies to the compatibility enforcement wrapper while preserving the existing reject-callback behavior.
- `BasicRulesTpe`
  - Represents the minimal TPE fields read by the preserved prior-year TPE restriction logic.
  - Applies to the canonical `getTeamTpeList(team)` read path consumed in `basicRules.ts`.

## 4. Migration Work Completed
- `basicRules.ts`
  - Ported the live `basicRules` behavior 1:1 from JS to TS with narrow file-local types.
  - Preserved:
    - current salary fallbacks from `teamTotalSalary`, `team.team.teamTotalSalary`, and `team.team.totalSalary`
    - current projected-salary fallback behavior
    - current second-apron detection sources, including `postTradeStatus.isAtOrAboveSecondApron`, `isSecondApronTeam()` checks, and `team.context.isAtOrAboveSecondApron`
    - current prior-year TPE blocking via `getTeamTpeList(team)` and the preserved `context.year || 2025` lookup
    - current multi-player aggregation and cash checks
    - current result shape and violation ordering
    - current `validateSecondApron` alias export and `cbaConstants` re-export surface
- `basicRules.js`
  - Converted to a shim-only compatibility export.
  - No business logic remains in the JS file after E21.
- `tests/trade/basicRules.test.ts`
  - Added direct parity coverage proving exact helper behavior, strict boundary pass semantics, alias parity, and `.js` import-path stability.
- `tests/tradeValidatorEdgeCases.test.js`
  - Added an explicit live validator-path assertion proving second-apron cash blocking still fails the team and the trade through `secondApronEnforcement` in the authoritative validator flow.
- `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
  - Applied the minimal shim-aware adjustment required so the guardrail still verifies authoritative rule implementations use `getTeamTpeList` when a `.js` file is only a compatibility shim to a sibling `.ts` implementation.
- Minimal contract correction required by typing:
  - None. File-local types were sufficient and no runtime contract or rule semantics had to change.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/rules/validateAggregation.js`
  - Remained JS because it is an adjacent live second-apron rule family and migrating it here would broaden E21 beyond the `basicRules` slice.
- `src/features/architect/utils/tradeMachine/utils/capUtils.js`
  - Remained JS because E21 preserved the existing second-apron SSOT helper dependency instead of reopening shared apron-helper migration.
- `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
  - Remained JS because E21 consumed the existing canonical TPE accessor surface and did not broaden into persistence-contract migration.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
  - Remained JS because E21 preserved the existing compatibility import surface for `isPriorYearTPE()` rather than widening into shared utility migration.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/trade/basicRules.test.ts tests/trade/secondApron_handcuffs.test.js tests/trade/secondApron_tpeBan.test.js tests/trade/secondApronBoundary.test.js tests/tradeValidatorEdgeCases.test.js src/tests/trade/secondApron_SSOT_guardrail.test.js src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new TS-backed `basicRules` surface compiles cleanly against the existing JS/TS consumer graph while preserving `.js` import compatibility.
  - `tests/trade/basicRules.test.ts` is helper-level coverage proving direct `basicRules` behavior remains unchanged for exact violations, strict boundary pass semantics, alias parity, callback behavior, and shim-path compatibility.
  - `tests/trade/secondApron_handcuffs.test.js` preserves existing direct enforcement behavior coverage for aggregation, cash, and prior-year TPE handcuffs.
  - `tests/trade/secondApron_tpeBan.test.js` proves unchanged authoritative and compatibility-path prior-year TPE blocking behavior in second-apron scenarios.
  - `tests/trade/secondApronBoundary.test.js` proves unchanged strict `>` second-apron boundary behavior in the live validator path.
  - `tests/tradeValidatorEdgeCases.test.js` proves unchanged authoritative validator blocker behavior for second-apron cash restrictions, including explicit team-level `secondApronEnforcement` failure and top-level legality blocking.
  - `src/tests/trade/secondApron_SSOT_guardrail.test.js` preserves the existing SSOT second-apron guardrail coverage for aggregation and salary matching interactions.
  - `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js` proves authoritative rule implementations still use `getTeamTpeList`, including shim-backed TS implementations.
  - `npm run validate:project` proves the final file layout still satisfies repo structural validation.
- Results:
  - PASS.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason:
  - E21 was a narrow validator-rule migration. The targeted helper, validator-path, and shim-aware guardrail tests provided more direct proof of `basicRules` behavior preservation than broader suites, and this pass did not touch a build-sensitive UI or route boundary.

## 7. Remaining TS Migration Queue
- The next best TS slice should be chosen from the actual post-E21 holdouts rather than hardcoded in advance.
- `src/features/architect/utils/tradeMachine/rules/validateAggregation.js` is a likely next candidate because it remains live JS second-apron rule logic imported directly by the TS-backed validator engine.
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the post-E21 dependency graph or risk profile makes it the better next slice.

## 8. Master Doc Update
- Added `Validator TS Basic Rules E21 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `basicRules` surface now lives in `rules/basicRules.ts`.
- Recorded that `rules/basicRules.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent `basicRules` semantics remained unchanged.
- Recorded that targeted parity now includes a direct helper test and an authoritative `validateTrade()` cash-block assertion proving unchanged second-apron handcuff blocker behavior.
- Updated existing `TRADE_MACHINE_MASTER.md` rule-reference rows so the authoritative `basicRules` implementation references point at `rules/basicRules.ts`.
- Recorded that the next best TS slice should be selected from the actual post-E21 state, with `rules/validateAggregation.js` noted as a likely but not mandatory candidate.
