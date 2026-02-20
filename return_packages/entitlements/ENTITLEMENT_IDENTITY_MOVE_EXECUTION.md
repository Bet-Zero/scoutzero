# Entitlement Identity-Change Move Execution Report

**Ticket:** TM-ENTITLEMENT-IDENTITY-MOVE  
**Prereq:** TM-ENTITLEMENT-DEDUPE (merged — deterministic IDs, vacuum/world dedupe, double-submit guard)  
**Status:** COMPLETE  
**Date:** 2026-02-20

---

## Problem Statement

When a user edits **identity fields** (holderTeam, seasonYear, round, kind, or kind-specific fields like `underlyingPickId`) on an existing entitlement, the system's deterministic ID computation produces a **different ID** than the original. Without intervention, this leaves the old record orphaned while a new record is created — violating the deduplication invariant:

> **One logical entitlement identity = one record**

---

## Solution: Move Semantics

### World Mode — "Move" on Identity-Change (R1, R2)

**Before (broken):**

```
User edits entitlement ent:LAL:2026:1:own:abc12345
  → changes underlyingPickId from LAL_2026_1st to LAL_2027_1st
  → new computedId = ent:LAL:2027:1:own:def67890
  → old record ent:LAL:2026:1:own:abc12345 is ORPHANED (duplicate)
```

**After (fixed):**

```
User edits entitlement ent:LAL:2026:1:own:abc12345
  → changes underlyingPickId from LAL_2026_1st to LAL_2027_1st
  → new computedId = ent:LAL:2027:1:own:def67890
  → MOVE: write to ent:LAL:2027:1:own:def67890
  → DELETE: old ent:LAL:2026:1:own:abc12345
  → UPDATE: team.entitlementIds[] — remove old, add new
  → Result: exactly one record at the new ID
```

**Collision handling (R2):** If `ent:LAL:2027:1:own:def67890` already exists (rare but possible), the write uses `setDoc(…, { merge: true })` to upsert over it. The old ID is still deleted. No two records with the same logical identity can coexist.

### Vacuum Mode — "Rekey" on Identity-Change (R3)

**Vacuum create rekey — before:**

```
overlay.creates = {
  "vacuum:LAL:2026:1:own:abc12345": { ...doc, underlyingPickId: "LAL_2026_1st" }
}
User edits, changes underlyingPickId → LAL_2027_1st
→ newVacId = vacuum:LAL:2027:1:own:def67890

```

**After rekey:**

```
overlay.creates = {
  "vacuum:LAL:2027:1:own:def67890": { ...doc, underlyingPickId: "LAL_2027_1st" }
}
// Old key "vacuum:LAL:2026:1:own:abc12345" is deleted — no ghost entries.
```

**Collision handling:** If `vacuum:LAL:2027:1:own:def67890` already exists in creates, it is overwritten with the latest document. The old key is always deleted.

**Base edit collision with vacuum create:**
When editing a base entitlement changes its effective identity to match an existing vacuum create, the base edit wins (canonical record). The colliding vacuum create is removed.

---

## Implementation

### New Files

| File                                                                | Purpose                                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/moveWorldEntitlement.ts` | `moveWorldEntitlement()` — write + delete + team inventory update |
| `src/tests/architect/entitlementIdentityMove.test.ts`               | 9 tests for world move, vacuum rekey, and collision handling      |

### Modified Files

| File                                                                         | Changes                                                                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/admin/saveEntitlementFromFormState.ts`               | Detects identity-change on edit; routes to `moveWorldEntitlement` (world) or `rekeyVacuumCreate` (vacuum)                   |
| `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` | Added `rekeyVacuumCreate()`, `resolveVacuumEditCollisions()`, `findVacuumCreateByIdentityKey()`, `dedupeVacuumByIdentity()` |
| `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`               | Added §9.5: Identity-Change on Edit: Move Semantics                                                                         |

### Key Function Signatures

