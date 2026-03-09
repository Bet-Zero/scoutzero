# TM_VALIDATOR_TS_FA_EXCEPTION_USAGE_E25 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative `validateFaExceptionUsage` rule surface from `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js` to `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.ts`.
- Behavior was preserved: first-/second-apron usage blocking, projected first-apron blocking, outgoing-salary aggregation blocking, auto-bucket assignment, raw violation array shape, message text/order, bucket depletion, note insertion, and `team.team.hardCapFirstApron` side effects remained unchanged.
- `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js` remains JS only as a pure compatibility shim so existing `.js` imports stay stable. The directly related helper dependencies `src/features/architect/utils/tradeHelpers.js` and `src/features/architect/utils/faExceptionUtils.js` remained JS because migrating them here would have broadened E25 beyond the requested slice.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.ts`
  - Added the authoritative TS implementation for the live FA-exception rule surface.
- `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `tests/smoke/imports.smoke.test.js`
  - Added explicit `.js` import-stability coverage for `validateFaExceptionUsage` through the Trade Machine public index and the validator compatibility index.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E25 migration entry and recorded the post-E25 rule state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_FA_EXCEPTION_USAGE_E25_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `NumericLike`
  - Represents the number-or-string inputs already accepted by the rule for salary and apron fields.
  - Applies across cap settings, team payroll fields, bucket balances, and incoming player salary fields in `validateFaExceptionUsage.ts`.
- `FaExceptionBucket`
  - Represents a mutable FA-exception bucket with `type` and `remaining`.
  - Applies to bucket lookup, depletion, and auto-assignment in the authoritative rule path.
- `FaExceptionIncomingPlayer`
  - Represents the narrow incoming-player shape read and mutated by the rule.
  - Applies to `absorptionMode`, `bucketType`, and incoming salary resolution in the authoritative rule path.
- `FaExceptionTeamData`
  - Represents the nested `team.team` season-state fields touched by the rule.
  - Applies to `faExceptionBuckets` and `hardCapFirstApron` mutation in the authoritative rule path.
- `FaExceptionValidationContext`
  - Represents the narrow context shape consumed by the rule.
  - Applies to `yearKey` and `capSettings` access while preserving the current team-context read pattern.
- `FaExceptionValidationTeam`
  - Represents the exact mutable wrapper shape the live rule consumes.
  - Applies across incoming/outgoing player access, salary fields, notes mutation, and nested team state mutation in `validateFaExceptionUsage.ts`.

## 4. Migration Work Completed
- `rules/validateFaExceptionUsage.ts`
  - Ported the live rule logic 1:1 from JS to TS with narrow file-local types only.
  - Preserved:
    - current first-/second-apron blocker behavior and message text
    - current projected first-apron blocker behavior and message text
    - current outgoing-salary aggregation blocker behavior
    - current auto-bucket assignment behavior for eligible incoming players
    - current per-player bucket lookup and insufficiency handling
    - current raw string-array violation return shape and ordering
    - current mutation semantics, including in-place bucket depletion, note insertion, and `team.team.hardCapFirstApron` activation
  - Minimal contract correction required by typing:
    - none in runtime behavior; the TS signature explicitly preserves the optional second argument used by `tradeValidator.ts` even though the rule continues to read `team.context` internally.
- `rules/validateFaExceptionUsage.js`
  - Converted to a shim-only compatibility export.
  - Hard rule satisfied: no business logic remains in the JS file after E25.
