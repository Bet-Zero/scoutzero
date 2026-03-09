# TM_VALIDATOR_TS_VALIDATE_ENTITLEMENT_ROUTING_E27 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative `validateEntitlementRouting` rule surface from `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` to `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.ts`.
- Behavior was preserved: entitlement duplicate detection, 3+ team destination requirements, destination validation, self-route blocking, ownership validation, linkage/residual blocking, exact message text/order, warning emission, and the existing `{ valid, errors, warnings }` and `{ pass, errors, warnings }` contracts remained unchanged.
- No business-logic area had to remain JS in this slice. `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` remains JS only as the required pure compatibility shim for existing `.js` imports.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.ts`
  - Added the authoritative TS implementation for entitlement routing, linkage legality, and enforcement parity.
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `src/tests/architect/tradeEntitlementRouting.test.ts`
  - Added direct `.js` shim parity assertions for default export and `enforceEntitlementRouting`, and tightened linkage fail-fast coverage expectations.
- `tests/trade/validatorContractCleanup.test.js`
  - Added an authoritative fail-fast validator assertion proving unchanged top-level `ENTITLEMENT_LINKAGE_ERROR` handling before downstream team-rule evaluation.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E27 migration entry and recorded the post-E27 entitlement-routing state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATE_ENTITLEMENT_ROUTING_E27_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `TeamIdentifierValue` and `TeamIdentifierLike`
  - Represent the narrow team identifier values and object shapes already accepted by entitlement-routing normalization.
  - Apply across team-id normalization, destination resolution, and message construction in the authoritative routing/linkage path.
- `EntitlementIdentifier`
  - Represents the accepted entitlement identity values already used by routing and linkage logic.
  - Applies to duplicate detection, ownership checks, known-entitlement maps, and linked-package enforcement.
- `EntitlementRoutingEntitlement`
  - Represents the minimal outgoing/known entitlement shape read by the rule surface.
  - Applies to `entitlementId`, `id`, `toTeamId`, `linkedEntitlementIds`, and `residualOfEntitlementId` access in `validateEntitlementRouting.ts`.
- `EntitlementRoutingTeam` and `EntitlementRoutingTeamSlot`
  - Represent the minimal team/team-slot shape consumed by the live rule surface.
  - Apply to active-team detection, ownership resolution, outgoing entitlement traversal, and known-entitlement collection.
- `EntitlementRoutingParams`, `EntitlementRoutingResult`, `EntitlementRoutingContext`, and `EntitlementRoutingEnforcementResult`
  - Represent the direct validator and enforcer entrypoint contracts.
  - Apply to the canonical `validateEntitlementRouting({ teams })`, `validateEntitlementLinkageLegality({ teams })`, and `enforceEntitlementRouting(ctx)` surfaces without widening broader validator types.

## 4. Migration Work Completed
- `rules/validateEntitlementRouting.ts`
  - Ported the live entitlement-routing and linkage logic 1:1 from JS to TS with narrow file-local types only.
  - Preserved:
    - `normalizeTeamCode` precedence and 3-character uppercase behavior
    - entitlement id resolution precedence `entitlementId -> id`
    - linked-id normalization and de-duplication behavior
    - known-entitlement map construction order `validationEntitlements -> entitlementsOut`
    - duplicate-across-teams entitlement detection
    - 3+ team destination requirement behavior
    - invalid-destination and self-route blocker behavior
    - ownership blocker behavior
    - linked-package completeness and residual-reference blocker behavior
    - exact error text, ordering, and warning behavior
    - direct return shapes `{ valid, errors, warnings }` and `{ pass, errors, warnings }`
  - Minimal contract correction required by typing:
    - none in runtime behavior; file-local types were sufficient.
- `rules/validateEntitlementRouting.js`
  - Converted to a shim-only compatibility export.
  - Hard rule satisfied: no business logic remains in the JS file after E27.
- Direct parity coverage
  - Preserved the direct `.js` import path in `src/tests/architect/tradeEntitlementRouting.test.ts` and added minimal assertions proving named export, default export, and enforcement parity through the shim.
- Authoritative validator-path parity
  - Preserved the existing fail-fast entitlement-routing contract assertion and added an entitlement-linkage companion assertion in `tests/trade/validatorContractCleanup.test.js` proving `validateTrade()` still returns before downstream team-rule evaluation with:
    - `error === 'ENTITLEMENT_ROUTING_ERROR'` or `error === 'ENTITLEMENT_LINKAGE_ERROR'`
    - `reason` equal to the first surfaced violation
    - normalized top-level `entitlementRouting` / `entitlementLinkage` violations
    - preserved top-level warnings for routing and empty `teamResults` / `summaryByTeamIndex` on early return

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js`
  - Remains JS only as the required pure compatibility shim for stable `.js` imports.
