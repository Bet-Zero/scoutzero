# ENTITLEMENTS_E2E_E3_EXECUTION_RETURN_PACKAGE

Date: 2026-02-25  
Mode: EXECUTION  
Source of truth: `docs/architect/ENTITLEMENTS_MASTER.md`

## Summary Of Changes
E3 hardening was implemented across the Entitlements stack to enforce fail-closed behavior in three areas:
1. Scope guardrails for league claim uniqueness validation.
2. Resolver invariant violations surfaced loudly (no silent dedupe masking).
3. Deterministic entitlement ID collision detection for create/duplicate-as-new and move new-ID writes.

## Scope Guardrail Design (R1)
### API / Contract
Updated `leagueClaimUniquenessGate.ts` with:
- `scopeMode: 'FULL_LEAGUE' | 'CUSTOM'`
- `scopeReason` required when `scopeMode === 'CUSTOM'`
- `LeagueClaimScopeReason` enum-string union (includes `PERF_SAFE_INDEXED_LOOKUP`)
- exported pure helper: `assertLeagueClaimGateScopeSafety(...)`

### Runtime Guardrails
`assertLeagueClaimGateScopeSafety(...)` enforces:
- `CUSTOM` without `scopeReason` throws.
- `teamCodes` provided without `scopeMode=CUSTOM` throws.
- Core write contexts reject `CUSTOM` scope (fail closed).

### Core Write Path Enforcement
These call sites now pass `scopeMode: 'FULL_LEAGUE'` explicitly:
- `saveEntitlementFromFormState.ts` (`ENTITLEMENT_SAVE`)
- `leagueInvariants.ts` trade apply (`WORLD_TRADE_APPLY`)
- `moveWorldEntitlement.ts` (`ENTITLEMENT_MOVE`)
- DARE seam in `entitlementMutator.ts` asserts `FULL_LEAGUE` before league evaluator.

## Resolver Invariant Violation Behavior (R2)
### No Silent Dedupe Policy
Removed resolver list-level identity dedupe from:
- `src/features/architect/utils/entitlements/entitlementResolver.ts`

### New Loud Failure Surface
Added:
- `EntitlementInvariantError`
- code: `ENTITLEMENT_INVARIANT_VIOLATION`
- structured details:
  - `teamCode`
  - `worldId`
  - `kind` (`DUPLICATE_ENTITLEMENT_ID`, `DUPLICATE_IDENTITY_KEY`, `CONFLICTING_LAYER_IDENTITY`)
  - `entitlementIds` / `identityKey` / `conflictingIdentityKeys`
  - `layerProvenance` (base vs parent/child world layers)

### Where It Blocks
- Save path: resolver errors are already fail-closed via exclusivity validation catch path.
- Trade apply: resolver errors return invalid trade apply exclusivity result.
- Move path: resolver/pre-commit validation errors return failure.
- Season advance DARE persistence:
  - invariant violations now treated as blocking and fail season advance loudly.

## Deterministic ID Collision Behavior (R3)
### Collision Definition
Collision is raised when:
- target deterministic `entitlementId` already exists in world entitlements, and
- existing identity key differs from incoming identity key.

### Implementation
In `entitlementWriter.ts`:
- Added `EntitlementIdCollisionError` (`ENTITLEMENT_ID_COLLISION`).
- Added shared helper `assertNoEntitlementIdCollision(...)`.
- `writeWorldEntitlementAndAttachToTeamAtomic(...)` now checks existing target doc inside transaction and blocks on collision before writes.

In `moveWorldEntitlement.ts`:
- Added pre-commit collision check for `toId` (new-ID moves).
- Returns `errorType: 'ENTITLEMENT_ID_COLLISION'` on collision.

In `saveEntitlementFromFormState.ts`:
- Extended `SaveEntitlementResult.errorType` with `'COLLISION'`.
- Maps writer collision failures to `errorType: 'COLLISION'`.

### Error Shapes
- Writer result:
  - `success: false`
  - `errorType: 'ENTITLEMENT_ID_COLLISION'`
  - `error: ...ENTITLEMENT_ID_COLLISION...`
- Save result:
  - `success: false`
  - `errorType: 'COLLISION'`
  - `error: ...ENTITLEMENT_ID_COLLISION...`

