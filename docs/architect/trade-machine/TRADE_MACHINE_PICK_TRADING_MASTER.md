# Trade Machine — Pick Entitlement Trading Master Doc

**Ticket:** TM-PICKS-E1  
**Status:** In Progress  
**Last Updated:** 2026-02-13

---

## 1. Current Behavior (Pre-TM-PICKS-E1)

### What Works

| Feature                                  | Status     | Key Files                                            |
| ---------------------------------------- | ---------- | ---------------------------------------------------- |
| Entitlement selection checkboxes         | ✅ Working | `EntitlementPicksList.jsx`, `EntitlementPickRow.jsx` |
| Toggle entitlement in/out of trade       | ✅ Working | `useTradeMachine.js` → `toggleEntitlement()`         |
| 2-team auto-destination routing          | ✅ Working | Auto-sets `toTeamId` for 2-team trades               |
| 3+ team destination dropdown             | ✅ Working | `setEntitlementDestination()`                        |
| Validation: routing/uniqueness/ownership | ✅ Working | `validateEntitlementRouting.js`                      |
| Validation: Stepien (entitlements SSOT)  | ✅ Working | `validateStepien.js` + `stepienEntitlementUtils.js`  |
| Receipt display                          | ✅ Working | `TradeReceiptPanel.jsx` (dev-gated)                  |
| Export capture                           | ✅ Working | `TradeExportCapture.jsx`                             |
| Vacuum entitlement editing/creating      | ✅ Working | `vacuumEntitlementOverlayStore.ts`                   |

### What's Missing (Gaps)

| Gap                                          | Severity     | Detail                                                                         |
| -------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `applyTradeToCapSheet` drops entitlements    | **Critical** | Persistence payload has `picksOut: []` — entitlement transfers never persisted |
| Local state not updated for entitlements     | **Critical** | `entitlementIds[]` on cap sheet not modified on trade apply                    |
| `holderTeam` not updated on entitlement docs | **High**     | Only `entitlementIds[]` arrays change; doc-level `holderTeam` stays stale      |
| No world entitlement overrides on trade      | **High**     | `persistWorldMutation` doesn't write entitlement doc patches                   |
| Vacuum mode can't trade entitlements         | **High**     | No `transfers` operation in `vacuumEntitlementOverlayStore.ts`                 |
| Resolver doesn't handle vacuum transfers     | **Medium**   | No logic to exclude transferred-out / include transferred-in entitlements      |

---

## 2. Target Behavior (Post-TM-PICKS-E1)

After implementation, a user can:

1. **Select** entitlements for trade via existing checkboxes (already works)
2. **Validate** the trade — Stepien and routing rules check post-trade ownership (already works)
3. **Apply** the trade — entitlement ownership transfers:
   - Local `entitlementIds[]` arrays updated on cap sheet
   - Persistence payload includes entitlement transfer data
   - World mode: `holderTeam` patched on entitlement docs in world overlay
   - Sandbox mode: transfers recorded in localStorage overlay
4. **Resolve** — after trade, resolver returns correct entitlements per team
5. **Receipt/Export** — show transferred entitlements (already works)

---

## 3. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  SELECT                                                          │
│  toggleEntitlement() → entitlementsOut[] on team slot            │
│  setEntitlementDestination() → toTeamId on entitlement          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  VALIDATE                                                        │
│  validateEntitlementRouting() → uniqueness, routing, ownership   │
│  validateStepien() → consecutive 1st check using entitlements   │
│  computePostTradeEntitlements() → post-trade Stepien awareness  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  APPLY TRADE                                                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  TradeEditor "Apply Trade" button                         │   │
│  │  1. exportCurrentTrade() → tradeData[]                    │   │
│  │  2. IF vacuum mode: applyVacuumTransfer() per entitlement │   │
│  │  3. onApplyTrade(tradeData) →                             │   │
│  │     applyTradeToCapSheet(tradeData)                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  applyTradeToCapSheet:                                           │
│  ├─ Local: remove outgoing entitlementIds, add incoming          │
│  └─ Persist: include entitlements in mutation payload             │
│                                                                  │
│  computeWorldMutation (world mode):                              │
│  ├─ buildPostTradeTeamsSnapshot → updated entitlementIds[]       │
│  ├─ computeTradeResult → entitlementUpdates[] (holderTeam patch) │
│  └─ persistWorldMutation → write entitlement overrides           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  RESOLVE (post-trade)                                            │
│                                                                  │
│  resolveEntitlementsForTeam():                                   │
│  ├─ World: team.entitlementIds[] has updated ownership           │
│  │         entitlement doc has patched holderTeam                 │
│  └─ Vacuum: overlay.transfers excludes out, includes in          │
│            resolver fetches transferred-in base docs              │
│            patches holderTeam on resolved docs                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. File Changes Summary

| File                               | Change                                                   |
| ---------------------------------- | -------------------------------------------------------- |
| `vacuumEntitlementOverlayStore.ts` | Add `transfers` section + CRUD                           |
| `entitlementResolver.ts`           | Handle `transfers` in vacuum resolution                  |
| `useArchitectActions.ts`           | Wire entitlement data in `applyTradeToCapSheet`          |
| `mutationPipeline.js`              | Build `entitlementUpdates`, persist `holderTeam` patches |
| `TradeEditor.jsx`                  | Call vacuum transfer on apply                            |
| `stepienEntitlementUtils.js`       | Add `computePostTradeEntitlements` helper                |
| `sanitizeVacuumMetadata.ts`        | Audit: confirm no leaks                                  |

---

## 5. Acceptance Checklist

- [x] User can trade entitlements end-to-end without a world selected
- [x] Sandbox transfers persist across refresh (localStorage overlay) and never hit Firestore
- [x] World transfers persist as world overrides and appear correctly on reload
- [x] After trade execute, teams immediately show correct entitlements
- [x] Validation updates reflect post-trade ownership
- [x] Receipts/exports show entitlements clearly
- [x] No user-facing "vacuum" wording
- [x] `holderTeam` updated on entitlement docs (world + vacuum)
- [x] No writes to `architect_base*` collections
- [x] All tests pass (230 files, 3014 tests, 0 failures)
- [x] Production build succeeds

---

## 6. Known Limitations

- **No swap/conveyance simulation**: Trading a `swap_right` or `conveyance_right` transfers ownership only. No swap-outcome or pool-resolution simulation.
- **No cross-reference conflict detection**: Trading a `swap_right` whose underlying pick is also being traded is not validated.
- **Stepien is conservative**: Protection ladders and conveyance pools emit warnings but always reserve years.
