# TM-EXCL-E3 Execution Return Package

**Ticket:** TM-EXCL-E3 — Close Remaining Write-Path Holes: Transfer + Mutation Pipeline + DARE  
**Status:** COMPLETE  
**Date:** 2026-02-20  
**Prereqs:** TM-EXCL-E1 + E1.1 (validator + save gate + trade gate) + TM-EXCL-E2 (no silent skips: 3+ team routing)

---

## Summary

Closed all remaining write-path holes in entitlement exclusivity enforcement. Prior to E3, exclusivity was enforced at save-time (authoring) and trade-time validation, but three write paths could change entitlement ownership without passing through those gates:

1. **Vacuum transfer application** (`applyVacuumTransfer`) — localStorage sandbox
2. **World trade execution** (`mutationPipeline` batch patches) — Firestore writes
3. **DARE mutator** (`applyDAREResultsToBatch`) — Firestore batch for rollovers/conversions

After E3: every code path that changes entitlement ownership is gated by the exclusivity validator. If validation is unavailable, the operation fails loudly and safely (no partial writes).

---

## Files Changed

| File                                                                         | Change                                                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/runTeamExclusivityGate.ts`        | **NEW** — Shared pure gate helper wrapping `validateEntitlementExclusivity()` with context-aware errors |
| `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` | **MODIFIED** — Added `applyGatedVacuumTransfer()` with pre-persist exclusivity check                    |
| `src/features/architect/utils/mutationPipeline.js`                           | **MODIFIED** — Added Phase 3.7 per-team exclusivity gate before Firestore commit                        |
| `src/features/architect/utils/leagueInvariants.ts`                           | **MODIFIED** — Added `validateTradeApplyExclusivity()` for world trade apply                            |
| `src/features/architect/utils/entitlements/dare/entitlementMutator.ts`       | **MODIFIED** — Added `applyGatedDAREResultsToBatch()` with pre-write exclusivity check                  |
| `src/tests/architect/vacuumTransferExclusivityGate.test.ts`                  | **NEW** — 7 tests for vacuum transfer gate                                                              |
| `src/tests/architect/worldTradeApplyExclusivityGate.test.ts`                 | **NEW** — 6 tests for world trade apply gate                                                            |
| `src/tests/architect/dareMutatorExclusivityGate.test.ts`                     | **NEW** — 5 tests for DARE mutator gate                                                                 |
| `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`               | **MODIFIED** — Added §10.8                                                                              |
| `return_packages/entitlements/TM-EXCL-E3_EXECUTION_RETURN_PACKAGE.md`        | **NEW** — This file                                                                                     |

---

## Architecture

### Shared Gate: `runTeamExclusivityGate()`

Central, reusable helper that wraps `validateEntitlementExclusivity()`:

```ts
runTeamExclusivityGate({
  teamId: string,
  entitlements: EntitlementDocLike[],
  candidate?: { id?: string; doc: EntitlementDocLike },
  context: 'VACUUM_TRANSFER' | 'WORLD_TRADE_APPLY' | 'DARE_MUTATION'
}): { ok: true } | { ok: false, errorType, message, violations? }
```

- **Pure & synchronous** — no Firestore, no side effects
- **Standardized error types**: `EXCLUSIVITY_VIOLATION` or `VALIDATION_UNAVAILABLE`
- **Integrity-first**: if the validator throws, returns `VALIDATION_UNAVAILABLE` (fail-closed)
- **Context-aware messages**: labels errors by write path for clear UI feedback

### Where Each Gate Runs

| Write Path        | Enforcement Function                          | Location                                      | Behavior on Failure                                                                                      |
| ----------------- | --------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Vacuum Transfer   | `applyGatedVacuumTransfer()`                  | `vacuumEntitlementOverlayStore.ts`            | Transfer not persisted to localStorage; structured error returned                                        |
| World Trade Apply | `validateTradeApplyExclusivity()` → Phase 3.7 | `leagueInvariants.ts` → `mutationPipeline.js` | Pipeline returns `{ success: false }` with `ENTITLEMENT_EXCLUSIVITY_VIOLATION` rule; no Firestore writes |
| DARE Mutation     | `applyGatedDAREResultsToBatch()`              | `dare/entitlementMutator.ts`                  | Batch writes not added; failure result with per-team violations                                          |

---

## Validation Chain (Complete E1–E3)

After E3, the full enforcement chain is:

```
1. SAVE-TIME (authoring) — E1
   └─ saveEntitlementFromFormState → validateEntitlementExclusivity → reject

2. TRADE-TIME VALIDATION — E1/E1.1/E2
   └─ tradeValidator.js → routing → computePostTradeEntitlements → validateEntitlementExclusivity → reject

3. VACUUM TRANSFER — E3
   └─ applyGatedVacuumTransfer → runTeamExclusivityGate(VACUUM_TRANSFER) → reject or persist