## Tests Added / Updated
### Added
- `src/tests/entitlements/entitlementResolver.invariantViolation.test.ts`
  - duplicate identity key throws invariant violation
  - duplicate entitlement ID throws invariant violation
  - parent/child layer identity conflict throws with layer provenance
- `src/tests/architect/entitlementWriter.collision.test.ts`
  - collision blocks atomic create+attach
  - same identity remains idempotent
- `src/tests/architect/leagueInvariants.tradeApplyScope.test.ts`
  - trade apply passes `scopeMode: 'FULL_LEAGUE'` to league gate

### Updated
- `src/tests/architect/leagueClaimUniquenessGate.test.ts`
  - CUSTOM without reason throws
  - core context + CUSTOM throws
  - FULL_LEAGUE + teamCodes throws
- `src/tests/architect/saveEntitlementExclusivity.test.ts`
  - asserts save gate call uses `scopeMode: 'FULL_LEAGUE'`
  - collision error mapping to `errorType: 'COLLISION'`
- `src/tests/architect/entitlementIdentityMove.test.ts`
  - asserts move gate call uses `scopeMode: 'FULL_LEAGUE'`
  - move collision test blocks pre-transaction
- `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js`
  - season advance blocks when resolver raises invariant violation

## Files Changed
- `src/features/architect/utils/entitlements/leagueClaimUniquenessGate.ts`
- `src/features/architect/admin/saveEntitlementFromFormState.ts`
- `src/features/architect/utils/leagueInvariants.ts`
- `src/features/architect/utils/entitlements/moveWorldEntitlement.ts`
- `src/features/architect/utils/entitlements/dare/entitlementMutator.ts`
- `src/features/architect/utils/entitlements/entitlementIdentity.ts`
- `src/features/architect/utils/entitlements/entitlementWriter.ts`
- `src/features/architect/utils/entitlements/entitlementResolver.ts`
- `src/features/architect/utils/seasonManager.js`
- `src/tests/architect/leagueClaimUniquenessGate.test.ts`
- `src/tests/architect/saveEntitlementExclusivity.test.ts`
- `src/tests/architect/entitlementIdentityMove.test.ts`
- `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js`
- `src/tests/architect/leagueInvariants.tradeApplyScope.test.ts`
- `src/tests/architect/entitlementWriter.collision.test.ts`
- `src/tests/entitlements/entitlementResolver.invariantViolation.test.ts`
- `docs/architect/ENTITLEMENTS_MASTER.md`
- `return_packages/entitlements/ENTITLEMENTS_E2E_E3_EXECUTION_RETURN_PACKAGE.md`

## Validation Outputs
### Focused command
`npm run test:node -- src/tests/architect/leagueClaimUniquenessGate.test.ts src/tests/architect/saveEntitlementExclusivity.test.ts src/tests/architect/entitlementIdentityMove.test.ts src/tests/entitlements/entitlementResolver.invariantViolation.test.ts src/tests/architect/entitlementWriter.collision.test.ts src/tests/architect/leagueInvariants.tradeApplyScope.test.ts --reporter=dot`
- Result: PASS
- Test Files: `6 passed`
- Tests: `40 passed`

### Required command 1
`npm run test:architect -- --reporter=dot`
- Result: PASS
- Test Files: `129 passed`
- Tests: `2192 passed | 1 skipped | 3 todo`

### Required command 2
`npm run test:trade -- --reporter=dot`
- Result: FAIL (baseline pre-existing failures preserved)
- Test Files: `2 failed | 49 passed`
- Tests: `3 failed | 495 passed | 1 skipped | 3 todo`
- Failing tests:
  - `tests/tradeValidator.test.js` (`handles 3-team trades correctly`)
  - `tests/tradeValidatorEdgeCases.test.js` (`allows 3-team trade mixing players, picks and cash when below aprons`)
  - `tests/tradeValidatorEdgeCases.test.js` (`blocks second apron teams receiving more salary than sent`)

### Required command 3
`npm run build`
- Result: PASS
- Output: production build completed

### Additional structural validation
`npm run validate:project`
- Result: PASS
- Output: `All validations passed`

## Commands Intentionally Skipped
- `npm run test:full` skipped because prompt did not include `RUN FULL SUITE`.
- `npm run lint` skipped because AGENTS policy says lint runs only when explicitly requested.
