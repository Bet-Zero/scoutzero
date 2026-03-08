# TM_VALIDATOR_TS_SALARY_MATCHING_E11 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative salary-matching rule surface into TypeScript via `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.ts`.
- Migrated the authoritative salary-matching helper surface into TypeScript via `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.ts`.
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js` and `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js` are now pure compatibility re-export shims only.
- Authoritative salary-matching behavior was preserved: live legality, matching bands, TPE / FA-exception reductions, hard-cap ceiling interaction, and `rules.salaryMatching` envelope compatibility all remained unchanged.
- Directly related JS holdouts remain narrow: `tradeValidator.js`, `matchingValues.js`, and `salaryUtils.js` stayed JS because this pass stopped at the authoritative salary-matching rule/helper boundary.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.ts`
  - Replaced the stale TS implementation with a 1:1 port of the current authoritative live salary-matching rule logic.
- `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`
  - Reduced to a pure compatibility re-export shim.
- `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.ts`
  - Added the authoritative TS helper surface for matching-band and ceiling calculations.
- `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js`
  - Reduced to a pure compatibility re-export shim.
- `src/features/architect/utils/tradeMachine/constants/types.ts`
  - Hardened the narrow authoritative salary-matching result/detail contracts required by the new TS rule.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the E11 indexed migration entry.
- `return_packages/trade_machine/TM_VALIDATOR_TS_SALARY_MATCHING_E11_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `AuthoritativeSalaryMatchingResult`
  - Canonical live salary-matching rule result contract for the validator path.
  - Applies to `validateSalaryMatching()` in `validateSalaryMatching.ts`, while preserving legacy string-based direct rule violations/warnings.
- `AuthoritativeSalaryMatchingDetails`
  - Structured detail payload for rule receipts, including cap-settings source, absorbed salary, margin, and hard-cap metadata.
  - Applies to the `details` object returned by the authoritative salary-matching rule.
- `AuthoritativeSalaryMatchingHardCapCeilingDetails`
  - Typed hard-cap ceiling detail payload with ceiling, apron label, and active limiter.
  - Applies to `details.hardCapCeiling` in the live salary-matching output.
- `AuthoritativeSalaryMatchingCapSettings`
  - Narrow typed cap-settings payload used in authoritative salary-matching details.
  - Applies to `details.capSettings` in the live salary-matching output.

## 4. Migration Work Completed
- `validateSalaryMatching.ts`
  - Ported the authoritative JS logic 1:1 into TS.
  - Preserved invalid-input handling, team-level FA-exception bypass, per-player TPE assignment and failure behavior, FA-exception absorbed-salary reduction, under-cap / apron / over-cap band enforcement, hard-cap status consumption, hard-cap incoming ceiling limiting, `warningsOnly`, and all existing receipt/UI detail fields.
- `salaryMatchingRules.ts`
  - Ported the authoritative helper logic 1:1 into TS.
  - Preserved all thresholds, formulas, rule keys, labels, band metadata, and convenience wrappers.
- `validateSalaryMatching.js`
  - Converted to a shim so the engine and tests can keep their existing import path unchanged.
- `salaryMatchingRules.js`
  - Converted to a shim so helper consumers can keep their existing import path unchanged.
- `constants/types.ts`
  - Added dedicated authoritative salary-matching contracts instead of forcing the broader older `SalaryMatchingResult` shape onto the live rule.
  - This was the only minimal contract correction required by typing.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
  - Remains JS because this pass explicitly kept the core engine/orchestration layer out of scope; it only consumes the typed rule/helper surface through stable shim paths.
- `src/features/architect/utils/tradeMachine/utils/matchingValues.js`
  - Remains JS because matching-value ownership and compute order were explicitly kept out of scope for E11.
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.js`
  - Remains JS because it is a compatibility wrapper around the canonical helper surfaces and was not required to type the authoritative salary-matching path safely.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/trade/salaryMatching.test.js tests/validators/salaryMatching.test.js tests/salaryMatchingRules.test.js tests/salaryMatchingUnification.test.js tests/trade/secondApron_handcuffs.test.js src/tests/trade/hardCap_salaryMatching.guardrail.test.js src/tests/trade/P0_hardCapSkip_worldless.guardrail.test.js src/tests/trade/hardCapSkip_strict_boolean.guardrail.test.js src/tests/trade/tpe_perPlayer.guardrail.test.js src/tests/trade/secondApron_SSOT_guardrail.test.js src/tests/tradeMachine/tradeAllowableIncomingParity.guardrail.test.ts src/tests/tradeMachine/hardCap_reasonParity.guardrail.test.ts tests/tradeValidator.test.js tests/trade/validatorTrustFixes.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `typecheck` proves the new TS salary-matching rule/helper interoperate with the live validator path and the narrowed shared contracts.
  - The targeted node suite proves helper formulas and thresholds, live validator legality, skip behavior, TPE / FA-exception reductions, second-apron / first-apron enforcement, hard-cap metadata consumption, hard-cap limiter parity, and `rules.salaryMatching` compatibility with validator/receipt consumers.
  - `validate:project` proves the added TS file/shim structure remains project-schema compliant.
- Results:
  - PASS.
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
  - Reason: E11 was a narrow authoritative salary-matching TS slice, and the targeted salary-matching gate directly covered the touched rule/helper boundary more precisely than broader suites.

## 7. Remaining TS Migration Queue
- Next best slice: `src/features/architect/utils/tradeMachine/utils/matchingValues.js`
- Follow-on compatibility touch if needed: `src/features/architect/utils/tradeMachine/utils/salaryUtils.js`
- Reason: after E11, the next adjacent live JS ownership boundary upstream of salary-matching legality is matching-value computation, while the engine can continue consuming typed rule/helper modules through the shim paths.

## 8. Master Doc Update
- Added `Validator TS Salary Matching E11 (2026-03-08)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the active authoritative salary-matching rule logic now lives in `rules/validateSalaryMatching.ts`.
- Recorded that the active authoritative salary-matching helper logic now lives in `utils/salaryMatchingRules.ts`.
- Recorded that `validateSalaryMatching.js` and `salaryMatchingRules.js` are now pure compatibility re-export shims with no remaining business logic.
- Recorded that hard-cap/apron metadata consumption remains unchanged through `utils/hardCapStatus.ts`.
- Recorded that the next migration slice should be `utils/matchingValues.js`.