- Compatibility proof
  - Preserved the existing authoritative `validateTrade()` assertions in `tests/trade/validatorTrustFixes.test.js` that prove unchanged `rules.faExceptionUsage` pass/block behavior and unchanged downstream `salaryMatching.skipReason === 'FA_EXCEPTION'`.
  - Added smoke assertions proving unchanged `.js` export availability for `validateFaExceptionUsage` through the Trade Machine public index and validator compatibility index.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/rules/validateFaExceptionUsage.js`
  - Remains JS only as the required pure compatibility shim for stable `.js` imports.
- `src/features/architect/utils/tradeHelpers.js`
  - Remains JS because `validateFaExceptionUsage.ts` still delegates to `getApronStatus` and `getSalaryForYear`; migrating that broader helper surface would have expanded E25 beyond the requested rule slice.
- `src/features/architect/utils/faExceptionUtils.js`
  - Remains JS because E25 only needs its existing `getTeamFaExceptionBuckets(...)` helper; migrating the broader FA-exception utility module here would have widened scope unnecessarily.
- `src/features/architect/utils/tradeMachine/index.js`
  - Remains JS as a public barrel surface; no logic change was required once the rule shim preserved the export path.
- `src/features/architect/utils/tradeMachine/validators/index.js`
  - Remains JS as a compatibility barrel; no logic change was required once the rule shim preserved the export path.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/trade/faExceptions_as_trade_buckets.test.js tests/trade/hardCap_trigger_faException.test.js tests/trade/validatorTrustFixes.test.js tests/smoke/imports.smoke.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the new TS-backed `validateFaExceptionUsage` rule compiles cleanly against the existing JS/TS validator graph and current engine call signature.
  - `tests/trade/faExceptions_as_trade_buckets.test.js`
    - Direct rule coverage proving unchanged FA-exception blocker behavior, auto-assignment behavior, bucket depletion, note insertion, and hard-cap mutation side effects.
  - `tests/trade/hardCap_trigger_faException.test.js`
    - Proves the engine export path still triggers first-apron hard-cap behavior from FA-exception usage.
  - `tests/trade/validatorTrustFixes.test.js`
    - Proves the authoritative `validateTrade()` path still surfaces unchanged `rules.faExceptionUsage` pass/block behavior and preserves the downstream salary-matching interaction where legal FA-exception absorption yields `skipReason: 'FA_EXCEPTION'`.
  - `tests/smoke/imports.smoke.test.js`
    - Proves `.js` import stability for `validateFaExceptionUsage` through the Trade Machine public index and validator compatibility index.
  - `npm run validate:project`
    - Proves the final file layout still satisfies repo structural validation after adding `validateFaExceptionUsage.ts`.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot tests/trade/faExceptions_as_trade_buckets.test.js tests/trade/hardCap_trigger_faException.test.js tests/trade/validatorTrustFixes.test.js tests/smoke/imports.smoke.test.js`: PASS (4 files, 25 tests)
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason skipped:
  - E25 is a narrow rule migration slice. The targeted direct-rule, authoritative validator-path, compatibility-smoke, and structural validation commands provided direct proof of behavior preservation without broadening into unrelated suites.

## 7. Remaining TS Migration Queue
- Based on the actual post-E25 state, `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js` is the next best likely TS migration slice.
- Why it is the best likely next step:
  - it remains live JS rule logic imported directly by `src/features/architect/utils/tradeMachine/engine/tradeValidator.ts`
  - it has no TS-backed counterpart yet
  - it is narrower and closer to the authoritative validator path than broader compatibility barrels or helper families
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the post-E25 dependency graph or risk profile makes it the better next slice.

## 8. Master Doc Update
- Added `Validator TS FA Exception Usage E25 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `validateFaExceptionUsage` surface now lives in `rules/validateFaExceptionUsage.ts`.
- Recorded that `rules/validateFaExceptionUsage.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent FA-exception semantics remained unchanged, including blockers, auto-assignment, violation ordering, raw return shape, bucket depletion, note insertion, and hard-cap side effects.
- Recorded that targeted parity includes the existing authoritative `validateTrade()` assertions plus new smoke assertions proving unchanged `.js` import compatibility through the public and validator barrel paths.
- Recorded that `rules/validatePlayerRouting.js` is the best likely next TS slice based on the actual post-E25 holdouts.
