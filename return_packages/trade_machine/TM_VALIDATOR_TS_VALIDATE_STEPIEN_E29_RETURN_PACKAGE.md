# TM_VALIDATOR_TS_VALIDATE_STEPIEN_E29 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical `validateStepien` rule surface from `src/features/architect/utils/tradeMachine/rules/validateStepien.js` to `src/features/architect/utils/tradeMachine/rules/validateStepien.ts`.
- Behavior was preserved: the TS file is a line-faithful port of the live JS logic, keeping the same string-array `violations` / `warnings`, exact message text and ordering, entitlements-SSOT baseline behavior, outgoing entitlement warning de-dupe, swap reservation behavior, 7-year limit behavior, second-apron frozen-pick behavior, and `_debug` payload structure.
- No directly required business-logic area had to remain JS for the `validateStepien` rule surface itself. `src/features/architect/utils/tradeMachine/rules/validateStepien.js` remains JS only as the required pure compatibility re-export shim for stable `.js` imports.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/validateStepien.ts`
  - Fully replaced the stale TS contents with the authoritative TS port of the live Stepien rule logic.
- `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
  - Reduced to a pure named re-export shim with no remaining business logic.
- `tests/tradeValidator.test.js`
  - Tightened authoritative validator-path parity coverage to assert unchanged Stepien blocker propagation at both the top-level trade result and `team.rules.stepienRule`.
- `tests/tradeValidatorEdgeCases.test.js`
  - Tightened the entitlements-backed validator-path Stepien assertion to pin unchanged `rules.stepienRule` failure semantics through `validateTrade()`.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E29 migration entry and recorded the post-E29 Stepien rule state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATE_STEPIEN_E29_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `StepienTeam`
  - Represents the narrow team overlay actually read by `validateStepien`.
  - Applies to `picksOut`, `outgoingPicks`, `validationEntitlements`, `entitlementsOut`, `postTradeStatus`, and Stepien-relevant team identity/context fields in `validateStepien.ts`.
- `StepienTradeContext`
  - Represents the narrow validator context shape the rule actually reads.
  - Applies to `year`, `yearKey`, and `capSettings` access in `validateStepien.ts`.
- `StepienReservationEntry`
  - Represents the merged baseline/outgoing year-reservation entries used for consecutive-year legality evaluation and `_debug.controlByYear`.
  - Applies across the authoritative post-trade Stepien reservation model in `validateStepien.ts`.
- `StepienDebugInfo`
  - Represents the `_debug` payload returned by the canonical Stepien rule.
  - Applies to baseline/outgoing counts, `baselineSource`, and `controlByYear` reporting in `validateStepien.ts`.
- `StepienResult`
  - Represents the actual live Stepien rule return contract without broadening shared validator result types.
  - Applies to the authoritative TS-backed `validateStepien` export and preserves the existing string-array result semantics.

## 4. Migration Work Completed
- `rules/validateStepien.ts`
  - Fully replaced the prior stale TS file rather than merging with it.
  - Ported the live JS logic line-faithfully and removed the stale TS-only calendar path, `isFrozenPick` path, validator-debug logging, and object-style issue construction.
  - Preserved:
    - `outgoingPicks` over `picksOut` precedence
    - current-year resolution behavior
    - entitlements SSOT baseline via `validationEntitlements`
    - outgoing entitlement warning generation and de-dupe
    - outgoing year reservation model
    - consecutive-year blocking only when at least one adjacent year is introduced by outgoing assets
    - 7-year limit behavior against trade picks only
    - second-apron frozen-pick behavior exactly as currently implemented
    - `details`, `farthestYear`, and `_debug.controlByYear`
  - Minimal contract correction required by typing:
    - kept Stepien-specific input/result typing local to `validateStepien.ts` so the live string-array contract could be modeled without redesigning shared validator result types.
- `rules/validateStepien.js`
  - Converted to a shim-only compatibility export.
  - Hard rule satisfied: no business logic remains in the JS file after E29.
