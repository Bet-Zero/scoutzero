# PST_PHASE_14_2_REMOVE_LEGACY_PICKSOUT_ENTITLEMENTS_ONLY_EXECUTION_RETURN_PACKAGE.md

**Phase**: 14.2 — Remove Legacy picksOut — Entitlements Only  
**Status**: COMPLETE  
**Date**: 2026-02-01  
**Mode**: EXECUTION

---

## Summary

Eliminated legacy `picksOut` state and handlers from the Trade Machine. Draft-asset trading is now **entitlements-only**:

- State: Only `entitlementsOut` (no `picksOut`)
- Export payload: `outgoingEntitlements` only (no `outgoingPicks`)
- UI displays: Entitlements-only in all summary/selection surfaces

---

## What Changed

### 1. useTradeMachine.js — Complete picksOut Removal

**Removed**:

- `picksOut: []` from all team slot initializations
- `togglePick` callback function
- `updatePickField` callback function
- `areSamePick` import (only used by removed functions)
- `ensurePickId` import (only used by removed functions)
- `picksOut` from `validateTrade()` call payload
- `outgoingPicks` and `incomingPicks` from `exportCurrentTrade()` payload
- `picksOut` from `resetTrade()` clear logic
- `togglePick` and `updatePickField` from return statement

**Updated**:

- `incomingAssets` now derives `entitlements` instead of `picks`
- `exportCurrentTrade()` now exports `outgoingEntitlements` and `incomingEntitlements`

### 2. TradeEditor.jsx — picksOut Dependencies Removed

**Removed**:

- `togglePick` and `updatePickField` destructuring from useTradeMachine
- `t.picksOut` references in incomingAssets calculation
- `picks={t.picksOut}` prop passing to TradeTeamCard
- `incomingPicks` prop passing to TradeTeamCard

**Updated**:

- `incomingAssets` now calculates `entitlements` from `entitlementsOut`
- Passes `incomingEntitlements` prop to TradeTeamCard

### 3. TradeTeamCard.jsx — Entitlements-Only Display

**Removed**:

- `picks` prop
- `incomingPicks` prop

**Updated**:

- `picksCount` now derives from entitlements, not picks
- Outgoing summary section shows outgoing entitlements
- Incoming summary section shows incoming entitlements
- Condition for showing "Incoming" section uses `incomingEntitlements`

### 4. computeTradeDraftKey.js — Entitlements-Based Key

**Updated**:

- Draft key now uses `entitlementsOut` IDs instead of `picksOut` IDs
- Removed `ensurePickId` import

---

## Files Changed

| File                                                                | Change                                                               |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/features/architect/hooks/useTradeMachine.js`                   | Removed picksOut state, togglePick, updatePickField; updated exports |
| `src/features/architect/tradeMachine/TradeEditor.jsx`               | Removed picksOut dependencies; updated incomingAssets                |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx`             | Removed picks/incomingPicks props; updated to entitlements display   |
| `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js` | Updated to use entitlement IDs                                       |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`                   | Added Phase 14.2 to status table                                     |

---

## State NOT Removed (Deferred / Out of Scope)

Per scope requirements, the following remain:

- Legacy pick fields in Firestore schemas (for backward compatibility)
- `OutgoingPicksList.jsx` and `TradePickRow.jsx` files (can be deleted in Phase 15)
- Validator internal handling for picksOut (uses `|| []` defaults, entitlements take precedence)

---

## Export Payload Change

**Before**:

```javascript
{
  teamId: 'BOS',
  outgoingPlayers: [...],
  outgoingPicks: [...],        // REMOVED
  outgoingEntitlements: [...],
  incomingPlayers: [...],
  incomingPicks: [...],        // REMOVED
  usedTradeExceptions: [...]
}
```

**After**:

```javascript
{
  teamId: 'BOS',
  outgoingPlayers: [...],
  outgoingEntitlements: [...],  // Draft assets = entitlements only
  incomingPlayers: [...],
  incomingEntitlements: [...],  // Incoming draft assets = entitlements only
  usedTradeExceptions: [...]
}
```

---

## Build & Test Output

### Build

```
✓ built in 27.95s
```

### Stepien Tests (All Pass)

| Test File                                             | Tests  | Status |
| ----------------------------------------------------- | ------ | ------ |
| `tests/validators/stepien.test.js`                    | 14     | ✓ PASS |
| `tests/validators/stepienEntitlements.test.js`        | 28     | ✓ PASS |
| `tests/validators/stepienEntitlementBaseline.test.js` | 19     | ✓ PASS |
| `src/tests/tradeMachine/stepienObligations.test.js`   | 16     | ✓ PASS |
| **Total**                                             | **77** | ✓ PASS |

### Phase 13 Guardrail (All Pass)

| Test File                                                               | Tests | Status |
| ----------------------------------------------------------------------- | ----- | ------ |
| `src/tests/architect/phase13_entitlementIds_transfer_guardrail.test.js` | 9     | ✓ PASS |

---

## Manual Verification Notes

To verify Phase 14.2 changes:

1. Start emulator: `npm run emu`
2. Start app: `npm run dev`
3. Open Trade Machine
4. Select team with entitlements
5. Click "Picks" tab → Shows entitlements list
6. Toggle entitlements for trade
7. Validate trade → Stepien uses entitlements baseline
8. **Verify**: No "Outgoing Picks" UI surfaces exist
9. **Verify**: No pick edit/protection controls exist
10. Apply trade → `entitlementIds` transferred in world snapshot

---

## Acceptance Criteria

- [x] useTradeMachine team slot has NO picksOut
- [x] No togglePick / updatePickField remains
- [x] Trade Machine export payload contains outgoingEntitlements only (no outgoingPicks)
- [x] Trade summary/receipt surfaces do not depend on picksOut
- [x] Build passes
- [x] Stepien tests pass (77/77)
- [x] Phase 13 entitlementIds transfer guardrail passes (9/9)
- [x] Return package created
- [x] Master doc updated

---

## Next Steps (Optional Phase 15 Cleanup)

When ready to proceed with Phase 15:

1. Delete `OutgoingPicksList.jsx` and `TradePickRow.jsx`
2. Remove `formatPick` import from TradeTeamCard (if unused)
3. Clean up validator internal picksOut defaults (make entitlements-only)
4. Consider deprecating legacy pick schema fields in Firestore
