# TM_VALIDATOR_TS_DRAFT_RULES_E32 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical `draftRules` surface from `src/features/architect/utils/tradeMachine/rules/draftRules.js` to `src/features/architect/utils/tradeMachine/rules/draftRules.ts`.
- Behavior was preserved: the TS file is a line-faithful port of the live wrapper/helper logic, keeping the same `hasStepienViolation()` delegation, the same raw `validateDraftPicks()` `string[]` contract, the same exact message text/order, the same runtime-year behavior, the same protection gating, the same 7-year behavior, and the same strict `round === 1` filtering without adding new round normalization or coercion.
- No directly related business-logic area had to remain JS for the authoritative `draftRules` surface itself. `src/features/architect/utils/tradeMachine/rules/draftRules.js` remains JS only as the required pure compatibility re-export shim.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/draftRules.ts`
  - Added the authoritative TS-backed implementation for the live `draftRules` surface.
- `src/features/architect/utils/tradeMachine/rules/draftRules.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `tests/trade/draftRules_surface.test.ts`
  - Added focused surface coverage for direct `draftRules` behavior, public shim/export parity, strict round-filter preservation, exact message ordering, and legacy preflight-composition parity through `validateAllNewRules()`.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E32 migration entry and updated the Stepien/pick-eligibility summary to reflect the TS-backed `draftRules` source.
- `return_packages/trade_machine/TM_VALIDATOR_TS_DRAFT_RULES_E32_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `DraftRulesYearLike`
  - Represents the narrow year input shape already tolerated by the legacy `draftRules` surface.
  - Applies to the current `validateDraftPicks()` and `hasStepienViolation()` pick inputs in `draftRules.ts`.
- `DraftRulesRoundLike`
  - Represents the existing round input shape while preserving the current strict `round === 1` filter.
  - Applies to the authoritative TS-backed `validateDraftPicks()` path in `draftRules.ts`.
- `DraftRulesPickLike`
  - Represents the exact pick fields read by the `draftRules` surface: `year`, `round`, `isSwap`, and `protection`.
  - Applies across both exported helpers in `draftRules.ts` without widening broader validator contracts.
- `DraftRulesTeamLike`
  - Represents the narrow team shape consumed by `validateDraftPicks()`.
  - Applies to the authoritative `tradedPicks` input path in `draftRules.ts`.

## 4. Migration Work Completed
- `rules/draftRules.ts`
  - Ported the live JS `draftRules` logic into TS without changing runtime behavior.
  - Preserved:
    - `hasStepienViolation()` as a thin boolean wrapper over canonical `validateStepien()`
    - `validateDraftPicks()` as the same raw `string[]` producer
    - current `new Date().getFullYear()` resolution
    - current default `.sort()` behavior and year comparison quirks
    - current strict `round === 1` filter for the consecutive-year check
    - current protection gating via `isMeaningfulProtection()`
    - current consecutive-year message text/order
    - current 7-year-limit message text/order
  - Minimal contract correction required by typing:
    - kept the permissive legacy pick shape local to `draftRules.ts` and used a local type assertion at the `validateStepien()` delegation boundary so the wrapper can remain behavior-preserving without redesigning the narrower typed Stepien rule input contract.
- `rules/draftRules.js`
  - Converted to a shim-only compatibility export.
  - Hard rule satisfied: no business logic remains in the JS file after E32.
- Downstream parity coverage
  - Added a focused regression asserting unchanged legacy preflight composition through `validateAllNewRules()` under a test-only harness that preserves its pre-existing mixed spread contract, so E32 proves more than direct helper return values alone.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/rules/draftRules.js`
  - Remains JS only as the required pure compatibility re-export shim for stable `.js` imports.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
  - Remains JS because E32 only migrates the canonical `draftRules` business logic. The draft-rules surface still consumes the existing compatibility barrel import path, and changing that barrel here would broaden scope beyond the requested slice.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/trade/draftRules_surface.test.ts tests/hasStepienViolation.test.js tests/validators/stepien.test.js src/tests/tradeMachine/draftPicksPreflight.test.js tests/tradeValidator.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the TS-backed `draftRules` surface compiles cleanly against the existing mixed JS/TS validator graph while preserving stable `.js` import paths.
  - `tests/trade/draftRules_surface.test.ts`
    - Direct surface coverage proving unchanged `draftRules` shim behavior, exact `validateDraftPicks()` string output/order, protected-pick behavior, strict round-filter preservation, public export parity, and legacy preflight-composition parity through `validateAllNewRules()`.
  - `tests/hasStepienViolation.test.js`
    - Direct wrapper coverage proving unchanged boolean Stepien-violation behavior through the `.js` compatibility path.
  - `tests/validators/stepien.test.js`
    - Direct canonical Stepien-rule coverage proving the delegated Stepien surface remains unchanged.
  - `src/tests/tradeMachine/draftPicksPreflight.test.js`
    - Draft-picks preflight coverage proving unchanged Stepien-adjacent pick handling and protection behavior on the live rule path.
  - `tests/tradeValidator.test.js`
    - Authoritative validator-path coverage proving unchanged top-level Stepien legality behavior after the `draftRules` migration.
  - `npm run validate:project`
    - Proves the new TS file and new test file keep the repo within the project schema.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot ...`: PASS (5 files, 64 tests)
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason skipped:
  - E32 is a narrow validator-adjacent TS migration slice. The direct `draftRules` surface test, Stepien suites, draft-picks preflight suite, authoritative validator-path suite, typecheck, and project-schema validation provide direct proof of behavior preservation without broadening into unrelated rule families or full-suite execution.

## 7. Remaining TS Migration Queue
- Based on the actual post-E32 state, the next best TS slice should still be selected from the remaining live JS validator-adjacent holdouts rather than hardcoded in advance.
- `src/features/architect/utils/tradeMachine/rules/tradeExceptions.js` is a likely next candidate because it still contains live business logic rather than shim-only compatibility and remains part of the validator-adjacent rule surface.
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the actual post-E32 dependency graph or risk profile makes it the better next slice.

## 8. Master Doc Update
- Added `Validator TS Draft Rules E32 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `draftRules` surface now lives in `rules/draftRules.ts`.
- Recorded that `rules/draftRules.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent draft-rule semantics remained unchanged, including `hasStepienViolation()` delegation, raw `validateDraftPicks()` string output, current year resolution, protection gating, 7-year behavior, and the strict `round === 1` filter.
- Recorded that targeted parity now includes both direct draft-rules surface assertions and a legacy preflight-composition assertion for the surviving downstream `validateAllNewRules()` path.
- Updated the Stepien/pick-eligibility summary rows so they reference the TS-backed `draftRules` source.
- Recorded that the next TS slice should be chosen from the actual post-E32 holdouts, with `rules/tradeExceptions.js` noted as a likely candidate rather than a hardcoded requirement.
