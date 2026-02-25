# ENTITLEMENTS_E2E_E1_EXECUTION_RETURN_PACKAGE

Date: 2026-02-25  
Mode: EXECUTION  
Source of truth: `docs/architect/ENTITLEMENTS_MASTER.md`  
Input audit: `return_packages/entitlements/ENTITLEMENTS_E2E_DEEP_REVIEW_RETURN_PACKAGE.md`

## 1) Summary Of What Changed
This execution closes blockers B1-B4 by adding enforced league-wide claim uniqueness, fixing Stepien baseline usage, aligning parent-world entitlement resolution, and gating DARE season-advance persistence.

Implemented:
- New league claim uniqueness gate utility:
  - `src/features/architect/utils/entitlements/leagueClaimUniquenessGate.ts`
- Save-path integration:
  - `src/features/architect/admin/saveEntitlementFromFormState.ts`
- Trade-apply integration:
  - `src/features/architect/utils/leagueInvariants.ts`
- Move-path integration:
  - `src/features/architect/utils/entitlements/moveWorldEntitlement.ts`
- DARE gated mutator + season-advance integration:
  - `src/features/architect/utils/entitlements/dare/entitlementMutator.ts`
  - `src/features/architect/utils/seasonManager.js`
  - `src/features/architect/utils/entitlements/dare/index.ts` (export surface)
- Resolver fallback alignment:
  - `src/features/architect/utils/entitlements/entitlementResolver.ts`
- Stepien baseline+delta legality:
  - `src/features/architect/utils/tradeMachine/rules/validateStepien.js`

## 2) Exact Invariant Enforced (And How)
Exact invariant:
- For any post-mutation world entitlement state, for every computed `claimKey`, the set of holder teams for that key has cardinality <= 1.

How enforced:
- Claim keys are computed via `computeEntitlementClaims(...)`.
- Cross-team duplicates are detected by `detectCrossTeamClaimConflicts(...)`.
- Enforcement result uses:
  - `CLAIM_UNIQUENESS_VIOLATION` when duplicates are found.
  - `VALIDATION_UNAVAILABLE` when validation cannot run.
- All integrations are fail-closed: unavailable validation blocks the write.

## 3) All Write Paths Now Gated (Explicit List)
1. Entitlement editor save (world/admin flow):
   - `saveEntitlementFromFormState(...)` runs team exclusivity and league claim uniqueness pre-write.
2. Trade apply (mutation pipeline):
   - `validateTradeApplyExclusivity(...)` in `leagueInvariants.ts` now runs:
     - team exclusivity gate
     - league claim uniqueness gate on post-trade sets
3. Entitlement move operations (identity move path):
   - `moveWorldEntitlement(...)` now runs league claim uniqueness pre-write.
4. Season advance DARE persistence:
   - `seasonManager.js` now routes through `applyGatedDAREResultsToBatch(...)` only.
   - `applyGatedDAREResultsToBatch(...)` enforces:
     - team exclusivity
     - league claim uniqueness using same shared gate engine

## 4) Stepien Changes + Tests Added
Code change:
- `validateStepien(...)` now evaluates consecutive-year legality using baseline + outgoing delta post-state, and only triggers a violation when the adjacent violating pair is touched by outgoing delta (pre-existing baseline-only shapes do not create false trade failures).

Tests:
- Updated/extended `tests/validators/stepienEntitlementBaseline.test.js`
- Added regression case:
  - `fails when baseline reserves year N and trade adds outgoing N+1 (regression)`

## 5) Parent-World Resolver Changes + Tests Added
Code change:
- `entitlementResolver.ts` now resolves world fallback chain as:
  - `world -> parent world(s) -> base`
- Applied consistently to:
  - Team `entitlementIds` resolution
  - Entitlement override doc merge resolution

Tests:
- Added `src/tests/entitlements/entitlementResolver.parentFallback.test.ts`
  - verifies child world inherits parent team IDs when child omits `entitlementIds`
  - verifies merge precedence parent then child for same entitlement ID

