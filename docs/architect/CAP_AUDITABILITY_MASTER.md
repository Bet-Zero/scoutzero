# CAP_AUDITABILITY_MASTER

Last updated: 2026-02-28

## Purpose

Single source of truth for Architect cap auditability architecture:

1. One gate to trust for cap legality (`post-state validator`).
2. One consistent audit event envelope for every cap-changing path.

This document tracks target architecture, path coverage, and execution decisions.

## Definitions

### Gate-to-Trust

Classification used for cap-changing paths:

- `A` Authoritative: compute -> validate -> persist in one authoritative path.
- `B` Bridged: partial centralization (for example optimistic local state + async authoritative persist, or path-specific validation only).
- `C` Bypass: direct-write/local-only path without authoritative end-to-end gate.

### Post-State Validator

A reusable validator that accepts before/after state and returns deterministic legality verdicts for any cap-changing operation, independent of UI entry path.

### Audit Event

A structured, versioned event emitted for each cap-changing operation and containing:

- identity/correlation
- actor/time/scope
- before/after totals snapshot
- validator verdict
- diff summary
- persistence status metadata

## Canonical Desired Pipeline

All cap-changing operations (world + base-mode parity) should converge on:

1. `Compute`
2. `Validate` (shared post-state validator contract)
3. `Persist` (or explicit local-only mode handling)
4. `Log` (same audit schema and version fields)

Canonical operation sequence:

`compute -> postStateValidate -> persist -> emitCapAuditEvent`

## Current-State Summary (P0 Preflight)

- World mutations use `applyWorldMutation` and are closest to authoritative flow.
- Season advance writes cap-changing state through `seasonManager` write batches, but does not emit world `events`.
- Base-mode and several local/legacy paths remain bypass/bridged and not fully auditable.
- No unified reusable post-state validator contract was found.

Primary reference:

- `return_packages/architect/TM_CAP_AUDITABILITY_P0_PREFLIGHT_RETURN_PACKAGE.md`

## Write-Path Ledger

Canonical complete ledger is maintained in:

- `return_packages/architect/TM_CAP_AUDITABILITY_P0_PREFLIGHT_RETURN_PACKAGE.md`  
  Section: **Write-Path Ledger (Complete)**

High-level category view:

| Category | Current Class | Notes |
| --- | --- | --- |
| World mutation pipeline actions (trade/sign/offer sheet/etc.) | Mostly `A` | Centralized path exists, but lacks holistic post-state validator and full audit envelope fields. |
| Optimistic local + async persist handlers | `B` | Local-first mutation introduces drift/audit consistency risk. |
| World season advance/offseason transition | `B` | Uses OSTE validation and bridge persistence contracts, but no unified world event emission. |
| Base-mode local flows | `C` | Local-only state mutations with no durable audit trail. |
| Legacy exported/dormant mutation surfaces | `C` | Bypass candidates; not fully routed through one trust gate. |

## Proposed Contracts (Docs-Only)

### `PostStateCapValidationInput`

Required fields:

- operation context (`operationId`, `mutationType`, `category`, `mode`)
- temporal context (`asOfDate`, `seasonId`, `year`)
- scope (`worldId`, `teamCodes`, related IDs)
- state (`beforeTeamsByCode`, `afterTeamsByCode`)
- rule context (`cap/tax/apron/floor`, profile inputs)

### `PostStateCapValidationResult`

Required fields:

- `valid`
- `violations[]`
- `warnings[]`
- normalized rule codes
- `validatorVersion`
- `schemaVersion`

### `CapAuditEventV1`

Required persisted fields:

- `eventId`
- `operationId`
- `schemaVersion`
- `validatorVersion`
- action/source metadata
- actor/time
- world/team/player refs
- before/after totals snapshots
- validator verdict payload
- diff summary
- persistence metadata (`persisted`, `persistPath`)

## Open Questions / Decisions Needed

1. Should world-mode single-team local offseason tools be blocked, or routed to durable world writes?
2. Should legacy `advanceSeason`/`processSeasonTransition` be deprecated or bridged to the authoritative season path?
3. For base mode, should audit parity be in-memory only, localStorage-backed, or optional persistence?
4. Should validator failures in optimistic world handlers trigger automatic rollback to authoritative state?
5. Which source owns event path constants (`collections.ts` vs `architectFirestorePaths.ts`) for `events` and `eventRefs`?

## Execution Linkage

Execution sequencing and acceptance criteria live in:

- `return_packages/architect/TM_CAP_AUDITABILITY_P0_PREFLIGHT_RETURN_PACKAGE.md`  
  Section: **Next Execution Tickets (Scoped)** (`E1`..`E4`)

## E1 Execution Status (Implemented 2026-02-28)

Scope implemented in authoritative world mutation pipeline only:

