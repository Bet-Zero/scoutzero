# TM-EXCL-E1.1 — Execution Return Package

**Ticket:** TM-EXCL-E1.1 (Integrity-First Exclusivity Gating)  
**Date:** 2026-02-20  
**Status:** ✅ Complete

---

## Summary

Hardened entitlement exclusivity enforcement so that **"cannot validate = cannot proceed."** Eliminated two "non-fatal catch → allow proceed" patterns that previously allowed saves and trades to bypass exclusivity checking when infrastructure errors occurred. Both paths now treat validation unavailability as a **hard failure**.

No new exclusivity rules were added. Only error-handling semantics changed.

---

## Files Changed

| File                                                                  | Change                                                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/features/architect/admin/saveEntitlementFromFormState.ts`        | Expanded `errorType` union; catch block now returns hard failure instead of proceeding |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`  | Catch block now returns `{ passed: false }` instead of `{ passed: true }`              |
| `src/features/architect/admin/useEntitlementEditorSession.ts`         | Added `EXCLUSIVITY_VALIDATION_UNAVAILABLE` branch in `handleApply` toast handling      |
| `src/tests/architect/saveEntitlementExclusivity.test.ts`              | Added 2 new tests (resolver failure, validator throw)                                  |
| `src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts` | **New file** — 4 tests for trade-time error handling                                   |
| `docs/architect/TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md`        | Added §10.6 Integrity-First Semantics; updated §10.5 test file counts                  |

---

## Before / After Behavior

### Save-Time Path

| Scenario                         | Before (E1)                             | After (E1.1)                                                                                  |
| -------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| Resolver throws (Firestore down) | ⚠️ Warn in console, **proceed to save** | 🛑 Return `{ success: false, errorType: 'EXCLUSIVITY_VALIDATION_UNAVAILABLE' }`, **no write** |
| Validator throws unexpectedly    | ⚠️ Warn in console, **proceed to save** | 🛑 Same hard failure                                                                          |
| Real exclusivity conflict        | 🛑 Block (unchanged)                    | 🛑 Block (unchanged)                                                                          |
| Clean save, no conflicts         | ✅ Allow (unchanged)                    | ✅ Allow (unchanged)                                                                          |

### Trade-Time Path

| Scenario                                | Before (E1)                                          | After (E1.1)                                    |
| --------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| `computePostTradeEntitlements` throws   | ⚠️ Warn, return `{ passed: true }` (**allow trade**) | 🛑 Return `{ passed: false }` (**block trade**) |
| `validateEntitlementExclusivity` throws | ⚠️ Warn, return `{ passed: true }` (**allow trade**) | 🛑 Return `{ passed: false }` (**block trade**) |
| Real exclusivity conflict               | 🛑 Block (unchanged)                                 | 🛑 Block (unchanged)                            |
| Clean trade, no conflicts               | ✅ Allow (unchanged)                                 | ✅ Allow (unchanged)                            |

---

## Diff-Level Specifics

### Functions Touched

1. **`saveEntitlementFromFormState()`** — `src/features/architect/admin/saveEntitlementFromFormState.ts`
   - `catch (exclusivityError)` block (line ~159): changed from warn+proceed to return hard failure
2. **`entitlementExclusivityResult` IIFE** — `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
   - `catch (err)` block (line ~700): changed from `{ passed: true }` to `{ passed: false }`

3. **`handleApply()`** — `src/features/architect/admin/useEntitlementEditorSession.ts`
   - Added `else if (result.errorType === 'EXCLUSIVITY_VALIDATION_UNAVAILABLE')` branch

### Error Types Added/Used

| Error Type                             | Context                                  | New?                 |
| -------------------------------------- | ---------------------------------------- | -------------------- |
| `'EXCLUSIVITY_VALIDATION_UNAVAILABLE'` | Save-time: resolver or validator failure | **New**              |
| `'EXCLUSIVITY'`                        | Save-time: real conflict detected        | Existing (unchanged) |

### `SaveEntitlementResult.errorType` Union

```typescript
// Before:
errorType?: 'EXCLUSIVITY' | 'VALIDATION';

// After:
errorType?: 'EXCLUSIVITY' | 'EXCLUSIVITY_VALIDATION_UNAVAILABLE' | 'VALIDATION';
```

### Toast Messages

**Save-time (EXCLUSIVITY_VALIDATION_UNAVAILABLE):**

- Toast 1: `"Cannot save entitlement"`
- Toast 2: `"Exclusivity validation unavailable. Try again or reload."` (6s duration)

**Trade-time (rule failure):**

- Rule details: `"Pick Exclusivity: Error computing post-trade entitlement set"`
- Violation: `"Exclusivity validation unavailable — cannot verify trade legality"`

---

## Validation Output

### Build

```
✓ 3046 modules transformed.
✓ built in 40.70s
```

### Save Gate Tests (9 passed)

```
✓ src/tests/architect/saveEntitlementExclusivity.test.ts  (9 tests) 33ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

### Trade Gate Integration Tests (6 passed — unchanged)

```
✓ src/tests/architect/tradeEntitlementExclusivity.test.ts  (6 tests) 15ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### Trade Gate Error-Handling Tests (4 passed — new)

```
✓ src/tests/architect/tradeEntitlementExclusivity.unavailable.test.ts  (4 tests) 69ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### All Three Combined (19 passed)

```
 Test Files  3 passed (3)
      Tests  19 passed (19)
```

---

## Limitations

1. **3+ team trade routing gap:** In 3+ team trades where `toTeamId` is missing on outgoing entitlements, the 2-team fallback heuristic in the IIFE sets `toTeamId: undefined`. This doesn't cause a throw in `computePostTradeEntitlements` — the entitlements are silently skipped. Separate ticket recommended for explicit 3+ team routing enforcement.

2. **Save-time toast duplication (pre-existing):** The existing `EXCLUSIVITY` path (real conflict) still fires 3 toasts: one from `saveEntitlementFromFormState` (line 151) + two from `handleApply`. The new `EXCLUSIVITY_VALIDATION_UNAVAILABLE` path fires only 2 toasts (from `handleApply` only). Fixing the original duplication is out of scope for this ticket.

3. **Other write entry points unguarded:** Only `saveEntitlementFromFormState` is gated. Direct calls to `writeWorldEntitlement`, `applyVacuumTransfer`, the mutation pipeline, and DARE bypass exclusivity. This is a pre-existing gap from E1.
