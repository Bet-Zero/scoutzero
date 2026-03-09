# TM_VALIDATOR_TS_TRADE_EXCEPTIONS_E33 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the legacy `tradeExceptions` surface from `src/features/architect/utils/tradeMachine/rules/tradeExceptions.js` to `src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts`.
- Behavior was preserved: the TS file is a line-faithful port of the legacy helper contract, keeping string violations, `team.receives`-based TPE detection, wall-clock expiration via `new Date()`, the current `getTeamTpeList(team.team)` lookup path, the current eager `isUsed = true` mutation on successful usage, and the same return-shape quirks.
- No directly related business-logic area had to remain JS for the authoritative `tradeExceptions` surface itself. `src/features/architect/utils/tradeMachine/rules/tradeExceptions.js` remains JS only as the required pure compatibility re-export shim.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts`
  - Added the authoritative TS-backed implementation for the legacy `tradeExceptions` helper surface.
- `src/features/architect/utils/tradeMachine/rules/tradeExceptions.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `tests/trade/tradeExceptions_surface.test.ts`
  - Added focused surface coverage for the legacy `.js` compatibility path, exact string violations, and in-place mutation semantics.
- `src/tests/trade/validatorContractConsumers.test.jsx`
  - Added a downstream validator-adjacent consumer assertion proving legacy `tradeExceptions` string violations still render correctly after adaptation into the official issue shape.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E33 migration entry and updated the migration queue note based on the actual post-E33 holdouts.
- `return_packages/trade_machine/TM_VALIDATOR_TS_TRADE_EXCEPTIONS_E33_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `LegacyTradeExceptionRecord`
  - Represents the narrow TPE shape read and mutated by the legacy helper (`id`, `isUsed`, `remaining`, `expirationDate`).
  - Applies inside `src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts`.
- `LegacyTradeExceptionPlayer`
  - Represents the exact incoming-player fields consumed by the legacy helper (`absorptionMode`, `tpeId`, `matchIncoming`).
  - Applies inside `src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts`.
- `LegacyTradeExceptionsTeam`
  - Represents the legacy wrapper shape with `team`, `receives`, and `sends`.
  - Applies to the authoritative TS-backed `validateTradeExceptions()` input in `src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts`.
- `LegacyTradeExceptionsContext`
  - Represents the narrow context shape required by the legacy second-apron check.
  - Applies inside `src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts`.
- `LegacyTradeExceptionsResult`
  - Represents the legacy helper return contract while allowing the pre-existing omitted-`details` branch.
  - Applies to the authoritative TS-backed `validateTradeExceptions()` return type in `src/features/architect/utils/tradeMachine/rules/tradeExceptions.ts`.

## 4. Migration Work Completed
- `rules/tradeExceptions.ts`
  - Ported the live JS helper logic into TS without changing runtime behavior.
  - Preserved:
    - `team.receives` as the only TPE-detection source
    - plain `string[]` violations
    - wall-clock expiry checks against `new Date()`
    - `getTeamTpeList(team.team)` lookup behavior
    - eager `isUsed = true` mutation and `remaining` decrement on successful usage
    - the current return-shape behavior, including the second-apron early return without `details`
  - Minimal contract correction required by typing:
    - none; typing stayed file-local and matched the existing runtime contract instead of normalizing toward `validateTradeExceptions.ts`.
- `rules/tradeExceptions.js`
  - Converted to a shim-only compatibility export.
  - Hard rule satisfied: no business logic remains in the JS file after E33.
- Downstream parity coverage
  - Added a focused consumer-path assertion proving legacy `tradeExceptions` string messages still survive through an official validator-result consumer, not just direct helper calls.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/rules/tradeExceptions.js`
  - Remains JS only as the required pure compatibility re-export shim for stable `.js` imports.
- `src/features/architect/utils/persistenceContracts/normalizeTeamTpe.js`
  - Remains JS because E33 is limited to the validator-adjacent `tradeExceptions` surface, and migrating persistence-contract helpers here would broaden scope.
