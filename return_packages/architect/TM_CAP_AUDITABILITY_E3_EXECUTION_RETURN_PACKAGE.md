# TM_CAP_AUDITABILITY_E3_EXECUTION_RETURN_PACKAGE

Date: 2026-02-28  
Mode: EXECUTION  
Scope: Base-mode local audit parity + world optimistic/local-first auditability safety

## Summary

E3 is implemented for the requested cap-changing gaps:

1. Base-mode (`worldId = null`) cap-changing actions now run `validatePostStateCapLegality(...)` and emit local `CapAuditEventV1`-shaped records.
2. World optimistic handlers now emit preview audit records before optimistic apply, correlate `operationId` with authoritative world mutation events, and rollback local state on authoritative failure.

No new Firestore collections/paths were introduced.

## Coverage Added

Base-mode paths now covered with post-state validator + local event emission:

- `executeTrade`
- `signFreeAgent`
- `waivePlayer`
- `extendPlayer`
- `optionDecision`
- `renounceRights`
- `setDeadCap`
- `setExceptions`

World optimistic handlers now covered with preview+rollback safety:

- `waivePlayer`
- `extendPlayer`
- `optionDecision`
- `renounceRights`
- `setDeadCap`
- `setExceptions`

## Local Audit Stream Storage

- Utility: `src/features/architect/utils/capLegality/localCapAuditLog.ts`
- Key (base-mode stream): `architect_base_capAuditEvents_v1`
- Key (world optimistic preview stream): `architect_world_preview_capAuditEvents_v1`
- Max retained events per key: `500`
- Storage behavior:
  - Primary: `localStorage` when available
  - Fallback: in-memory store when `window`/storage is unavailable (Node/test-safe)

## OperationId Correlation

Correlation status: **YES**

How:

- `applyWorldMutation(...)` now accepts optional caller-provided `operationId`.
- Optimistic handlers generate preview `operationId` and pass it into authoritative mutation persist.
- On success, preview record is updated with:
  - `authoritativeEventLinked: true`
  - `authoritativeOperationId`

## Files Changed

- `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/utils/capLegality/localCapAuditLog.ts` (new)
- `src/tests/architect/baseMode_capAuditEventV1.localLog.behavior.test.ts` (new)
- `src/tests/architect/baseMode_no_firestore_writes.guardrail.test.ts` (new)
- `src/tests/architect/worldOptimistic_postStateValidator_blocks_violation.behavior.test.ts` (new)
- `docs/architect/CAP_AUDITABILITY_MASTER.md`
- `docs/SHIP_GATES_MASTER.md`
- `return_packages/architect/TM_CAP_AUDITABILITY_E3_EXECUTION_RETURN_PACKAGE.md` (new)

## Tests Added

1. `src/tests/architect/baseMode_capAuditEventV1.localLog.behavior.test.ts`
   - Verifies a base-mode cap-changing action appends a `CapAuditEventV1`-shaped local event with required fields.
   - Verifies bounded retention (`max 500`) and in-memory fallback behavior.

2. `src/tests/architect/baseMode_no_firestore_writes.guardrail.test.ts`
   - Source-scans `useArchitectActions.ts` cap-changing base/bridged regions to ensure no direct Firestore write API usage (`writeBatch`, `setDoc`, `updateDoc`, `addDoc`, `deleteDoc`, `batch.commit`).

3. `src/tests/architect/worldOptimistic_postStateValidator_blocks_violation.behavior.test.ts`
   - Uses a world optimistic handler fixture with non-finite totals (`NaN` dead-cap input).
   - Verifies post-state validator blocks optimistic mutation and no authoritative persist call is attempted.

## Validation Commands Run

- `npm run test:node -- --run --reporter=dot`
- `npm run test:ui -- --run --reporter=dot`
- `npm run build`
- `npm run validate:project`

Results:

- `npm run test:node -- --run --reporter=dot`  
  PASS (`245` files passed, `1` skipped; `3075` tests passed, `9` skipped, `3` todo)
- `npm run test:ui -- --run --reporter=dot`  
  PASS (`35` files passed; `373` tests passed, `2` skipped)
- `npm run build`  
  PASS (production build completed; non-blocking Vite warnings about large chunks and mixed static/dynamic imports)
- `npm run validate:project`  
  PASS (`All validations passed`)

## Commands Intentionally Skipped

- `npm run test:full` (skipped by policy; prompt did not include `RUN FULL SUITE`)

## Residual Risks

1. Rollback currently restores the captured local pre-mutation snapshot, which is safe for fail-close, but can overwrite concurrent local edits if multiple optimistic actions are triggered rapidly before persist settles.
2. Local preview stream linking assumes operation-level correlation; if future mutation wrappers bypass the threaded `operationId`, preview-authoritative linkage quality could degrade.

## Recommended E4 Ticket

1. Add a lightweight optimistic-operation queue/lock in `useArchitectActions` to serialize overlapping optimistic cap mutations and eliminate snapshot overwrite races during rollback.
2. Add a small UI debug surface (dev-only) that shows preview vs authoritative link state for cap-audit operations to improve QA visibility.