- `applyWorldMutation` now generates and threads `operationId` through validation and persistence.
- Added shared post-state validator module:
  `src/features/architect/utils/capLegality/postStateCapValidator.ts`
  - `POST_STATE_CAP_VALIDATOR_VERSION: "0.1.0"`
  - `validatePostStateCapLegality(input) => { valid, violations, warnings }`
- Added fail-closed post-state validation gate in authoritative flow:
  `compute -> validateMutation -> league invariants -> postStateCapValidator -> persist`.
- Upgraded world mutation event envelope to `CapAuditEventV1` fields at existing destination path (`architect_worlds/{worldId}/events/{eventId}`):
  - `schemaVersion: "cap-audit-event-v1"`
  - `validatorVersion`
  - `operationId`
  - `beforeTotalsByTeam` / `afterTotalsByTeam`
  - validator verdict (`valid`, `violations`, `warnings`)
  - `diffSummary`
  - mutation metadata (`mutationType`, category, `worldId`, teams, players)
- Updated persistence event allowlist contract to accept `CapAuditEventV1` fields.
- Added `ARCHITECT_WORLD_EVENTS_SUBCOLLECTION` constant in `src/constants/collections.ts`.
- Closed validator mapping gap for `finalizeMatchedOfferSheet` / `finalizeDeclinedOfferSheet` by explicitly routing both through `validateOfferSheetResolution(action: "finalize")`.

Still out of scope / remaining for later tickets:

- Season advance (`seasonManager`) event parity on same envelope.
- Base-mode durable logging parity.
- Optimistic/local handler parity and bypass elimination.

## E2 Execution Status (Implemented 2026-02-28)

Scope implemented for world season advance only (`advanceSeasonInWorld`):

- Season advance now generates an operation-scoped audit context:
  - `operationId`
  - `occurredAt` timestamp
  - `mutationType: "seasonAdvance"`
- Season advance now builds SSOT before/after totals snapshots per advanced team:
  - `beforeTotalsByTeam[teamCode]` (pre-transition team snapshot)
  - `afterTotalsByTeam[teamCode]` (post-transition team snapshot)
- Added shared post-state validator contract parity in season advance:
  - `validatePostStateCapLegality(...)` from `postStateCapValidator.ts`
  - same validator version constant (`0.1.0`)
  - fail-close behavior: any violation blocks commit and returns failure.
- Season advance now emits one operation-level `CapAuditEventV1` into the existing world events destination in the same `writeBatch`:
  - path: `architect_worlds/{worldId}/events/{eventId}`
  - no new collection/path introduced
  - event write is sanitized + persistence-contract asserted before `batch.set(...)`
  - event is queued before the same `batch.commit()` as team + metadata writes.

What is now guaranteed for world season advance:

1. Every successful advance emits a versioned cap-audit envelope with before/after totals and validator verdict.
2. Validator violations fail-close before any batch commit.
3. Event writes do not use a separate commit path.

Still out of scope / remaining:

- Base-mode durable cap audit logging parity.
- Optimistic/local handler parity and bypass elimination.
- Team-level eventRefs fan-out and broader event graph indexing.

## E3 Execution Status (Implemented 2026-02-28)

Scope implemented for base-mode parity and world optimistic/local-first parity:

- Added local cap-audit stream utility:
  - `src/features/architect/utils/capLegality/localCapAuditLog.ts`
  - Base key: `architect_base_capAuditEvents_v1`
  - World preview key: `architect_world_preview_capAuditEvents_v1`
  - Bounded retention: last `500` events per key
  - Storage behavior: `localStorage` when available, in-memory fallback when `window`/storage is unavailable.

- Base-mode (`worldId = null`) cap-changing actions now run `validatePostStateCapLegality(...)` and append `CapAuditEventV1`-shaped local events (fail-close on violations):
  - `executeTrade`
  - `signFreeAgent`
  - `waivePlayer`
  - `extendPlayer`
  - `optionDecision`
  - `renounceRights`
  - `setDeadCap`
  - `setExceptions`

- World optimistic handlers now enforce preview-audit parity before local mutation:
  - `waivePlayer`
  - `extendPlayer`
  - `optionDecision`
  - `renounceRights`
  - `setDeadCap`
  - `setExceptions`
  - Flow: preview event emit -> post-state validator gate -> optimistic apply -> authoritative persist.

- Operation correlation and drift safety:
  - `applyWorldMutation` now accepts optional caller-provided `operationId` (no new Firestore path).
  - Optimistic handlers pass preview `operationId` through authoritative mutation pipeline.
  - On persist success, preview event is marked `authoritativeEventLinked: true` and records authoritative operation ID.
  - On persist failure, optimistic state is rolled back to captured pre-mutation snapshot and preview is marked `persistFailed: true`.

- Firestore scope unchanged:
  - No new collections/paths.
  - No additional world-mode batch commit paths introduced.