## 6) DARE Persistence Changes + Proof It Is Gated
Code change:
- `advanceSeasonInWorld(...)` now calls `applyGatedDAREResultsToBatch(...)` instead of ungated DARE write path.
- DARE gated mutator now:
  - fails closed if added entitlement docs are missing
  - includes updates-only doc mutations in gating scope
  - runs league-wide claim uniqueness using shared evaluator

Proof tests:
- `src/tests/architect/dareMutatorExclusivityGate.test.ts`
  - `blocks when post-DARE state creates cross-team claim conflict`
- `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js`
  - `fails season advance loudly when gated DARE persistence is blocked`

## 7) Acceptance Criteria Status
1. Cross-team duplicate claim save/create blocked: PASS.
2. Stepien baseline+delta regression case fails correctly: PASS.
3. Child-world entitlement inheritance matches team/world fallback behavior: PASS.
4. Season advance blocks invalid DARE persistence and fails loudly: PASS.
5. Required write paths (save/trade/move/DARE season advance) now pass gated checks: PASS.

## 8) Files Changed
- `src/features/architect/admin/saveEntitlementFromFormState.ts`
- `src/features/architect/utils/entitlements/dare/entitlementMutator.ts`
- `src/features/architect/utils/entitlements/dare/index.ts`
- `src/features/architect/utils/entitlements/entitlementResolver.ts`
- `src/features/architect/utils/entitlements/leagueClaimUniquenessGate.ts`
- `src/features/architect/utils/entitlements/moveWorldEntitlement.ts`
- `src/features/architect/utils/leagueInvariants.ts`
- `src/features/architect/utils/seasonManager.js`
- `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
- `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js`
- `src/tests/architect/dareMutatorExclusivityGate.test.ts`
- `src/tests/architect/entitlementIdentityMove.test.ts`
- `src/tests/architect/leagueClaimUniquenessGate.test.ts`
- `src/tests/architect/saveEntitlementExclusivity.test.ts`
- `src/tests/entitlements/entitlementResolver.parentFallback.test.ts`
- `tests/validators/stepienEntitlementBaseline.test.js`
- `docs/architect/ENTITLEMENTS_MASTER.md`
- `return_packages/entitlements/ENTITLEMENTS_E2E_E1_EXECUTION_RETURN_PACKAGE.md`

## 9) Validation Commands Run
Required commands:
1. `npm run test:trade`
   - Result: FAIL (pre-existing)
   - Test Files: `2 failed | 51 passed (53)`
   - Tests: `3 failed | 541 passed | 1 skipped | 3 todo (548)`
   - Duration: `75.30s`
2. `npm run test:architect`
   - Result: FAIL (pre-existing)
   - Test Files: `6 failed | 147 passed (153)`
   - Tests: `27 failed | 2414 passed | 3 skipped | 3 todo (2447)`
   - Duration: `175.55s`
3. `npm run build`
   - Result: PASS
   - Output: `✓ built in 45.22s`

Additional validation used to de-risk change set:
1. `npm run test:node -- tests/validators/stepienEntitlementBaseline.test.js src/tests/architect/saveEntitlementExclusivity.test.ts src/tests/architect/entitlementIdentityMove.test.ts src/tests/architect/dareMutatorExclusivityGate.test.ts src/tests/architect/leagueClaimUniquenessGate.test.ts src/tests/entitlements/entitlementResolver.parentFallback.test.ts src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js`
   - Result: PASS
   - Test Files: `7 passed`
   - Tests: `56 passed`
2. `npm run validate:project`
   - Result: PASS
   - Output: `All validations passed`
3. `npm run test:diff`
   - Result: FAIL (expected same pre-existing architect failures)
   - Test Files: `6 failed | 147 passed (153)`
   - Tests: `27 failed | 2414 passed | 3 skipped | 3 todo (2447)`
   - Duration: `206.51s`

## 10) Commands Intentionally Skipped
- `npm run lint` was skipped because AGENTS.md says lint is only run when explicitly requested and the repo has known baseline lint debt.
- `npm run test:full` was skipped because AGENTS.md blocks full suite unless prompt includes exact phrase `RUN FULL SUITE`.
