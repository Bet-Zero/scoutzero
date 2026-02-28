# TM_CAP_AUDITABILITY_E2_EXECUTION_RETURN_PACKAGE

Date: 2026-02-28  
Mode: EXECUTION  
Scope: World season advance parity only (`advanceSeasonInWorld`)

## Summary

E2 is implemented for world season advance (`src/features/architect/utils/seasonManager.js`).

Delivered:

1. Added operation-level audit context for season advance (`operationId`, `occurredAt`, canonical `mutationType`).
2. Added SSOT totals snapshots per affected team (`beforeTotalsByTeam`, `afterTotalsByTeam`) using `computeTeamCapTotals`.
3. Added post-state validator parity via `validatePostStateCapLegality(...)` + fail-close behavior on violations.
4. Added one operation-level `CapAuditEventV1` world event write in the same `writeBatch` as season writes (no extra commit, no new collection/path).
5. Added required tests for event envelope/path guardrails and fail-close behavior.

## Files Changed

| File | Change |
| --- | --- |
| `src/features/architect/utils/seasonManager.js` | Added operationId/timestamp context, before/after totals maps, post-state validator fail-close, operation-level `CapAuditEventV1` construction + persistence contract assertion + batch write to world events subcollection |
| `src/tests/architect/seasonAdvance_capAuditEventV1.guardrails.test.ts` | New source-scan guardrails for required `CapAuditEventV1` fields and events subcollection path usage |
| `src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts` | New behavior test proving validator violation causes failure + no `batch.commit()` |
| `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js` | Updated `computeTeamCapTotals` mock to include full finite totals fields compatible with post-state validator contract |
| `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.js` | Updated `computeTeamCapTotals` mock to include full finite totals fields compatible with post-state validator contract |
| `docs/architect/CAP_AUDITABILITY_MASTER.md` | Added E2 implementation status section (guarantees + remaining scope) |
| `docs/SHIP_GATES_MASTER.md` | Added E2 status bullets for season advance event emission + validator fail-close gate |
| `return_packages/architect/TM_CAP_AUDITABILITY_E2_EXECUTION_RETURN_PACKAGE.md` | New E2 execution return package |

## Exact Event Schema Fields Used (Season Advance)

`CapAuditEventV1` operation-level payload fields persisted for season advance:

- `schemaVersion`
- `validatorVersion`
- `operationId`
- `mutationType`
- `occurredAt`
- `worldId`
- `teamCodes`
- `playerIds`
- `beforeTotalsByTeam`
- `afterTotalsByTeam`
- `valid`
- `violations`
- `warnings`
- `diffSummary`

Retained compatibility fields in the same event document:

- `eventId`
- `type`
- `timestamp`
- `seasonId`
- `metadata`
- `teamsAffected`
- `mutationMetadata`

## Validator Integration Points

Primary integration (season advance path):

- `src/features/architect/utils/seasonManager.js:763`  
  Calls `validatePostStateCapLegality({...})` with operation/team/totals snapshots.
- `src/features/architect/utils/seasonManager.js:776`  
  Fail-close return on any `postStateValidation.valid === false`.
- `src/features/architect/utils/seasonManager.js:743-744`  
  Builds `beforeTotalsByTeam` and `afterTotalsByTeam` via `computeTeamCapTotals`.

Event persistence parity:

- `src/features/architect/utils/seasonManager.js:898`  
  Uses existing events destination constant (`ARCHITECT_WORLD_EVENTS_SUBCOLLECTION`).
- `src/features/architect/utils/seasonManager.js:937-943`  
  Runs sanitize + `assertPersistableOrThrow(...EVENT...)` + `batch.set(eventRef, safeEvent)`.
- `src/features/architect/utils/seasonManager.js:945`  
  Event write is committed in the same batch as team and metadata writes.

## Tests Added + What They Prove

Added tests:

1. `src/tests/architect/seasonAdvance_capAuditEventV1.guardrails.test.ts`
- Proves season manager constructs operation-level `CapAuditEventV1` fields.
- Proves season manager writes event using world events subcollection constant path.

2. `src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts`
- Injects non-finite totals via fixture (`playersTotal: NaN` for advanced year).
- Proves season advance returns failure on validator violation.
- Proves `batch.commit()` is not called (fail-close, no writes committed).

Adjusted existing tests for compatibility with new validator contract:

- `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js`
- `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.js`

These adjustments only updated mocked totals shape to include finite required fields.

## Commands Run + Results

Required commands:

1. `npm run test:node -- --run --reporter=dot`  
Result: PASS (`242` files passed, `1` skipped; `3071` tests passed, `9` skipped, `3` todo; duration `166.47s`)

2. `npm run test:ui -- --run --reporter=dot`  
Result: PASS (`35` files passed; `373` tests passed, `2` skipped; duration `79.37s`)

3. `npm run build`  
Result: PASS (production build completed; non-blocking chunk-size/dynamic-import warnings)

4. `npm run validate:project`  
Result: PASS (all schema/project validations passed)

Additional targeted verification run:

- `npm run test:node -- --run src/tests/architect/seasonAdvance_capAuditEventV1.guardrails.test.ts src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.js --reporter=dot`  
Result: PASS

Commands intentionally skipped:

- None.

## Residual Risks + Next Ticket Recommendation (E3)

Residual risks:

1. E2 covers world season advance only; base-mode cap-changing flows still lack durable audit parity.
2. Team-level eventRefs fan-out is intentionally not implemented in E2.
3. Optimistic/local world handlers are still outside unified auditability parity.

Recommended next ticket:

- **E3**: Extend `CapAuditEventV1` + post-state validator fail-close parity to base-mode and optimistic/local handler bypass paths, then add eventRefs fan-out once parity coverage is complete.

---

## RETURN PACKAGE (PASTE BACK)

Paths created/updated:

- `return_packages/architect/TM_CAP_AUDITABILITY_E2_EXECUTION_RETURN_PACKAGE.md`
- `src/features/architect/utils/seasonManager.js`
- `src/tests/architect/seasonAdvance_capAuditEventV1.guardrails.test.ts`
- `src/tests/architect/seasonAdvance_postStateValidator_failClose.behavior.test.ts`
- `src/tests/architect/dare/phaseB_dare_world_persistence_integration.test.js`
- `src/tests/architect/dare/phaseD_e2e_trade_then_advance_smoke.test.js`
- `docs/architect/CAP_AUDITABILITY_MASTER.md`
- `docs/SHIP_GATES_MASTER.md`

Exact `mutationType` string used for season advance events:

- `seasonAdvance`

Event cardinality used:

- **1 event per operation** (operation-level envelope), not per-team.
