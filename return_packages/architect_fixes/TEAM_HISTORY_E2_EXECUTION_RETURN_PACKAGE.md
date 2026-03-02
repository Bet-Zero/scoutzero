# TEAM_HISTORY_E2 — EXECUTION RETURN PACKAGE

**Date:** 2026-03-02
**Status:** COMPLETE

## 1) Summary

Team History now reflects real world-mode actions by reading canonical world events from `architect_worlds/{worldId}/events` and rendering them into the Recent History Timeline.

What is now true:

- World mode timeline is event-driven from world events SSOT (not synthetic fallback behavior).
- Base mode preserves existing banner/empty behavior and does not run world-events query.
- Detail modal shows raw event-level fields (IDs, mutation/event type, team/player scope, cap totals payloads).
- Event normalization supports both legacy envelopes and CapAuditEventV1-style envelopes.
- Mutation event payload builder is fail-closed for required `teamCodes` and emits required timeline fields.

## 2) Files Changed

### Product

- `src/features/architect/history/hooks/useWorldTeamEvents.ts` (new)
- `src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts` (new)
- `src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx`
- `src/features/architect/history/TeamHistoryTab/HistoryDetailModal.jsx`
- `src/features/architect/utils/mutationPipeline.js`

### Tests

- `src/tests/architect/teamHistory.worldEvents.integration.test.tsx` (new)
- `src/tests/architect/teamHistory.baseMode.noEventsQuery.test.tsx` (new)
- `src/tests/architect/teamHistory.eventWriteContract.guardrail.test.ts` (new)
- `src/tests/architect/teamHistory.worldEventsQueryFallback.test.ts` (new)

### Docs / Ledger

- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- `return_packages/architect_fixes/TEAM_HISTORY_E2_EXECUTION_RETURN_PACKAGE.md` (new)

## 3) SSOT Statement

In world mode, Team History is now driven by world events SSOT from:

- `architect_worlds/{worldId}/events/{eventId}`

No Team History world-mode behavior relies on fixture injection unless DEV fixture mode is explicitly enabled/injected.

## 4) Event Schema Notes

### Required fields used by Team History world mode

- `eventId`/`id`
- `mutationType` (or legacy `type`)
- `occurredAt` (fallback legacy `timestamp`)
- `teamCodes` (fallback legacy `teamsAffected`)
- `playerIds` (if present)
- `operationId` / `eventId`
- `beforeTotalsByTeam` / `afterTotalsByTeam` (if present)

### Legacy handling

- Legacy event envelope support:
  - `type`, `timestamp`, `metadata`, `teamsAffected`
- CapAuditEventV1-like support:
  - `schemaVersion`, `mutationType`, `occurredAt`, `teamCodes`, `playerIds`, `beforeTotalsByTeam`, `afterTotalsByTeam`

### Query strategy

- Team-scoped query tries:
  1. `teamCodes` + `occurredAt desc`
  2. `teamCodes` + `timestamp desc`
  3. `teamsAffected` + `occurredAt desc`
  4. `teamsAffected` + `timestamp desc`
- Limited fetch (`limit=50`) with deterministic `loadMore` seam.
- Fail-closed error reporting to UI if query attempts fail.

## 5) Deterministic Proof

### Test A: World mode loads and renders world events

- `src/tests/architect/teamHistory.worldEvents.integration.test.tsx`
- Asserts:
  - timeline rows render from mixed legacy + V1 event inputs
  - newest-first ordering in timeline
  - row click opens detail modal
  - modal includes expected raw event fields and cap totals payload

### Test B: Base mode does not query world events

- `src/tests/architect/teamHistory.baseMode.noEventsQuery.test.tsx`
- Asserts:
  - base banner/empty state shown
  - world events hook/query not invoked when `worldId = null`

### Test C: Event write contract guardrail

- `src/tests/architect/teamHistory.eventWriteContract.guardrail.test.ts`
- Asserts:
  - `buildWorldMutationEventPayload` includes required keys (`occurredAt`, `teamCodes`, ids, totals)
  - fails closed when required `teamCodes` are missing

### Test D: World events query fallback order guardrail

- `src/tests/architect/teamHistory.worldEventsQueryFallback.test.ts`
- Asserts:
  - fallback order is deterministic and exact: `teamCodes/occurredAt` -> `teamCodes/timestamp` -> `teamsAffected/occurredAt` -> `teamsAffected/timestamp`
  - preferred query config runs a single constrained query (no fallback fan-out)

## 6) Validation Output

Executed in required order:

1. `npm run validate:project` -> PASS
2. `npm run build` -> PASS
3. `npm run test:architect -- --reporter=dot` -> PASS

- `Test Files  162 passed (162)`
- `Tests  2416 passed | 1 skipped | 3 todo (2420)`

4. `npm run test:trade -- --reporter=dot` -> PASS
   - `Test Files  58 passed (58)`
   - `Tests  532 passed | 1 skipped | 3 todo (536)`

## 7) Known Gaps

- World-events query fallback may still require Firestore composite indexes depending on production index state; UI now surfaces explicit query errors rather than pretending history exists.
- `loadMore` seam is implemented, but no advanced cursor UX beyond a simple button.

## 8) Ledger Update

Appended execution entry:

- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`

Entry references:

- `TEAM_HISTORY_E2: World Events SSOT Integration`
- Return package path: `return_packages/architect_fixes/TEAM_HISTORY_E2_EXECUTION_RETURN_PACKAGE.md`
