# TM_VALIDATOR_TS_STEPIEN_ENTITLEMENT_UTILS_E28 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the canonical `stepienEntitlementUtils` helper surface from `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js` to `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.ts`.
- Behavior was preserved: Stepien-relevant entitlement filtering, pick-like output shaping, baseline shaping, strict post-trade entitlement routing, duplicate incoming routing detection, and incoming `holderTeam` reassignment all remain unchanged.
- No directly related business-logic area had to remain JS in this slice. `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js` remains JS only as the required pure compatibility re-export shim for `.js` import stability.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.ts`
  - Added the authoritative TypeScript implementation for the live Stepien entitlement helper surface.
- `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `tests/entitlements/entitlementTrading.test.js`
  - Added narrow import-stability parity coverage proving extensionless and `.js` imports resolve to the same helper exports.
- `src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts`
  - Added a validator-adjacent wiring assertion proving `validateTrade()` still routes through `computePostTradeEntitlements` with the expected post-trade entitlement context and participant set.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E28 migration entry and recorded the post-E28 helper state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_STEPIEN_ENTITLEMENT_UTILS_E28_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `StepienEntitlementLike`
  - Represents the narrow entitlement shape this helper actually reads and returns.
  - Keeps entitlement identifiers string-based to match the live exclusivity consumer contract without widening downstream types.
  - Applies across Stepien filtering, pick-like shaping, and post-trade entitlement computation in `stepienEntitlementUtils.ts`.
- `StepienOutgoingEntitlementPick`
  - Represents the pick-like object returned by `buildStepienOutgoingPicksFromEntitlements`.
  - Applies in the authoritative helper path used by `validateStepien.js`.
- `StepienBaselineEntitlementPick`
  - Represents the baseline pick-like object returned by `buildStepienBaselinePicksFromEntitlements`.
  - Applies in the authoritative entitlement-baseline path consumed by `validateStepien.js`.
- `ComputePostTradeEntitlementsParams`
  - Represents the direct parameter contract for `computePostTradeEntitlements`.
  - Applies in the live `tradeValidator.ts` exclusivity and post-trade entitlement computation path.

## 4. Migration Work Completed
- `utils/stepienEntitlementUtils.ts`
  - Ported the live helper surface 1:1 from JS to TS with file-local types only.
  - Preserved:
    - first-round acceptance for `1`, `'1st'`, and `'first'`
    - relevant-kind filtering to `pick_ownership`, `swap_right`, and `conveyance_right`
    - pooled-entitlement exclusion
    - `seasonYear || year` year resolution
    - swap defaulting to `terms.swap?.swapType || 'best_of'`
    - outgoing and baseline metadata fields
    - stable filter/map output ordering
    - current-minus-outgoing then append-incoming post-trade entitlement ordering
    - exact strict-routing error text
    - 2-team missing-`toTeamId` fallback behavior
    - duplicate incoming routing detection
    - `holderTeam: teamId` reassignment on incoming entitlements
  - Minimal contract correction required by typing:
    - tightened local entitlement identifier typing to `string` so `computePostTradeEntitlements` remains directly assignable to the existing exclusivity-validator consumer contract without changing runtime behavior.
- `utils/stepienEntitlementUtils.js`
  - Converted to a shim-only compatibility export.
  - Hard rule satisfied: no business logic remains in the JS file after E28.
- Direct parity coverage
  - Preserved extensionless imports and added direct `.js` shim parity assertions in `tests/entitlements/entitlementTrading.test.js`.
- Validator-adjacent parity coverage
  - Added a narrow `validateTrade()` assertion in `src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts` proving the shim-backed `computePostTradeEntitlements` call still receives the expected team id, empty entitlement inventories, all-teams entitlement routing array, and `tradeParticipantIds` set.

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js`
  - Remains JS only as the required pure compatibility re-export shim for stable `.js` imports and existing `vi.mock(...stepienEntitlementUtils.js)` interception.
- `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
  - Remains JS in this pass because migrating the live Stepien rule surface would broaden E28 beyond the requested helper-only slice.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot tests/validators/stepienEntitlements.test.js tests/validators/stepienEntitlementBaseline.test.js tests/entitlements/entitlementTrading.test.js src/tests/architect/tradeEntitlementExclusivity.test.ts src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the new TS-backed helper surface compiles cleanly against the existing JS/TS validator graph while preserving `.js` consumer imports.
  - `tests/validators/stepienEntitlements.test.js`
    - Direct helper and Stepien-integration coverage proving unchanged Stepien-relevant entitlement filtering, output shaping, warnings, and validation behavior.
  - `tests/validators/stepienEntitlementBaseline.test.js`
    - Direct baseline coverage proving unchanged entitlement-baseline reservation behavior.
  - `tests/entitlements/entitlementTrading.test.js`
    - Direct post-trade helper coverage proving unchanged outgoing removal, incoming addition, holder reassignment, and `.js` import stability.
  - `src/tests/architect/tradeEntitlementExclusivity.test.ts`
    - Validator-adjacent post-trade entitlement coverage proving unchanged exclusivity inputs after helper computation.
  - `src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts`
    - Authoritative validator-path coverage proving unchanged `validateTrade()` wiring through `computePostTradeEntitlements`, continued `.js` shim mock interception, and unchanged fail-closed exclusivity behavior when post-trade entitlement computation fails.
  - `npm run validate:project`
    - Proves the final file layout still satisfies repo structural validation after adding `stepienEntitlementUtils.ts`.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot tests/validators/stepienEntitlements.test.js tests/validators/stepienEntitlementBaseline.test.js tests/entitlements/entitlementTrading.test.js src/tests/architect/tradeEntitlementExclusivity.test.ts src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts`: PASS
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - `npm run build`
- Reason skipped:
  - E28 is a narrow helper migration slice. The direct helper, baseline, import-stability, exclusivity-integration, validator-adjacent fail-path, typecheck, and structural validation commands provide direct proof of behavior preservation without broadening into unrelated suites.

## 7. Remaining TS Migration Queue
- Based on the actual post-E28 state, the next TS slice should be selected from the remaining live JS validator surfaces rather than hardcoded in advance.
- `src/features/architect/utils/tradeMachine/rules/validateStepien.js` is a likely next candidate because it remains live JS Stepien rule logic imported directly by `tradeValidator.ts` and now sits immediately on top of the TS-backed `stepienEntitlementUtils` helper surface.
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the actual post-E28 dependency graph or risk profile makes it the better next slice.

## 8. Master Doc Update
- Added `Validator TS Stepien Entitlement Utils E28 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `stepienEntitlementUtils` surface now lives in `utils/stepienEntitlementUtils.ts`.
- Recorded that `utils/stepienEntitlementUtils.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent Stepien and post-trade entitlement semantics remained unchanged.
- Recorded that targeted parity now includes direct `.js` import-stability assertions plus authoritative `validateTrade()` wiring assertions through the shim-backed helper surface.
- Recorded that the next best TS slice should be selected from the actual post-E28 holdouts, with `rules/validateStepien.js` noted as a likely candidate rather than a hardcoded requirement.
