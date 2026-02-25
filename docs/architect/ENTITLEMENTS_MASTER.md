# ENTITLEMENTS_MASTER

Last updated: 2026-02-25

## Overview

Entitlements are the canonical draft-asset rights layer for Architect (pick ownership, swap rights, conveyance rights). They are used by entitlement authoring, trade mutation apply, and DARE season-advance resolution.

Core invariants:

- Deterministic identity: one logical entitlement identity maps to one deterministic ID.
- Team exclusivity: a team cannot hold overlapping claims in its own entitlement set.
- League claim uniqueness: no two teams can hold the same underlying claim key.
- Resolver parity: entitlement resolution follows world -> parent world(s) -> base.
- Fail-closed writes: if a gate cannot validate, the write is blocked.

## Return Packages

- [ENTITLEMENTS_E2E_DEEP_REVIEW_RETURN_PACKAGE.md](../../return_packages/entitlements/ENTITLEMENTS_E2E_DEEP_REVIEW_RETURN_PACKAGE.md)
- [ENTITLEMENTS_E2E_E1_EXECUTION_RETURN_PACKAGE.md](../../return_packages/entitlements/ENTITLEMENTS_E2E_E1_EXECUTION_RETURN_PACKAGE.md)
- [ENTITLEMENTS_E2E_E2_EXECUTION_RETURN_PACKAGE.md](../../return_packages/entitlements/ENTITLEMENTS_E2E_E2_EXECUTION_RETURN_PACKAGE.md)
- [ENTITLEMENTS_E2E_E3_EXECUTION_RETURN_PACKAGE.md](../../return_packages/entitlements/ENTITLEMENTS_E2E_E3_EXECUTION_RETURN_PACKAGE.md)
- [TM_EXCL_E1_EXECUTION_RETURN_PACKAGE.md](../../return_packages/entitlements/TM_EXCL_E1_EXECUTION_RETURN_PACKAGE.md)
- [TM-EXCL-E6_EXECUTION_RETURN_PACKAGE.md](../../return_packages/entitlements/TM-EXCL-E6_EXECUTION_RETURN_PACKAGE.md)

## Ship Gates

- [x] B1. League-wide no-overlap claim enforcement (cross-team claim uniqueness)
- [x] B2. Stepien legality uses baseline + outgoing delta
- [x] B3. Entitlement resolver fallback aligned to world -> parent -> base
- [x] B4. DARE season-advance persistence routed through gated mutator path

## E1 (BLOCKERS B1-B4)

### Decisions Made

1. Added a shared league claim gate engine (`leagueClaimUniquenessGate.ts`) based on `computeEntitlementClaims` claim keys.
2. Enforced the gate on all required write paths (save, trade apply, move, DARE season advance).
3. Implemented fail-closed behavior for all new gate integrations.
4. Updated Stepien to evaluate consecutive-year legality on baseline + outgoing delta post-state.
5. Reworked entitlement resolver fallback chain to match team loader inheritance semantics.
6. Replaced season advance DARE persistence write path with gated mutator path.

### Invariants Enforced In E1

- Global claim uniqueness: for any claim key, at most one holder team in post-mutation state.
- Gate unavailability blocks persistence (`VALIDATION_UNAVAILABLE` / explicit blocking errors).
- Stepien consecutive-year violation detection considers baseline reservations plus outgoing trade effects.
- Parent-world inheritance applies consistently to both team entitlement IDs and entitlement override docs.
- Season advance cannot commit DARE writes that fail team exclusivity or league claim uniqueness checks.

### Known Limitations

- M1: World create flow can still orphan entitlement IDs if not attached to team inventory.
- M2: Identity move still has partial-failure success semantics on some downstream write steps.
- M3: Advanced editor identity lock remains incomplete vs full identity field surface.
- M4: Linked/residual package integrity still warning-level in key flows, not hard legality.

### Follow-up Tasks (Majors M1-M4)

- [x] M1: Make world create atomic for doc write + `team.entitlementIds` attach. (Closed in E2)
- [x] M2: Make identity move transactional/compensating and fail on partial write failure. (Closed in E2)
- [x] M3: Align advanced editor lock fields with `getEntitlementIdentityKey` by kind. (Closed in E2)
- [x] M4: Add hard linked/residual package integrity validator on save and pre-trade. (Closed in E2)

## E2 (MAJORS M1-M4)

### Decisions Made