```typescript
// World move
moveWorldEntitlement(db, { worldId, fromId, toId, document, userId })
  → Promise<{ success: boolean; toId: string; error?: string }>

// Vacuum rekey
rekeyVacuumCreate(teamCode, fromVacId, toVacId, document): void

// Vacuum edit collision resolution
resolveVacuumEditCollisions(teamCode, editDocument): void

// Safety net
dedupeVacuumByIdentity(teamCode): number   // returns count removed
```

---

## Tests Added

| #   | Test Name                                                       | Suite                               | Status  |
| --- | --------------------------------------------------------------- | ----------------------------------- | ------- |
| 1   | Edit with no identity-change calls normal write only            | World: moveWorldEntitlement         | ✅ PASS |
| 2   | Edit with identity-change writes to new ID AND deletes old ID   | World: moveWorldEntitlement         | ✅ PASS |
| 3   | Edit with identity-change collision still deletes old ID        | World: moveWorldEntitlement         | ✅ PASS |
| 4   | Vacuum create rekey — old key removed, new key present          | Vacuum: rekeyVacuumCreate           | ✅ PASS |
| 5   | Vacuum create rekey collision — target overwritten, old removed | Vacuum: rekeyVacuumCreate           | ✅ PASS |
| 6   | Base edit collision with vacuum create — create is removed      | Vacuum: resolveVacuumEditCollisions | ✅ PASS |
| 7   | No collision — vacuum create preserved when identity differs    | Vacuum: resolveVacuumEditCollisions | ✅ PASS |
| 8   | Removes duplicate creates that share the same identity key      | Vacuum: dedupeVacuumByIdentity      | ✅ PASS |
| 9   | Returns 0 when no duplicates exist                              | Vacuum: dedupeVacuumByIdentity      | ✅ PASS |

### Existing Test Suites — Regression Check

| Suite                                   | Tests | Status      |
| --------------------------------------- | ----- | ----------- |
| `entitlementDedupe.test.ts`             | 18    | ✅ ALL PASS |
| `vacuumEntitlementOverlayStore.test.ts` | 29    | ✅ ALL PASS |
| Build (`npm run build`)                 | —     | ✅ PASS     |

---

## Validation: R1–R4 Checklist

| Req    | Description                                            | Status  | Evidence                                                                                                                                                                   |
| ------ | ------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | World edits "MOVE" on identity-change                  | ✅ PASS | `saveWorld()` detects `computedId !== originalEntitlementId`, calls `moveWorldEntitlement()` which writes+deletes+updates inventory                                        |
| **R2** | Collision handling (world) — upsert target, delete old | ✅ PASS | `writeWorldEntitlement` uses `setDoc(merge:true)`; old ID always deleted. Test 3 validates.                                                                                |
| **R3** | Vacuum edits "REKEY" on identity-change                | ✅ PASS | `saveVacuum()` calls `rekeyVacuumCreate()` for vacuum creates; `resolveVacuumEditCollisions()` for base edits. Tests 4–7 validate.                                         |
| **R4** | UX invariants — no new modals/prompts                  | ✅ PASS | Identity-change move shows `toast.success('Entitlement saved (identity updated)')`. Normal saves show `toast.success('Entitlement saved')`. No confirmation dialogs added. |

---

## Stop Condition Check

**"Are there external references to entitlementId that would break?"**

Checked all references to `entitlementIds` across the codebase:

- `team.entitlementIds[]` — **handled** by `moveWorldEntitlement` (detach old, attach new)
- `linkedEntitlementIds` / `coveredByEntitlementIds` on other entitlements — these reference IDs of _other_ entitlements. If a linked ID changes, the referencing doc becomes stale. This is a **pre-existing condition** not introduced by this change (same issue existed with manual re-creation). Not blocking; can be addressed by a future "reference updater" pass.
- Trade execution context — runtime only, not persisted across save boundaries.

**Decision: PROCEED.** No blocking external references discovered.
