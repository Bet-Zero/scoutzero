# ENTITLEMENTS_E2E_E2_EXECUTION_RETURN_PACKAGE

Date: 2026-02-25  
Mode: EXECUTION  
Source of truth: `docs/architect/ENTITLEMENTS_MASTER.md`  
Input review: `return_packages/entitlements/ENTITLEMENTS_E2E_DEEP_REVIEW_RETURN_PACKAGE.md`

## Scope Delivered (M1-M4)
This execution closes Majors M1-M4 by enforcing atomic world create, transactional/fail-loud move behavior, locked duplicate-as-new identity behavior, and blocking linked/residual legality in save + trade validation.

## Exact Files Changed
- `src/features/architect/utils/entitlements/entitlementWriter.ts`
- `src/features/architect/admin/saveEntitlementFromFormState.ts`
- `src/features/architect/utils/entitlements/moveWorldEntitlement.ts`
- `src/features/architect/admin/EntitlementEditorAdvancedTab.tsx`
- `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js`
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
- `src/tests/architect/saveEntitlementExclusivity.test.ts`
- `src/tests/architect/entitlementIdentityMove.test.ts`
- `src/tests/architect/vacuumE3.advancedEditorLock.test.tsx`
- `src/tests/architect/tradeEntitlementRouting.test.ts`
- `docs/architect/ENTITLEMENTS_MASTER.md`
- `return_packages/entitlements/ENTITLEMENTS_E2E_E2_EXECUTION_RETURN_PACKAGE.md`

## M1: Atomic Create + Team Attach (No Orphans)
### Implementation
- Added `writeWorldEntitlementAndAttachToTeamAtomic(...)` in `entitlementWriter.ts`.
- It uses one Firestore transaction to:
  1. write `architect_worlds/{worldId}/entitlements/{entitlementId}`
  2. `arrayUnion(entitlementId)` into `architect_worlds/{worldId}/teams/{holderTeam}.entitlementIds`
- Save create paths in `saveEntitlementFromFormState.ts` now route through this helper for:
  - `CREATE`
  - `DUPLICATE_AS_NEW`
- E1 gates still run before commit:
  - team exclusivity
  - league claim uniqueness

### Tests
- `saveEntitlementExclusivity.test.ts`
  - create path uses atomic helper
  - atomic helper failure path returns failure and does not fallback to non-atomic write

## M2: Move Atomic / Fail-Loud / Repairable
### Implementation
- Refactored `moveWorldEntitlement.ts` to transactional behavior only.
- Flow:
  1. resolve source holder team from `fromId`
  2. build post-move team states and run league claim uniqueness pre-gate
  3. execute one Firestore transaction for set/delete/team inventory updates
- No warning-only partial success remains; any failure returns `success: false`.

### Tests
- `entitlementIdentityMove.test.ts`
  - same-team identity move updates inventory remove+add in transaction
  - cross-team move updates source/destination inventories
  - claim uniqueness gate failure blocks pre-commit
  - transaction failure is fail-loud
  - unresolved source holderTeam fails loudly

## M3: Locked Decision Enforced (Duplicate-as-New)
### Trigger
In world edit mode, if deterministic identity changes (`entitlementId !== computedDeterministicId`), save mode becomes `DUPLICATE_AS_NEW`.

### Behavior
- Existing entitlement ID is not moved.
- Existing entitlement doc is not identity-mutated.
- Save creates a new entitlement doc/ID and atomically attaches it to the holder team.
- Result metadata now includes:
  - `saveOperation`
  - `createdNewEntitlement`
  - `originalEntitlementId`

### UI
- `EntitlementEditorAdvancedTab.tsx` no longer strips identity fields.
- If edit-mode JSON changes identity key, inline notice shows:
  - `This change requires creating a new entitlement...`

### Tests
- `saveEntitlementExclusivity.test.ts`
  - identity-changing edit returns `DUPLICATE_AS_NEW`
  - original ID preserved
  - new entitlement ID returned and persisted via atomic helper
- `vacuumE3.advancedEditorLock.test.tsx`
  - edit-mode identity delta surfaces duplicate-as-new notice text

## M4: Linked/Residual Integrity Is Blocking Legality
### Save-time Blocking
- `saveEntitlementFromFormState.ts` now validates linkage references in world mode before save:
  - each `linkedEntitlementIds[]` must resolve
  - `residualOfEntitlementId` must resolve
- Missing references return blocking `errorType: 'LINKAGE'`.

### Trade-time Blocking
- Added `validateEntitlementLinkageLegality(...)` in `validateEntitlementRouting.js`.
- `tradeValidator.js` now runs it as blocking pre-team validation.
- Failure returns:
  - `error: 'ENTITLEMENT_LINKAGE_ERROR'`
  - `legal: false`

### Linked Package Completeness Rule (Adopted)
- If an outgoing entitlement has non-empty `linkedEntitlementIds`, all linked IDs must also be outgoing in the same trade transaction.
- Partial linked-package movement is illegal.

### Tests
- `saveEntitlementExclusivity.test.ts`
  - save rejects missing linked/residual refs
- `tradeEntitlementRouting.test.ts`
  - rejects missing linked references
  - rejects missing residual target
  - rejects partial linked-package trade
  - passes complete linked-package trade
  - `validateTrade` integration returns `ENTITLEMENT_LINKAGE_ERROR`

## Validation Commands Run
### Focused
1. `npm run test:node -- src/tests/architect/saveEntitlementExclusivity.test.ts src/tests/architect/entitlementIdentityMove.test.ts src/tests/architect/vacuumE3.advancedEditorLock.test.tsx src/tests/architect/tradeEntitlementRouting.test.ts --reporter=dot`
- Result: PASS
- Output summary: `Test Files 3 passed`, `Tests 43 passed`
- Note: `vitest.node.config.js` ran the node-target suites from this list.

2. `npm run test:ui -- src/tests/architect/vacuumE3.advancedEditorLock.test.tsx --reporter=dot`
- Result: PASS
- Output summary: `Test Files 1 passed`, `Tests 5 passed`

### Required
1. `npm run test:trade -- --reporter=dot`
- Result: FAIL (pre-existing)
- Output summary: `Test Files 2 failed | 49 passed`, `Tests 3 failed | 495 passed | 1 skipped | 3 todo`
- Failing tests:
  - `tests/tradeValidator.test.js` (`handles 3-team trades correctly`)
  - `tests/tradeValidatorEdgeCases.test.js` (`allows 3-team trade mixing...`)
  - `tests/tradeValidatorEdgeCases.test.js` (`blocks second apron teams receiving more salary than sent`)

2. `npm run test:architect -- --reporter=dot`
- Result: PASS
- Output summary: `Test Files 127 passed`, `Tests 2183 passed | 1 skipped | 3 todo`

3. `npm run build`
- Result: PASS
- Output summary: production build completed (`built in 1m 21s`)

All required commands above were re-run after the final save-path TypeScript narrowing update.

### Additional Validation
- `npm run typecheck`
  - Result: FAIL (pre-existing branch-wide TS test typing debt and unrelated type issues)
  - No blocking new runtime regressions found in focused/architect suites.

## Commands Intentionally Skipped
- `npm run test:full` skipped because prompt did not include `RUN FULL SUITE` and AGENTS policy blocks full-suite default.
- `npm run lint` skipped because AGENTS policy says lint is only run when explicitly requested.

## Stop Conditions
- No stop condition was triggered in this pass:
  - No schema migration requirement was encountered for transactional atomicity.
  - No widespread legacy linked/residual breakage was surfaced by required suite execution.