- `src/features/architect/utils/persistenceContracts/index.js`
  - Remains JS because it is the existing public barrel for persistence-contract helpers; changing it is unnecessary for this slice.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/trade/tradeExceptions_surface.test.ts tests/tradeExceptions.test.js tests/trade/tpe_absorption_fail_closed.test.js tests/trade/secondApron_tpeBan.test.js tests/trade/tpe_creation_expiry_usage.test.js src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
  - `npm run test:ui -- --reporter=dot src/tests/trade/validatorContractConsumers.test.jsx`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the TS-backed legacy `tradeExceptions` surface compiles cleanly in the mixed JS/TS rule graph.
  - `npm run test:node -- --reporter=dot ...`
    - Proves the TS-backed legacy helper surface, the unchanged authoritative `validateTradeExceptions` path, the TPE fail-closed/expiry/apron behavior, and the shim-aware Phase 65 read-path guardrail all remain intact in the node-layer regression set.
  - `tests/trade/tradeExceptions_surface.test.ts`
    - Direct surface coverage proving unchanged legacy `.js` shim behavior, exact string violations, wall-clock expiry semantics, outgoing-salary blocking, and in-place TPE mutation behavior.
  - `tests/tradeExceptions.test.js`
    - Direct TPE rule coverage for the typed validator-adjacent `validateTradeExceptions.js` path that remains live and unchanged in E33.
  - `tests/trade/tpe_absorption_fail_closed.test.js`
    - Proves fail-closed TPE ID behavior remains unchanged in the authoritative validator path.
  - `tests/trade/secondApron_tpeBan.test.js`
    - Proves prior-year second-apron TPE handling remains unchanged in the authoritative validator path.
  - `tests/trade/tpe_creation_expiry_usage.test.js`
    - Proves validator-adjacent TPE creation, expiry, and aggregation behavior remains unchanged.
  - `npm run test:ui -- --reporter=dot src/tests/trade/validatorContractConsumers.test.jsx`
    - Proves the official jsdom consumer path still renders legacy `tradeExceptions` string messages correctly after E33.
  - `src/tests/trade/validatorContractConsumers.test.jsx`
    - Proves an official consumer still renders legacy `tradeExceptions` string messages correctly after E33.
  - `src/tests/architect/phase65_forbid_direct_tradeExceptions_reads_guardrail.test.js`
    - Proves the shim-aware canonical read-path guardrail still recognizes the authoritative implementation correctly.
  - `npm run validate:project`
    - Proves the new TS file and new test file keep the repo within the project schema.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot ...`: PASS (6 files, 47 tests)
  - `npm run test:ui -- --reporter=dot src/tests/trade/validatorContractConsumers.test.jsx`: PASS (1 file, 2 tests)
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason skipped:
  - E33 is a narrow validator-adjacent TS migration slice. The direct legacy-surface test, downstream consumer parity test, authoritative TPE suites, guardrail, typecheck, and project validation provide targeted proof without broadening into unrelated rule families or guarded full-suite execution.

## 7. Remaining TS Migration Queue
- Based on the actual post-E33 rule-directory state, the next best TS slice should still be selected from the remaining live JS validator-adjacent holdouts rather than hardcoded in advance.
- `src/features/architect/utils/tradeMachine/rules/validateRoster.js` is a likely next candidate because it still contains live rule logic, public rule semantics, and a larger non-shim implementation than the remaining one-line compatibility files.
- This is not mandatory:
  - `src/features/architect/utils/tradeMachine/rules/enforcement.js` or another remaining live JS holdout may be the better next slice if the actual post-E33 dependency or risk profile points there.

## 8. Master Doc Update
- Added `Validator TS Trade Exceptions E33 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative legacy `tradeExceptions` surface now lives in `rules/tradeExceptions.ts`.
- Recorded that `rules/tradeExceptions.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent trade-exception semantics remained unchanged, including string violations, wall-clock expiry, `team.receives`-based detection, `getTeamTpeList(team.team)` lookup behavior, and in-place mutation of the resolved TPE object.
- Recorded that targeted parity now includes both direct surface assertions and an official consumer-path assertion for legacy `tradeExceptions` messages.
- Recorded that the next TS slice should be chosen from the actual post-E33 holdouts, with `rules/validateRoster.js` noted as a likely candidate rather than a hardcoded requirement.