- No directly required business-logic dependency had to remain JS for the E27 entitlement-routing surface itself.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot src/tests/architect/tradeEntitlementRouting.test.ts src/tests/architect/phase17_entitlement_routing_guardrail.test.js tests/trade/validatorContractCleanup.test.js`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the new TS-backed entitlement-routing surface compiles cleanly against the existing JS/TS validator graph while preserving the `.js` engine import path.
  - `src/tests/architect/tradeEntitlementRouting.test.ts`
    - Direct rule coverage proving unchanged linkage legality behavior and `.js` shim parity for named/default/enforcement exports.
  - `src/tests/architect/phase17_entitlement_routing_guardrail.test.js`
    - Direct routing guardrail coverage proving unchanged 3+ destination requirements, duplicate entitlement blocking, invalid destination blocking, self-route blocking, 2-team fallback behavior, and ownership validation.
  - `tests/trade/validatorContractCleanup.test.js`
    - Proves the authoritative `validateTrade()` path still fails fast on entitlement routing and entitlement linkage errors with canonical top-level contracts, normalized issue metadata, first-error `reason`, warning preservation where applicable, and no downstream team-rule result generation before return.
  - `npm run validate:project`
    - Proves the final file layout still satisfies repo structural validation after adding `validateEntitlementRouting.ts`.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/architect/tradeEntitlementRouting.test.ts src/tests/architect/phase17_entitlement_routing_guardrail.test.js tests/trade/validatorContractCleanup.test.js`: PASS (3 files, 34 tests)
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason skipped:
  - E27 is a narrow validator-rule migration slice. The targeted direct-rule, guardrail, authoritative validator-path, and structural validation commands gave direct proof of behavior preservation without broadening into unrelated suites.

## 7. Remaining TS Migration Queue
- Based on the actual post-E27 state, the next TS slice should be selected from the remaining live JS validator surfaces rather than hardcoded in advance.
- `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js` is a likely next candidate because it remains live entitlement logic imported directly by `tradeValidator.ts`.
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the actual post-E27 dependency graph or risk profile makes it the better next slice.

## 8. Master Doc Update
- Added `Validator TS Validate Entitlement Routing E27 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `validateEntitlementRouting` surface now lives in `rules/validateEntitlementRouting.ts`.
- Recorded that `rules/validateEntitlementRouting.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent entitlement-routing semantics remained unchanged, including duplicate detection, 3+ destination requirements, destination validation, self-route blocking, ownership validation, linkage/residual blockers, exact message text/order, warning emission, and the existing validator/enforcer return contracts.
- Recorded that targeted parity now includes direct `.js` shim coverage plus authoritative `validateTrade()` fail-fast assertions proving unchanged `ENTITLEMENT_ROUTING_ERROR` and `ENTITLEMENT_LINKAGE_ERROR`, first-error `reason`, normalized top-level routing/linkage violations, warning preservation, and empty `teamResults` / `summaryByTeamIndex` before early return.
- Recorded that the next TS slice should be selected from the actual post-E27 holdouts, with `utils/stepienEntitlementUtils.js` noted as a likely candidate rather than a hardcoded requirement.
