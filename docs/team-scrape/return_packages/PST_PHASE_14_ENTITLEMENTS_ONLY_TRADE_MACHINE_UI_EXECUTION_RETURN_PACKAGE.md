# PST_PHASE_14_ENTITLEMENTS_ONLY_TRADE_MACHINE_UI_EXECUTION_RETURN_PACKAGE.md

**Phase**: 14 — Trade Machine UI: Entitlements-Only Picks  
**Status**: COMPLETE  
**Date**: 2026-02-01  
**Mode**: EXECUTION

---

## Summary

Removed the legacy pick UI fallback from Trade Machine. The Picks tab now **always** renders `EntitlementPicksList`, never the legacy `OutgoingPicksList`. This eliminates the dual-mode UI confusion and establishes entitlements as the sole surface for draft-pick interactions in the Trade Machine.

---

## What Changed

### 1. TradeTeamCard — Always Render EntitlementPicksList

**Before**:

```jsx
{activeTab === 'picks' &&
  (team.entitlements?.length > 0 ? (
    <EntitlementPicksList ... />
  ) : (
    <OutgoingPicksList ... />  // Legacy fallback
  ))}
```

**After**:

```jsx
{activeTab === 'picks' && (
  <EntitlementPicksList
    entitlements={team.entitlements || []}
    emptyStateHint="Check emulator seed / baseTeams.entitlementIds"
    ...
  />
)}
```

### 2. Removed Unused Imports and Props

- **TradeTeamCard.jsx**:
  - Removed `import { OutgoingPicksList }`
  - Removed `onTogglePick` and `onEditPick` from props destructuring

- **TradeEditor.jsx**:
  - Removed `onTogglePick` and `onEditPick` prop passing to TradeTeamCard

### 3. EntitlementPicksList — Enhanced Empty State

- Added `emptyStateHint` prop for debugging guidance
- Updated empty state message from "No draft entitlements available" to "No entitlements loaded." with optional hint

---

## Files Changed

| File                                                           | Change                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx`        | Removed conditional picks tab, removed OutgoingPicksList import, removed unused props |
| `src/features/architect/tradeMachine/TradeEditor.jsx`          | Removed onTogglePick/onEditPick prop passing                                          |
| `src/features/architect/tradeMachine/EntitlementPicksList.jsx` | Added emptyStateHint prop, updated empty state UI                                     |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`              | Added Phase 14 to status table, marked IN_PROGRESS → COMPLETE                         |

---

## Files NOT Deleted (Per Scope)

The following files remain for backward compatibility (can be removed in future cleanup phase):

- `src/features/architect/tradeMachine/OutgoingPicksList.jsx`
- `src/features/architect/tradeMachine/TradePickRow.jsx`

These are no longer imported by Trade Machine components but kept to avoid wide blast radius.

---

## State NOT Removed (Deferred to Phase 14.2)

Per scope requirements, the following remain:

- `picksOut` state in `useTradeMachine` hook
- `togglePick` and `updatePickField` functions in hook
- `picks` prop still passed to TradeTeamCard (used in Outgoing summary display)

---

## Build & Test Output

### Build

```

✓ built in 34.59s
```

### Stepien Tests (All Pass)

| Test File                                             | Tests  | Status |
| ----------------------------------------------------- | ------ | ------ |
| `tests/validators/stepien.test.js`                    | 14     | ✓ PASS |
| `tests/validators/stepienEntitlements.test.js`        | 28     | ✓ PASS |
| `tests/validators/stepienEntitlementBaseline.test.js` | 19     | ✓ PASS |
| `src/tests/tradeMachine/stepienObligations.test.js`   | 16     | ✓ PASS |
| **Total**                                             | **77** | ✓ PASS |

---

## Manual Verification Notes

To verify Phase 14 changes:

1. Start emulator: `npm run emu`
2. Start app: `npm run dev`
3. Open Trade Machine
4. Add 2nd/3rd team
5. Click "Picks" tab on any team card
6. **Expected**: Always shows "Draft Assets (Entitlements)" UI
7. **Expected**: Never shows "Outgoing Picks" legacy UI
8. If no entitlements loaded: Shows "No entitlements loaded." with hint

---

## Acceptance Criteria

- [x] Trade Machine Picks tab never renders OutgoingPicksList
- [x] EntitlementPicksList is always the Picks tab UI
- [x] Entitlement selection still works (onToggleEntitlement preserved)
- [x] Build passes
- [x] Stepien tests still pass (77/77)
- [x] Return package created
- [x] Master doc updated

---

## Next Steps (Phase 14.2 — Option B)

When ready to proceed with Phase 14.2:

1. Remove `picksOut` state from `useTradeMachine`
2. Remove `togglePick` and `updatePickField` functions
3. Stop passing `picks` prop to TradeTeamCard
4. Update Outgoing summary section to derive from entitlements
5. Consider deleting `OutgoingPicksList.jsx` and `TradePickRow.jsx`
