# TM_SEC_A3 — Return Package (Picks + Entitlements)

**Section:** 7 (Picks + Entitlement Editor)  
**Audit Date:** 2026-02-14  
**Audit Type:** PREFLIGHT (Discovery-only)  
**Result:** ✅ PASS

---

## Deliverables

| Deliverable     | Path                                                        | Status     |
| --------------- | ----------------------------------------------------------- | ---------- |
| Section Doc     | `docs/architect/audits/TM_SEC_A3_PICKS_ENTITLEMENTS.md`     | ✅ Created |
| Workbook Update | `docs/architect/audits/TM_AUDIT_WORKBOOK.md` (Section 7)    | ✅ Updated |
| Return Package  | `return_packages/trade_machine/TM_SEC_A3_RETURN_PACKAGE.md` | ✅ Created |

---

## Audit Questions Answered

### 1) What is the pick source of truth, and does UI read directly from it?

**Source:** Entitlement Resolver (`resolveEntitlementsForTeam()`)

**Flow:**

```
Firestore /architect/:worldId/entitlements/:entitlementId
    ↓
resolveEntitlementsForTeam() [entitlementResolver.js]
    ↓
team.entitlements[] → EntitlementPicksList
```

**Evidence:** `useTradeMachine.js` imports and uses `resolveEntitlementsForTeam()`. The resolved entitlements are passed as `team.entitlements` to `TradeTeamCard`, which passes to `EntitlementPicksList`.

✅ **UI reads directly from the canonical resolver output.**

---

### 2) Does the pick editor mutate the same trade session state used by summary/export/validation?

**Yes.** All paths use `teams[idx].entitlementsOut`:

| Component           | Reads From                                      | Evidence                            |
| ------------------- | ----------------------------------------------- | ----------------------------------- |
| UI Selection        | `toggleEntitlement()` updates `entitlementsOut` | `useTradeMachine.js:L597-637`       |
| Validator (Stepien) | `team.entitlementsOut`                          | `tradeValidator.js:L871`            |
| Validator (Routing) | `teams[].entitlementsOut`                       | `validateEntitlementRouting.js:L83` |
| TradeSummaryPanel   | `teamSlot?.entitlementsOut`                     | `TradeSummaryPanel.jsx:L98`         |
| TradeExportCapture  | `t.entitlementsOut`                             | `TradeExportCapture.jsx:L43`        |

✅ **Single source of truth for pick trading state.**

---

### 3) Are protections and swaps supported end-to-end?

**Protections:** ✅ IMPLEMENTED

- `PickRightWizardModal.tsx` (TM-4, TM-7, TM-8) allows editing protection terms
- Terms surface to UI via `termsShort` field
- Validator considers `hasProtectionLadder` for Stepien warnings

**Swaps:** ✅ IMPLEMENTED

- `kind: 'swap_right'` supported in entitlement schema
- UI shows SWAP badge via `getEntitlementKindBadge()`
- Stepien logic: `swapType === 'worst_of'` does NOT reserve year

**Evidence:**

- `validateStepien.js:L20-30` — `reservesYearForStepien()` handles swap cases
- `EntitlementPicksList.jsx:L76-81` — swap_right has sorting priority 3

---

### 4) Does pick routing handle multi-team trades without impossible ownership?

**Yes.** Phase 17 implemented `validateEntitlementRouting()` with these checks:

| Check        | Implementation                                                        |
| ------------ | --------------------------------------------------------------------- |
| Uniqueness   | Same entitlementId cannot appear in multiple teams' `entitlementsOut` |
| Routing      | 3+ team trades require explicit `toTeamId`                            |
| Destination  | `toTeamId` must reference a trade participant                         |
| Self-routing | Cannot route to the same team (`fromTeamId`)                          |
| Ownership    | Team must have `entitlementId` in their `entitlementIds` array        |

**Evidence:** `validateEntitlementRouting.js:L55-145` — all five checks implemented.

✅ **Multi-team routing prevents impossible ownership scenarios.**

---

## Section 7 Summary

| Item                           | Status     | Risk   |
| ------------------------------ | ---------- | ------ |
| Pick source of truth           | ✅ PASS    | LOW    |
| No phantom picks               | ⚠️ PARTIAL | MEDIUM |
| Pick identity stable           | ✅ PASS    | LOW    |
| Add/remove modifies same state | ✅ PASS    | LOW    |
| Protection editing persists    | ✅ PASS    | LOW    |
| Swap handling works            | ✅ PASS    | LOW    |
| Multi-team routing works       | ✅ PASS    | LOW    |
| Stepien rule enforced          | ✅ PASS    | LOW    |
| Protection impossible states   | ⚠️ PARTIAL | MEDIUM |
| Clear pick-legality reasons    | ✅ PASS    | LOW    |

**10 items audited. 0 FAIL. 2 PARTIAL with documented caveats. 8 full PASS.**

---

## Caveats / PARTIAL Items

### Phantom Picks (MEDIUM risk)

- System trusts resolver output
- Missing Firestore entitlements = fewer picks shown
- No explicit "expected vs actual" reconciliation
- **Mitigation:** Data integrity is managed externally; code correctly displays what exists

### Protection Impossible States (MEDIUM risk)

- Wizard has client-side validation
- No exhaustive server-side schema enforcement
- **Mitigation:** Wizard guides users through valid paths; edge cases are rare

---

## Files Referenced (11 total, within 12-file limit)

1. `src/features/architect/tradeMachine/EntitlementPicksList.jsx`
2. `src/features/architect/tradeMachine/EntitlementPickRow.jsx`
3. `src/features/architect/tradeMachine/TradeTeamCard.jsx`
4. `src/features/architect/tradeMachine/TradeEditor.jsx`
5. `src/features/architect/hooks/useTradeMachine.js`
6. `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
7. `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
8. `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js`
9. `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
10. `src/features/architect/tradeMachine/TradeExportCapture.jsx`
11. `src/features/architect/admin/PickRightWizardModal.tsx`

---

## Manual Scenario Scripts (from Section Doc)

### Scenario 1: Simple Pick Trade

1. Load Trade Machine → Select two teams
2. Go to "Picks" tab → Toggle a 2026 1st round pick
3. Validate trade
4. **Verify:** Pick appears in summary; `toTeamId` auto-set for 2-team trade

### Scenario 2: Protected Pick Edit

1. Select an entitlement
2. Click edit icon → PickRightWizardModal opens
3. Modify protection terms
4. Apply and re-validate
5. **Verify:** `termsShort` updates in summary

### Scenario 3: Stepien Violation

1. Select team with clean pick basket
2. Toggle consecutive 1st round picks (2026, 2027)
3. Validate
4. **Verify:** "Violates Stepien Rule (consecutive future 1sts)" error

---

## Next Steps (Optional)

No blocking issues discovered. Recommendations:

1. **Phantom pick detection:** Consider adding a reconciliation helper that compares expected picks (from team schedule) vs loaded entitlements
2. **Server-side validation:** Add Cloud Function to validate entitlement schema before writes
3. **Stepien test fixtures:** Create explicit test fixtures with known baseline obligations for reliable Stepien testing

---

**Audit Complete. Section 7 PASS.**