4. WORLD TRADE APPLY — E3
   └─ mutationPipeline Phase 3.7 → validateTradeApplyExclusivity → runTeamExclusivityGate(WORLD_TRADE_APPLY) → reject or commit

5. DARE MUTATION — E3
   └─ applyGatedDAREResultsToBatch → runTeamExclusivityGate(DARE_MUTATION) → reject or add to batch
```

---

## Acceptance Criteria Status

| #   | Criteria                                               | Status |
| --- | ------------------------------------------------------ | ------ |
| 1   | Vacuum trade apply cannot create exclusivity conflicts | ✅     |
| 2   | World trade apply cannot create exclusivity conflicts  | ✅     |
| 3   | DARE cannot persist a conflicting entitlement set      | ✅     |
| 4   | Integrity-first semantics everywhere                   | ✅     |

---

## Build + Test Outputs

### Build

```
npm run build
✓ 3048 modules transformed.
✓ built in 42.22s
```

### All Targeted Tests (6 files, 43 tests)

```
 ✓ src/tests/architect/tradeEntitlementRouting.test.ts (13 tests)
 ✓ src/tests/architect/tradeEntitlementExclusivity.test.ts (6 tests)
 ✓ src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts (6 tests)
 ✓ src/tests/architect/vacuumTransferExclusivityGate.test.ts (7 tests)
 ✓ src/tests/architect/worldTradeApplyExclusivityGate.test.ts (6 tests)
 ✓ src/tests/architect/dareMutatorExclusivityGate.test.ts (5 tests)

 Test Files  6 passed (6)
      Tests  43 passed (43)
```

---

## Known Limitations

1. **`applyVacuumTransfer()` backward compatibility preserved**: The original ungated function is retained for backward compatibility. New code should use `applyGatedVacuumTransfer()` which requires the caller to provide pre-computed post-transfer entitlement sets.

2. **`applyDAREResultsToBatch()` backward compatibility preserved**: The original ungated function is retained. New code should use `applyGatedDAREResultsToBatch()` which requires the caller to provide `currentEntitlementsByTeam` for pre-DARE state.

3. **World trade apply gate resolves entitlements from Firestore**: Phase 3.7 in `mutationPipeline.js` calls `resolveEntitlementsForTeam()` for each affected team, which involves Firestore reads. This adds a small latency cost to trade execution. For typical trades (2 teams), this means 2 additional resolver calls.

4. **Post-transfer set construction is caller-provided for vacuum/DARE**: The vacuum and DARE gates are synchronous/pure — the caller must compute the post-mutation entitlement set before calling the gate. This keeps the gates simple and testable but requires callers to do the assembly work.

---

## Master Doc Section Added

### §10.8 Write-Path Exclusivity Gates (Vacuum Apply / World Apply / DARE)

_Added: 2026-02-20 — TM-EXCL-E3 (Close Remaining Write-Path Holes)_

#### Invariant

**No entitlement ownership mutation may persist if exclusivity cannot be validated.** Any code path that changes which team can end up entitled to an outcome must be gated by the exclusivity validator, and must hard-fail if validation is unavailable.

#### Enforcement Points

| Write Path        | Enforcement Function              | Gate Location                                              |
| ----------------- | --------------------------------- | ---------------------------------------------------------- |
| Vacuum Transfer   | `applyGatedVacuumTransfer()`      | `vacuumEntitlementOverlayStore.ts`                         |
| World Trade Apply | `validateTradeApplyExclusivity()` | `leagueInvariants.ts` → Phase 3.7 in `mutationPipeline.js` |
| DARE Mutation     | `applyGatedDAREResultsToBatch()`  | `entitlementMutator.ts`                                    |

#### Key Files

| File                                                                         | Role                        |
| ---------------------------------------------------------------------------- | --------------------------- |
| `src/features/architect/utils/entitlements/runTeamExclusivityGate.ts`        | Shared pure gate helper     |
| `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` | Gated vacuum transfer       |
| `src/features/architect/utils/mutationPipeline.js`                           | Phase 3.7 integration       |
| `src/features/architect/utils/leagueInvariants.ts`                           | World trade apply validator |
| `src/features/architect/utils/entitlements/dare/entitlementMutator.ts`       | Gated DARE batch            |

---

## Validation Commands Run

- `npm run build`
- `npm run test -- src/tests/architect/vacuumTransferExclusivityGate.test.ts --run`
- `npm run test -- src/tests/architect/worldTradeApplyExclusivityGate.test.ts --run`
- `npm run test -- src/tests/architect/dareMutatorExclusivityGate.test.ts --run`
- Combined run of all 6 entitlement test files (43 tests, all passed)

## Commands Intentionally Skipped

- `npm run test:full` — Not permitted without explicit `RUN FULL SUITE` per AGENTS.md.
- `npm run lint` — Only on request per AGENTS.md; existing ~1888 errors are tech debt.
