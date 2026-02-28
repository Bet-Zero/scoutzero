# TM_CAP_AUDITABILITY_E4 — EXECUTION RETURN PACKAGE

Date: 2026-02-28  
Ticket: `TM_CAP_AUDITABILITY_E4`  
Mode: EXECUTION

## 1) Executive Summary

Shipped E4 systems-safety + observability scope without changing cap/CBA math:

- Added deterministic optimistic-operation serialization for world optimistic cap handlers via fail-closed lock behavior.
- Added a dev-only GM Dashboard `Cap Audit Debug` panel for local base stream + world preview stream inspection and operation linkage checks.
- Added focused behavior tests proving serialization (block mode), lock engagement/release, and base-mode no-write invariant.
- Updated auditability and ship-gate docs with E4 status and new gates.

Hard-rule checks:

- No CBA/post-state validator rule changes.
- No new Firestore collections/paths.
- Preserved `no worldId = no Firestore writes` invariant.

## 2) Lock Behavior Decision

- Decision: **Block mode** (fail-closed, no queue).
- Scope key used: `architect_world_cap_mutation_lock:${worldId}`.
- Lock implementation:
  - `acquireOptimisticLock(scopeKey)` / `releaseOptimisticLock(scopeKey)` in `src/features/architect/GMDashboard/hooks/optimisticMutationLock.ts`.
- Covered handlers (via shared optimistic bridge):
  - `waivePlayer`
  - `extendPlayer`
  - `optionDecision`
  - `renounceRights`
  - `setDeadCap`
  - `setExceptions`
- Behavior:
  - If a world optimistic operation is in-flight, next optimistic operation is blocked with user-visible error and no state mutation.
  - Lock release is guaranteed on success/failure/error paths (`try/finally` + async `finally`).
  - Rollback remains operation-local by using each op’s captured pre-snapshot.

## 3) Files Changed

| File                                                                      | Change                                                                                                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`         | Added world optimistic lock gating in optimistic mutation bridge; fail-closed block message; ensured lock release on all paths while preserving rollback and base-mode behavior. |
| `src/features/architect/GMDashboard/hooks/optimisticMutationLock.ts`      | Added lock helper with acquire/release/inspect/reset APIs.                                                                                                                       |
| `src/features/architect/GMDashboard/components/CapAuditDebugPanel.tsx`    | Added dev-only audit viewer UI (base stream + world preview stream, linkage fields, refresh/clear/filter controls).                                                              |
| `src/features/architect/GMDashboard/GMDashboard.jsx`                      | Mounted dev-gated `CapAuditDebugPanel` in dashboard context.                                                                                                                     |
| `src/features/architect/GMDashboard/components/index.js`                  | Exported new debug panel + debug gate helpers.                                                                                                                                   |
| `src/tests/architect/worldOptimistic_lock_serialization.behavior.test.ts` | Added serialization behavior tests (lock in-flight block, lock release, base-mode no-write guard assertion).                                                                     |
| `docs/architect/CAP_AUDITABILITY_MASTER.md`                               | Added E4 execution status section (lock behavior + debug viewer + enablement).                                                                                                   |
| `docs/SHIP_GATES_MASTER.md`                                               | Added E4 gate bullets and E4 status update for serialization + dev viewer availability.                                                                                          |

## 4) Tests Added/Updated and What They Prove

### Added

- `src/tests/architect/worldOptimistic_lock_serialization.behavior.test.ts`

Proof coverage:

1. **Serialization/lock in-flight block**
   - Starts optimistic op A (`setDeadCap`) with delayed authoritative persist.
   - Confirms lock is engaged.
   - Triggers optimistic op B (`setExceptions`) while A is in-flight.
   - Asserts B is blocked (no second authoritative call, no second preview event, no concurrent local mutation).

2. **Lock release + forward progress**
   - Resolves op A authoritative persist.
   - Asserts lock released.
   - Verifies subsequent optimistic op can proceed.

3. **Base-mode no-write invariant retained**
   - In `worldId = null` mode, asserts optimistic handler path does not call authoritative world persist.

### Existing guardrails retained (no weakening/removal)

- `src/tests/architect/baseMode_no_firestore_writes.guardrail.test.ts`
- Existing E3 behavior tests remained intact.

## 5) Manual QA Steps

1. Open GM Dashboard in dev (`npm run dev`) with a world selected.
2. Trigger a world optimistic cap action (for example dead cap update) and immediately trigger another optimistic cap action.
3. Confirm second action is blocked with error toast while first is still saving.
4. Confirm first action completes and then subsequent action can be applied.
5. Force an authoritative failure path (dev/mock) and confirm rollback restores pre-snapshot state.
6. Open **Cap Audit Debug** panel (visible in dev by default).
7. Verify base stream shows entries when operating in base mode and world preview stream shows entries in world mode.
8. Verify world preview rows show linkage fields (`operationId`, `authoritativeEventLinked`) and validation counts.
9. Use Refresh + per-stream Clear buttons and confirm keys clear independently.
10. Set `localStorage.__ARCHITECT_DEBUG__ = "1"` and verify panel can be enabled behind debug flag.

## 6) Validation Commands and Outputs

Executed required commands exactly as requested:

1. `npm run test:node -- --run --reporter=dot`
   - Result: PASS
   - Summary: `Test Files 247 passed | 1 skipped (248)`; `Tests 3096 passed | 9 skipped | 3 todo (3108)`

2. `npm run test:ui -- --run --reporter=dot`
   - Result: PASS
   - Summary: `Test Files 35 passed (35)`; `Tests 373 passed | 2 skipped (375)`

3. `npm run build`
   - Result: PASS
   - Notes: Build completed successfully; emitted existing bundle-size/chunk warnings only.

4. `npm run validate:project`
   - Result: PASS
   - Summary: `All validations passed`.

### Commands intentionally skipped

- None.

## 7) Residual Risks / Follow-ups

1. Block mode prevents overlap but drops user intent for concurrent clicks; if product wants deferred execution, a queue mode could be introduced in a future ticket.
2. Debug panel reads local streams only (by design); it does not inspect Firestore authoritative events directly.
3. Lock scope is world-wide (`worldId`); if future UX needs per-team concurrency, scope can be narrowed to `worldId + teamCode` in a follow-up.
