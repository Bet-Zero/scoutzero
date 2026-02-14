# TM_SEC_A6 — Save/Load + Immutability (Section 12)

**Audit ID:** TM_SEC_A6
**Date:** 2026-02-14
**Mode:** PREFLIGHT (Discovery-only)
**Auditor:** Copilot

---

## Goal

Determine if the trade machine has save/load functionality in scope, where data is persisted (if at all), and confirm that base collections are protected from writes.

---

## Summary

| Question                                    | Answer                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| Does trade machine have save/load in scope? | **PARTIAL** — No save/load trade session UI; "Apply Trade" persists to world |
| If YES: where is it stored?                 | `architect_worlds/{worldId}/teams/{teamCode}`                                |
| Are base collections protected from writes? | **YES** — Base collections never written by trade machine                    |
| Hidden writes present?                      | **NO** — No direct Firestore imports in trade machine components             |

---

## What Exists

### 1. Save Trade Session: NOT PRESENT

No UI buttons or menu options exist to save a trade session for later retrieval:

- `TradeEditor.jsx` buttons: Reset, Add Team, Validate, Apply Trade
- No "Save Trade", "Load Trade", "Export JSON", or "Trade History" UI found
- `useTradeMachine.js` exports `exportCurrentTrade()` but this only returns in-memory trade data (does not persist to Firestore)

**Evidence:**

- [TradeEditor.jsx](src/features/architect/tradeMachine/TradeEditor.jsx#L385-L420) — Only "Apply Trade" button, no save/load
- [useTradeMachine.js](src/features/architect/hooks/useTradeMachine.js#L207) — Comment: "not persisted - this is runtime-only"
- [useTradeMachine.js](src/features/architect/hooks/useTradeMachine.js#L980-L1006) — `exportCurrentTrade()` returns object, no Firestore write

### 2. Apply Trade Persistence: WORLD-ONLY

When "Apply Trade" is clicked on a legal trade:

1. `TradeEditor.jsx` calls `onApplyTrade(tradeData)`
2. `GMDashboard.jsx` wires `onApplyTrade={actions.applyTradeToCapSheet}`
3. `applyTradeToCapSheet()` in `useArchitectActions.ts`:
   - If **worldId present**: calls `runAuthoritativeFAMutation('executeTrade', { teams })`
   - If **no worldId** (vacuum mode): local state only, no persistence

**Evidence:**

- [GMDashboard.jsx](src/features/architect/GMDashboard/GMDashboard.jsx#L309) — `onApplyTrade={actions.applyTradeToCapSheet}`
- [useArchitectActions.ts](src/features/architect/GMDashboard/hooks/useArchitectActions.ts#L603) — `await runAuthoritativeFAMutation('executeTrade', { teams })`

### 3. Load Trade: NOT PRESENT

No trade loading functionality exists:

- No "Load Trade" button in UI
- No trade history collection
- No saved trade retrieval logic

---

## Write Path Evidence

### World Mode Write Path (when worldId present)

```
TradeEditor.jsx (Apply Trade button)
    ↓
onApplyTrade(tradeData)
    ↓
useArchitectActions.ts::applyTradeToCapSheet()
    ↓
runAuthoritativeFAMutation('executeTrade', { teams })
    ↓
mutationPipeline.js::writeBatchToWorld()
    ↓
✓ architect_worlds/{worldId}/teams/{teamCode}
✓ architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}
✓ architect_worlds/{worldId}/entitlements/{entitlementId}
```

**Collection Paths Written:**

| Path                                                             | When Written                  |
| ---------------------------------------------------------------- | ----------------------------- |
| `architect_worlds/{worldId}/teams/{teamCode}`                    | Team snapshot after trade     |
| `architect_worlds/{worldId}/teams/{teamCode}/players/{playerId}` | Player overrides              |
| `architect_worlds/{worldId}/entitlements/{entitlementId}`        | Entitlement ownership changes |

**Evidence:**

- [mutationPipeline.js](src/features/architect/utils/mutationPipeline.js#L2440) — `architect_worlds/${worldId}/teams/${teamCode}`
- [mutationPipeline.js](src/features/architect/utils/mutationPipeline.js#L2469) — `architect_worlds/${worldId}/teams/${teamCode}/players/${playerId}`

### Vacuum Mode (no worldId)

No persistence occurs — state is local only.

---

## Immutability Check

### Base Collections: PROTECTED

| Collection                   | Trade Machine Writes To? | Protection Method                        |
| ---------------------------- | ------------------------ | ---------------------------------------- |
| `/teams`                     | **NO**                   | Not referenced in trade machine          |
| `architect_baseTeams`        | **NO**                   | Firestore rules: `allow write: if false` |
| `architect_basePlayers`      | **NO**                   | Firestore rules: `allow write: if false` |
| `architect_baseEntitlements` | **NO**                   | Firestore rules: `allow write: if false` |
| `players_v2`                 | **NO**                   | Not referenced in trade machine          |

### Evidence: No Direct Firestore in Trade Machine

- **useTradeMachine.js**: Zero imports from `firebase/firestore` — no `setDoc`, `addDoc`, `updateDoc`, `writeBatch`
- **tradeMachine/\*.jsx**: Zero imports from `firebase/firestore`

- **tradeManager.js**: Explicitly read-only

**tradeManager.js header comment (L22-25):**

```javascript
/**
 * Client-side note:
 * This module is intentionally READ-ONLY with respect to Firestore.
 * It computes updated team/player snapshots and returns them to callers,
 * but does not persist them. Persistence must be handled server-side.
 */
```

### Firestore Rules Confirmation

From `firestore.rules.backup` (production rules):

```javascript
// BASE COLLECTIONS: Public read-only (Admin SDK only for writes)
match /architect_baseTeams/{teamCode} {
  allow read: if true;
  allow write: if false;
}
```

**Note:** Current `firestore.rules` is in DEV-OPEN mode (`allow read, write: if true`). Production deployment should use the backup rules.

---

## Risk Assessment

| Item                         | Risk       | Rationale                                         |
| ---------------------------- | ---------- | ------------------------------------------------- |
| Base collection immutability | **LOW**    | Code-level + rules-level protection               |
| Save/load feature absent     | **LOW**    | Not in scope; no hidden writes                    |
| World write path isolation   | **LOW**    | All writes scoped to `architect_worlds/{worldId}` |
| Dev-open firestore rules     | **MEDIUM** | Production should deploy locked rules             |

---

## Files Referenced

1. `src/features/architect/tradeMachine/TradeEditor.jsx`
2. `src/features/architect/hooks/useTradeMachine.js`
3. `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
4. `src/features/architect/GMDashboard/GMDashboard.jsx`
5. `src/features/architect/utils/mutationPipeline.js`
6. `src/features/architect/utils/tradeManager.js`
7. `firestore.rules`
8. `firestore.rules.backup`

---

## Conclusion

**Section 12 Status: PASS**

- **Save/Load Trade Session**: NOT PRESENT — no UI or logic exists
- **Apply Trade Persistence**: PRESENT — writes to user-owned `architect_worlds` only
- **Base Collection Immutability**: CONFIRMED — no writes to base collections
- **Hidden Writes**: NONE — trade machine components have zero direct Firestore imports

The trade machine operates as a validation/simulation tool with optional world-scoped persistence. Base data integrity is preserved.
