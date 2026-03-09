# TM_VALIDATOR_TS_VALIDATE_PLAYER_ROUTING_E26 — EXECUTION RETURN PACKAGE

## 1. Summary
- Migrated the authoritative `validatePlayerRouting` rule surface from `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js` to `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.ts`.
- Behavior was preserved: duplicate detection, 3+ team destination requirements, destination-resolution precedence, invalid-destination blocking, self-route blocking, exact message text/order, fail-fast routing semantics, and the existing `{ valid, errors, warnings }` and `{ pass, errors, warnings }` contracts remained unchanged.
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js` remains JS only as a pure compatibility shim so existing `.js` imports stay stable. The adjacent live cross-trade rule `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` remained JS because migrating it here would have broadened E26 beyond the requested player-routing slice.

## 2. Files Changed
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.ts`
  - Added the authoritative TS implementation for the live player-routing rule surface.
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js`
  - Reduced to a pure compatibility re-export shim with no remaining business logic.
- `src/tests/trade/playerRouting.test.js`
  - Preserved direct `.js` import coverage and added minimal parity assertions for the default export and `enforcePlayerRouting`.
- `tests/tradeValidatorEdgeCases.test.js`
  - Added an authoritative fail-fast validator assertion proving unchanged top-level `PLAYER_ROUTING_ERROR` handling and no downstream team-rule result generation before return.
- `docs/architect/TRADE_MACHINE_MASTER.md`
  - Added the indexed E26 migration entry and recorded the post-E26 player-routing rule state.
- `return_packages/trade_machine/TM_VALIDATOR_TS_VALIDATE_PLAYER_ROUTING_E26_RETURN_PACKAGE.md`
  - Added this execution return package.

## 3. Types Introduced or Hardened
- `TeamIdentifierValue`
  - Represents the narrow string/number/null team identifier values already accepted by the routing rule.
  - Applies across team-id normalization, destination resolution, and duplicate/error message construction in `validatePlayerRouting.ts`.
- `TeamIdentifierLike`
  - Represents the team-id object surface already accepted by `normalizeTeamCode`.
  - Applies to `teamCode`, `id`, `code`, and `abbreviation` lookup in the authoritative player-routing path.
- `PlayerRoutingPlayer`
  - Represents the minimal player shape read by the rule.
  - Applies to `playerId`, `id`, `name`, `displayName`, `tradeTo`, `toTeamId`, and `destTeamId` access in the authoritative player-routing path.
- `PlayerRoutingTeamSlot`
  - Represents the minimal team-slot shape consumed by the rule.
  - Applies to active-team detection, team-id resolution, and `sends` traversal in `validatePlayerRouting.ts`.
- `PlayerRoutingParams`, `PlayerRoutingResult`, and `PlayerRoutingContext`
  - Represent the direct validator and enforcer entrypoint contracts.
  - Apply to the canonical `validatePlayerRouting({ teams })` surface and the `enforcePlayerRouting(ctx)` fail-fast adapter without widening broader validator result types.

## 4. Migration Work Completed
- `rules/validatePlayerRouting.ts`
  - Ported the live rule behavior 1:1 from JS to TS with narrow file-local types only.
  - Preserved:
    - `normalizeTeamCode` precedence and 3-character uppercase behavior
    - `resolveTeamId` fallback order ending at `team-${index}`
    - `resolvePlayerDestination` alias precedence `tradeTo -> toTeamId -> destTeamId`
    - `getPlayerKey` precedence `playerId -> id -> name/displayName + fromTeamId`
    - duplicate-across-teams and duplicate-within-team detection order
    - 3+ team destination requirement behavior
    - invalid-destination and self-route blocker behavior
    - exact error text, ordering, and empty-warning-array behavior
    - direct return shape `{ valid, errors, warnings }`
  - Minimal contract correction required by typing:
    - none in runtime behavior; file-local types were sufficient.
- `rules/validatePlayerRouting.js`
  - Converted to a shim-only compatibility export.
  - Hard rule satisfied: no business logic remains in the JS file after E26.
- Direct parity coverage
  - Preserved the direct `.js` import path in `src/tests/trade/playerRouting.test.js` and added minimal assertions proving named export, default export, and `enforcePlayerRouting` parity through the shim.
- Authoritative validator-path parity
  - Added a focused `validateTrade()` assertion proving a 3-team player-routing failure still returns the fail-fast top-level contract before downstream team-rule evaluation:
    - `error === 'PLAYER_ROUTING_ERROR'`
    - `reason` equals the first routing error string
    - normalized top-level violations surface with rule `playerRouting`
    - `teamResults` and `summaryByTeamIndex` remain empty because the validator returns before per-team rule evaluation

## 5. JS Holdouts
- `src/features/architect/utils/tradeMachine/rules/validatePlayerRouting.js`
  - Remains JS only as the required pure compatibility shim for stable `.js` imports.
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js`
  - Remains JS because it is an adjacent live cross-trade routing rule, but migrating it here would have broadened E26 beyond the requested player-routing slice.