1. Locked decision adopted: edit-mode identity-changing saves are prohibited from mutating/moving the original entitlement; they now execute as duplicate-as-new.
2. World create path now requires one atomic transaction that writes the entitlement doc and attaches the entitlement ID to holder team inventory.
3. Remaining move path (`moveWorldEntitlement`) is transactional and fail-loud; partial success no longer reports success.
4. Linked/residual integrity moved from warning-only to blocking legality on save and trade validation.
5. Linked package completeness is enforced for trades: if `linkedEntitlementIds` is non-empty, all linked IDs must be included in the same trade transaction.

### Invariants Strengthened In E2

- No orphan world creates: entitlement doc write and team `entitlementIds` attach commit together or fail together.
- No silent partial move success: move returns failure if any transactional step fails.
- Edit identity immutability: identity deltas in edit mode preserve original entitlement and create a new entitlement ID.
- Linked/residual legal integrity: missing linkage targets block save and block trade legality.
- Linked package atomic trade movement: partial movement of linked packages is illegal.

### Known Limitations

- Strict linkage enforcement can block operations on legacy worlds containing broken historical linked/residual references until repaired.
- Trade linkage completeness is currently unconditional when links exist (no policy escape hatch for partial movement scenarios).
- Duplicate-as-new introduces multiple semantically related entitlement docs; cleanup/deprecation remains a separate explicit action.

### Follow-ups

- [ ] Add repair tooling/report for legacy broken `linkedEntitlementIds` / `residualOfEntitlementId` references.
- [ ] Add optional policy flagging if product later needs controlled partial linked-package movement.
- [ ] Improve save UI receipt to always surface duplicate-as-new metadata and cross-link original/new IDs for audit workflows.

## E3 (HARDENING + TRUST EVIDENCE)

### Decisions Made

1. Added league-claim scope guardrails with explicit scope contract:
   - `scopeMode: FULL_LEAGUE | CUSTOM`
   - `scopeReason` required for `CUSTOM`
2. Enforced `scopeMode: FULL_LEAGUE` on core write paths:
   - entitlement save
   - world trade apply
   - entitlement move
   - DARE mutation persistence seam
3. Added resolver invariant error surface:
   - `ENTITLEMENT_INVARIANT_VIOLATION` with structured details (`teamCode`, `worldId`, invariant kind, identity/id payload, layer provenance).
4. Removed resolver silent identity dedupe behavior and replaced it with fail-loud invariant checks.
5. Added deterministic entitlement ID collision detection:
   - `ENTITLEMENT_ID_COLLISION` for create/duplicate-as-new and move new-ID writes when existing ID maps to a different identity.

### Guardrails Added

- Scope narrowing cannot happen accidentally:
  - `teamCodes` is rejected unless `scopeMode=CUSTOM`.
  - `CUSTOM` is rejected without `scopeReason`.
  - core write contexts reject `CUSTOM` even when `scopeReason` is provided.
- Resolver no-mask policy:
  - duplicate entitlement IDs in inventory/resolved sets now throw.
  - duplicate identity keys now throw.
  - conflicting identity across base/parent/child override layers now throw.
- Deterministic collision fail-closed policy:
  - existing doc at deterministic target ID with different identity blocks write and returns collision error.

### Invariants Enforced In E3

- Core claim-uniqueness gate scope is always full league.
- Resolver does not silently dedupe/merge away corruption.
- Deterministic ID collisions cannot overwrite existing mismatched identity records.
- Season advance treats resolver invariant violations as blocking in DARE persistence path.

### Validation Evidence

- Focused tests (E3-specific): PASS
  - `src/tests/architect/leagueClaimUniquenessGate.test.ts`
  - `src/tests/architect/saveEntitlementExclusivity.test.ts`
  - `src/tests/architect/entitlementIdentityMove.test.ts`
  - `src/tests/architect/entitlementWriter.collision.test.ts`
  - `src/tests/architect/leagueInvariants.tradeApplyScope.test.ts`
  - `src/tests/entitlements/entitlementResolver.invariantViolation.test.ts`
- `npm run test:architect -- --reporter=dot`: PASS
- `npm run test:trade -- --reporter=dot`: baseline FAIL (same 3 existing failures)
- `npm run build`: PASS
- `npm run validate:project`: PASS

### Known Limitations / Follow-ups

- `CUSTOM` scope exists for future non-core contexts, but all currently defined gate contexts are core write contexts and reject it by design.
- Collision checks fail closed when identity cannot be derived reliably from existing documents; this protects writes but can block legacy malformed records until repaired.
- Existing baseline `test:trade` failures remain unrelated to this E3 hardening pass.
