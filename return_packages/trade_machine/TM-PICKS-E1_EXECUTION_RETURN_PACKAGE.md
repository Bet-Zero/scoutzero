# TM-PICKS-E1: Trade Entitlements As Assets — Return Package

**Ticket**: TM-PICKS-E1  
**Status**: COMPLETE  
**Date**: 2026-02-13

---

## Executive Summary

Pick-right entitlements are now fully tradeable assets in the Trade Machine. When a trade is applied:

- **Local state**: `entitlementIds[]` arrays on cap sheets are updated (remove outgoing, add incoming)
- **World mode (Firestore)**: `holderTeam` override docs are written to `architect_worlds/{worldId}/entitlements/{entitlementId}` via atomic `writeBatch`
- **Vacuum mode (localStorage)**: Transfer records are stored in the vacuum overlay envelope and consumed by the entitlement resolver on next load
- **Validation**: Post-trade Stepien checks use correctly transferred entitlement ownership
- **Receipt/Export**: Entitlement metadata is included in trade payloads; sanitization strips internal vacuum fields

No changes to `architect_base*` collections. No Firestore writes in vacuum mode. All existing trade flows preserved.

---

## Test & Build Results

| Check                                           | Result                                           |
| ----------------------------------------------- | ------------------------------------------------ |
| Targeted entitlement tests (9 files, 121 tests) | ✅ All pass                                      |
| Full test suite (230 files, 3014 tests)         | ✅ All pass (1 skipped, 3 todo — pre-existing)   |
| Production build (`npm run build`)              | ✅ Succeeds (3m 52s, chunk warning pre-existing) |

---

## Files Changed

### Modified (6 files)

| File                                                                         | Lines | What changed                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts` | 352   | Added `TransferRecord` interface, `transfers` field to `OverlayEnvelope`, 5 new CRUD functions (`applyVacuumTransfer`, `removeTransfer`, `getTransfersForTeam`, `hasTransfer`, `getTransfer`), backward-compatible loading |
| `src/features/architect/utils/entitlements/entitlementResolver.ts`           | 262   | Added vacuum transfer handling block (L196–L241): excludes transferred-out entitlements, fetches and patches transferred-in entitlements from base collection                                                              |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`            | ~800  | Extended `TradeDataItem` interface with entitlement fields, added entitlement ID transfer logic in `applyTradeToCapSheet` (L696–L721), updated persistence payload to include entitlement data                             |
| `src/features/architect/utils/mutationPipeline.js`                           | ~2600 | Added `entitlementUpdates` computation in `computeTradeResult` (L1412–L1434), added section "2.5" in `persistWorldMutation` for `holderTeam` patch writes to Firestore (L2507–L2520)                                       |
| `src/features/architect/tradeMachine/TradeEditor.jsx`                        | 477   | Added vacuum transfer persistence in Apply Trade handler (L399–L414): iterates outgoing entitlements, calls `applyVacuumTransfer()`, then `refreshEntitlements()`                                                          |
| `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js` | 216   | Added `computePostTradeEntitlements()` helper function (L167–L216) for post-trade entitlement inventory calculation                                                                                                        |

### Created (5 files)

| File                                                  | Tests | Purpose                                                                                               |
| ----------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `docs/architect/TRADE_MACHINE_PICK_TRADING_MASTER.md` | —     | Master doc: gap analysis, target behavior, data flow diagram, acceptance checklist                    |
| `tests/entitlements/entitlementTrading.test.js`       | 11    | Tests for `computePostTradeEntitlements` (8) + existing Stepien helper tests (3)                      |
| `tests/entitlements/vacuumTradeTransfer.test.ts`      | 17    | Tests for vacuum overlay transfer CRUD operations, backward compatibility                             |
| `tests/entitlements/worldTradeTransfer.test.js`       | 4     | Tests for `buildPostTradeTeamsSnapshot` entitlement routing (2-team, 3-team, invariant, preservation) |
| `tests/entitlements/tradeReceiptEntitlements.test.js` | 7     | Tests for sanitization of vacuum metadata and receipt field completeness                              |