- Authoritative validator-path parity
  - Preserved and tightened `validateTrade()` coverage so Stepien still surfaces the same blocker behavior through both:
    - top-level trade legality / reason / violation propagation
    - team-level `rules.stepienRule` pass/fail semantics

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
  - Remains JS only as the required pure compatibility re-export shim for stable `.js` imports.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js`
  - Remains JS because E29 only consumes its existing `isMeaningfulProtection` helper contract; migrating that shared utility family is outside the requested Stepien-rule slice and was not required to make `validateStepien` TS-backed.
- `src/features/architect/utils/tradeMachine/utils/tradeUtilityMisc.js`
  - Remains JS for the same reason as the compatibility barrel above: it is shared helper infrastructure, not part of the narrow live `validateStepien` surface migration.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/validators/stepien.test.js tests/validators/stepienEntitlements.test.js tests/validators/stepienEntitlementBaseline.test.js src/tests/tradeMachine/stepienObligations.test.js src/tests/tradeMachine/draftPicksPreflight.test.js tests/tradeValidator.test.js tests/tradeValidatorEdgeCases.test.js tests/trade/frozenPick_consequences.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the TS-backed `validateStepien` surface compiles cleanly against the existing JS/TS validator graph while preserving the `.js` import path.
  - `tests/validators/stepien.test.js`
    - Direct rule coverage proving unchanged core Stepien consecutive-year, protection, swap-reservation, 7-year-limit, and second-apron behavior.
  - `tests/validators/stepienEntitlements.test.js`
    - Direct rule coverage proving unchanged entitlements-out integration and warning behavior.
  - `tests/validators/stepienEntitlementBaseline.test.js`
    - Direct rule coverage proving unchanged entitlements-baseline reservation behavior.
  - `src/tests/tradeMachine/stepienObligations.test.js`
    - Direct regression coverage proving unchanged Phase 13 SSOT behavior, including continued non-use of legacy obligations for baseline derivation.
  - `src/tests/tradeMachine/draftPicksPreflight.test.js`
    - Direct regression coverage proving unchanged swap-handling and frozen-pick-related Stepien behavior on the live rule surface.
  - `tests/tradeValidator.test.js`
    - Authoritative validator-path coverage proving unchanged Stepien blocker propagation through top-level legality / reason / violations and `team.rules.stepienRule`.
  - `tests/tradeValidatorEdgeCases.test.js`
    - Authoritative validator-path coverage proving unchanged entitlements-backed Stepien blocker behavior through `validateTrade()`.
  - `tests/trade/frozenPick_consequences.test.js`
    - Authoritative validator-path coverage proving unchanged frozen-pick consequence behavior.
  - `npm run validate:project`
    - Proves the final file layout still satisfies repo structural validation.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot ...`: PASS (8 files, 138 tests)
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason skipped:
  - E29 is a narrow authoritative Stepien-rule migration slice. The direct Stepien suites, authoritative validator-path Stepien assertions, typecheck, and project-structure validation provided direct proof of behavior preservation without broadening into unrelated validation areas.

## 7. Remaining TS Migration Queue
- Based on the actual post-E29 state, `src/features/architect/utils/tradeMachine/rules/rosterValidation.js` is a likely next TS migration slice.
- Why it is the best likely next step:
  - it remains live JS roster-enforcement logic imported directly by `tradeValidator.ts`
  - it still contains business logic rather than a shim-only surface
  - it is adjacent to the same authoritative validator path without broadening into UI or persistence code
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the actual post-E29 dependency graph or risk profile makes it the better next slice.

## 8. Master Doc Update
- Added `Validator TS Validate Stepien E29 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `validateStepien` surface now lives in `rules/validateStepien.ts`.
- Recorded that `rules/validateStepien.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent Stepien semantics remained unchanged, including the raw string-array contract, exact message text/order, entitlements SSOT baseline behavior, outgoing entitlement warnings, swap reservation behavior, 7-year limit behavior, second-apron frozen-pick behavior, and `_debug` output.
- Recorded that targeted parity now includes authoritative `validateTrade()` assertions proving unchanged Stepien blocker propagation through both team-level `rules.stepienRule` semantics and the top-level legality effect.
- Recorded that the next TS slice should be chosen from the actual post-E29 holdouts, with `rules/rosterValidation.js` noted as a likely candidate rather than a hardcoded requirement.