## 6. Regression Coverage Run
- Commands run:
  - `npm run typecheck`
  - `npm run test:node -- --reporter=dot src/tests/trade/playerRouting.test.js tests/tradeValidatorEdgeCases.test.js src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`
  - `npm run validate:project`
- What real behavior they prove:
  - `npm run typecheck`
    - Proves the new TS-backed `validatePlayerRouting` surface compiles cleanly against the existing JS/TS validator graph while preserving the `.js` engine import path.
  - `src/tests/trade/playerRouting.test.js`
    - Direct rule coverage proving unchanged 3+ destination requirements, 2-team fallback behavior, invalid destination blocking, self-route blocking, duplicate detection, empty/inactive-team early returns, and `.js` shim parity for named/default/enforcement exports.
  - `tests/tradeValidatorEdgeCases.test.js`
    - Proves the authoritative `validateTrade()` path still fails fast on player-routing errors with `PLAYER_ROUTING_ERROR`, first-error `reason`, normalized top-level `playerRouting` violations, and no downstream team-rule result generation before return.
  - `src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`
    - Preserves existing authoritative guardrail coverage that 3+ team sign-and-trade flows still surface `PLAYER_ROUTING_ERROR` when destination routing is missing.
  - `npm run validate:project`
    - Proves the final file layout still satisfies repo structural validation after adding `validatePlayerRouting.ts`.
- Results:
  - `npm run typecheck`: PASS
  - `npm run test:node -- --reporter=dot src/tests/trade/playerRouting.test.js tests/tradeValidatorEdgeCases.test.js src/tests/tradeMachine/signAndTrade.failClosed.guardrail.test.ts`: PASS (3 files, 30 tests)
  - `npm run validate:project`: PASS
- Commands intentionally skipped:
  - `npm run build`
  - `npm run test:diff -- --reporter=dot`
  - `npm run test:trade -- --reporter=dot`
  - `npm run test:architect -- --reporter=dot`
  - full-suite commands
- Reason skipped:
  - E26 is a narrow validator-rule migration slice. The targeted direct-rule, authoritative validator-path, existing fail-fast guardrail, and structural validation commands gave direct proof of behavior preservation without broadening into unrelated suites.

## 7. Remaining TS Migration Queue
- Based on the actual post-E26 state, `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` is the best likely next TS migration slice.
- Why it is the best likely next step:
  - it remains live JS cross-trade routing logic imported directly by `tradeValidator.ts`
  - it has no TS-backed counterpart yet
  - it is adjacent to the same fail-fast routing stage completed in E26 and can be migrated without widening into UI or persistence code
- This is not mandatory:
  - another remaining live JS holdout should be chosen instead if the actual post-E26 dependency graph or risk profile makes it the better next slice.

## 8. Master Doc Update
- Added `Validator TS Validate Player Routing E26 (2026-03-09)` to `docs/architect/TRADE_MACHINE_MASTER.md`.
- Recorded that the authoritative `validatePlayerRouting` surface now lives in `rules/validatePlayerRouting.ts`.
- Recorded that `rules/validatePlayerRouting.js` is now a pure compatibility re-export shim with no remaining business logic.
- Recorded that validator-adjacent player-routing semantics remained unchanged, including duplicate detection order, 3+ destination requirements, destination-resolution precedence, invalid-destination blocking, self-route blocking, exact message text/order, and the existing validator/enforcer return contracts.
- Recorded that targeted parity now includes direct `.js` shim coverage plus an authoritative `validateTrade()` fail-fast assertion proving unchanged `PLAYER_ROUTING_ERROR`, first-error `reason`, normalized top-level `playerRouting` violations, and no downstream team-rule result set before early return.
- Recorded that the next TS slice should be chosen from the actual post-E26 holdouts, with `rules/validateEntitlementRouting.js` noted as the best likely candidate rather than a hardcoded requirement.