### Audited, No Changes Needed (1 file)

| File                                                                  | Reason                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/entitlements/sanitizeVacuumMetadata.ts` | Already handles `__vacuumEdited` and `__vacuumSessionOnly`. No new internal fields introduced. |

---

## Key Data Flows

### Vacuum Mode (No World Selected)

```
User clicks "Apply Trade"
  → TradeEditor.jsx iterates outgoingEntitlements
    → applyVacuumTransfer(entId, fromTeam, toTeam) per entitlement
      → TransferRecord stored in localStorage envelope.transfers
    → refreshEntitlements() called
      → entitlementResolver reads vacuum transfers
        → Excludes transferred-out from original team
        → Fetches + patches transferred-in for receiving team
          → UI shows updated ownership
```

### World Mode (Firestore)

```
User clicks "Apply Trade"
  → onApplyTrade(tradeData) called
    → applyTradeToCapSheet updates local entitlementIds[]
    → persistMutation('executeTrade', { teams }) called
      → computeTradeResult builds entitlementUpdates[]
      → persistWorldMutation:
        → writeBatch.set(entitlementRef, { holderTeam }, { merge: true })
        → Atomic commit with all other trade mutations
```

### Post-Trade Validation (Both Modes)

```
Trade editor opens
  → teams[].entitlementsOut populated by user
  → validateTrade() invoked
    → computePostTradeEntitlements() computes post-trade inventory
    → buildStepienOutgoingPicksFromEntitlements() creates pick-like objects
    → Stepien rule checks run against post-trade state
    → buildPostTradeTeamsSnapshot() moves entitlementIds between teams
      → Invariant check: no entitlement on multiple teams
```

---

## Acceptance Checklist

| #   | Criterion                                                  | Status                                      |
| --- | ---------------------------------------------------------- | ------------------------------------------- |
| 1   | User can add/remove entitlements to a trade like players   | ✅ Pre-existing UX                          |
| 2   | Validation uses post-trade entitlement ownership (Stepien) | ✅ `computePostTradeEntitlements`           |
| 3   | Executing trade transfers ownership — vacuum mode          | ✅ `applyVacuumTransfer` + resolver         |
| 4   | Executing trade transfers ownership — world mode           | ✅ `mutationPipeline` entitlement overrides |
| 5   | Local cap sheet state updated with new entitlementIds      | ✅ `applyTradeToCapSheet`                   |
| 6   | No writes to `architect_base*` collections                 | ✅ All writes go to world overlay           |
| 7   | No Firestore in vacuum mode                                | ✅ Uses localStorage only                   |
| 8   | Receipt/export includes entitlement data                   | ✅ Payload includes fields                  |
| 9   | Vacuum metadata stripped in export                         | ✅ `sanitizeVacuumMetadata` unchanged       |
| 10  | Invariant: no entitlement on 2+ teams post-trade           | ✅ `tradeContext.js` assertion              |
| 11  | All tests pass                                             | ✅ 230 files, 3014 tests, 0 failures        |
| 12  | Production build succeeds                                  | ✅                                          |

---

## Known Limitations

1. **Draft picks (`picksOut`)**: Still set to `[]` — legacy pick objects are not traded through this system. Only entitlements (pick rights) are transferred.
2. **Undo/rollback**: No undo mechanism for vacuum transfers. User can clear the entire vacuum overlay with `clearVacuumOverlay()`.
3. **Cross-session vacuum transfers**: Transfers persist in localStorage per-browser. Clearing browser data loses them.
4. **3+ team trades without `toTeamId`**: Entitlements without explicit routing are silently skipped with a console warning. Validation should block this upstream.

---

## Smoke Test Checklist (Manual)

- [ ] Start dev server, navigate to Trade Machine
- [ ] Add 2 teams, add an entitlement to one team's outgoing
- [ ] Verify entitlement appears in trade summary
- [ ] Click "Apply Trade" in vacuum mode → verify entitlement moved to receiving team
- [ ] Select a world → repeat trade → verify entitlement persists in world overlay
- [ ] Verify Stepien validation still works with traded entitlements
