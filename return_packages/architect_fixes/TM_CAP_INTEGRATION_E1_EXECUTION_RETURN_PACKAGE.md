# TM_CAP_INTEGRATION_E1 — EXECUTION RETURN PACKAGE

**Date:** 2026-03-03  
**Mode:** EXECUTION (deterministic tests + validation evidence)  
**Status:** COMPLETE

## Related Artifacts

- Baseline review: `return_packages/architect_reviews/TM_CAP_INTEGRATION_R1_LOCAL_REVIEW_RETURN_PACKAGE.md`
- Master status: `docs/architect/TM_CAP_INTEGRATION_MASTER.md`

---

## Objective

Close `TM_CAP_INTEGRATION_R1_LOCAL` checklist item #12 by adding deterministic, CI-safe proof for:

1. Trade apply integration evidence linking `executeTrade` mutation output to cap-impact and Team History event payload contract.
2. Execute-trade persistence guardrails proving world-only write paths and fail-closed no-write behavior on invalid routing.

---

## Implemented Changes

### 1) AC1 integrated deterministic test added

- **File:** `src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx`
- Uses deterministic fixture teams/players with fixed timestamp.
- Executes `applyWorldMutation({ mutationType: 'executeTrade' })` in world mode.
- Asserts:
  - mutation succeeds and persists,
  - changed team totals reflect cap impact,
  - world event write exists and payload includes Team History contract fields (`mutationType`, `teamCodes`, `occurredAt`, `beforeTotalsByTeam`, `afterTotalsByTeam`, `diffSummary`, `mutationMetadata`).
- Includes no-op mocks for cap legality + post-state validator to keep scope deterministic and focused on integration contract behavior.

### 2) AC2 executeTrade write-path guardrail added

- **File:** `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts`
- Captures Firestore `batch.set`/`batch.update` ref paths during successful `executeTrade` world mutation.
- Asserts all writes are under `architect_worlds/{worldId}/...` and explicitly rejects:
  - root `/teams` writes,
  - `architect_basePlayers`,
  - `architect_baseTeams`,
  - `architect_baseEntitlements`,
  - `architect_basePickRules`.
- Adds second test proving fail-closed behavior for invalid 3-team routing (`TRADE_APPLY_ROUTING_ERROR`) with no write batch commit.

---

## Root-Cause Fix During Implementation

Initial AC2 fixture failed with:

- `[PERSISTENCE CONTRACT VIOLATION] TEAM document has 1 disallowed field(s): team.id`

Resolution:

- Removed `team.id` from both new test fixture factories to align with persistence allowlist contract.

---

## Validation Commands Run

### Required sequence (executed in order)

1. `npm run validate:project` ✅ PASS
2. `npm run build` ✅ PASS (non-blocking warnings only)
3. `npm run test:trade -- --reporter=dot` ✅ PASS
   - Test Files: 58 passed (58)
   - Tests: 532 passed | 1 skipped | 3 todo
4. `npm run test:architect -- --reporter=dot` ✅ PASS
   - Test Files: 167 passed (167)
   - Tests: 2449 passed | 1 skipped | 3 todo

### Additional validation

- `npm run test:diff -- --reporter=dot` ✅ PASS (resolved to `test:fast`, 14/14 passing)
- `npm run typecheck` ⚠️ FAIL (pre-existing repo TypeScript errors in unrelated files; no failures attributable to new TM_CAP_INTEGRATION_E1 tests)

---

## Acceptance Criteria Mapping

- **AC1:** ✅ Met by `tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx`
- **AC2:** ✅ Met by `tmCapIntegration.executeTrade_writePaths.guardrail.test.ts`

`TM_CAP_INTEGRATION_R1_LOCAL` checklist #12 moves from FAIL to PASS with deterministic automated proof.

---

## Files Changed

- `src/tests/architect/tmCapIntegration.tradeApply_updatesCapAndHistory.integration.test.tsx`
- `src/tests/architect/tmCapIntegration.executeTrade_writePaths.guardrail.test.ts`
- `return_packages/architect_fixes/TM_CAP_INTEGRATION_E1_EXECUTION_RETURN_PACKAGE.md`
- `docs/reviews/ARCHITECT_REVIEW_LEDGER.md`
- `docs/architect/TM_CAP_INTEGRATION_MASTER.md`

---

## Commands Intentionally Skipped

- Full suite (`npm run test:full`, `npm test`, raw `vitest`) — not requested and blocked by AGENTS policy without explicit `RUN FULL SUITE` instruction.
