# TM_SEC_A3 — Picks + Entitlements Section Audit

**Section:** 7 (Picks + Entitlement Editor)  
**Audit Date:** 2026-02-14  
**Audit Type:** PREFLIGHT (Discovery-only)  
**Status:** ✅ PASS (with caveats)

---

## Files Referenced (11 total)

| #   | File                                                                            | Purpose                                   |
| --- | ------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | `src/features/architect/tradeMachine/EntitlementPicksList.jsx`                  | Pick/entitlement UI list                  |
| 2   | `src/features/architect/tradeMachine/EntitlementPickRow.jsx`                    | Individual pick row rendering             |
| 3   | `src/features/architect/tradeMachine/TradeTeamCard.jsx`                         | Team card that hosts EntitlementPicksList |
| 4   | `src/features/architect/tradeMachine/TradeEditor.jsx`                           | Main trade editor orchestrator            |
| 5   | `src/features/architect/hooks/useTradeMachine.js`                               | Trade session state management            |
| 6   | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`            | Main trade validator                      |
| 7   | `src/features/architect/utils/tradeMachine/rules/validateStepien.js`            | Stepien rule validation                   |
| 8   | `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` | Multi-team routing validation             |
| 9   | `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`                     | Trade summary display                     |
| 10  | `src/features/architect/tradeMachine/TradeExportCapture.jsx`                    | Export capture component                  |
| 11  | `src/features/architect/admin/PickRightWizardModal.tsx`                         | Protection/pick editing wizard            |

---

## How It Works Today

### 1. Pick Source of Truth

**Source:** Entitlement Resolver (`resolveEntitlementsForTeam()`)

```
Firestore /architect/:worldId/entitlements/:entitlementId
    ↓
resolveEntitlementsForTeam() [entitlementResolver.js]
    ↓
team.entitlements[] (decorated via decorateEntitlementForTrade)
    ↓
EntitlementPicksList renders from team.entitlements
```

**Evidence:**

- [useTradeMachine.js](src/features/architect/hooks/useTradeMachine.js#L13) imports `resolveEntitlementsForTeam`
- [TradeTeamCard.jsx](src/features/architect/tradeMachine/TradeTeamCard.jsx#L735) passes `team.entitlements` to `EntitlementPicksList`

### 2. UI → State Flow

```
User clicks entitlement checkbox
    ↓
onToggleEntitlement callback [EntitlementPicksList.jsx:L38]
    ↓
toggleEntitlement(index, entitlement) [useTradeMachine.js:L597-637]
    ↓
teams[index].entitlementsOut[] += decorated entitlement
    ↓
For 2-team trades: auto-sets toTeamId to other team
For 3+ team trades: toTeamId = null (requires user selection)
```

**State Shape:**

```javascript
teams[idx] = {
  team: { id, entitlements[], entitlementIds[], ... },
  sends: [],
  entitlementsOut: [
    {
      id,
      entitlementId,
      seasonYear,
      round,
      kind,           // 'pick_ownership' | 'swap_right' | 'conveyance_right'
      fromTeamId,
      toTeamId,       // null for 3+ team until explicitly set
      terms,
      termsShort,
      ...decoratedFields
    }
  ]
}
```

### 3. State → Validator Flow

```
useTradeMachine.validateCurrentTrade()
    ↓
validateTrade({ teams: [...] }) [tradeValidator.js:L862-881]
    ↓
Each team gets: { team, sends, entitlementsOut, validationEntitlements }
    ↓
validateStepien(team, context) [validateStepien.js:L124]
    ├── Builds outgoing picks from entitlementsOut
    ├── Builds baseline from validationEntitlements
    └── Checks consecutive year violations
    ↓
validateEntitlementRouting({ teams }) [validateEntitlementRouting.js:L55]
    ├── Uniqueness: Same ID can't be in multiple teams
    ├── Routing: 3+ teams require explicit toTeamId
    ├── Destination: toTeamId must be valid trade participant
    └── Ownership: Team must own the entitlement being traded
```

### 4. State → Summary/Export Flow

**TradeSummaryPanel:**

```javascript
// TradeSummaryPanel.jsx:L98
const entitlementsOut = teamSlot?.entitlementsOut || [];

// L102-105: Incoming derived from OTHER teams' outgoing
const incomingEntitlements = teams
  .filter((ts) => ts.team?.id !== thisTeamId)
  .flatMap((ts) => ts.entitlementsOut || [])
  .filter((e) => !e.toTeamId || e.toTeamId === thisTeamId);
```

**TradeExportCapture:**

```javascript
// TradeExportCapture.jsx:L43-54
(t.entitlementsOut || []).forEach((e) => {
  if (!e.toTeamId || e.toTeamId === tm.team?.id) {
    entitlements.push(sanitizeEntitlement({ ...e, fromTeamId: t.team.id }));
  }
});
```

---

## Single Source of Truth Check

| Component                   | Source                            | SSOT?  |
| --------------------------- | --------------------------------- | ------ |
| UI (EntitlementPicksList)   | `team.entitlements` from resolver | ✅ YES |
| State (selection)           | `teams[idx].entitlementsOut`      | ✅ YES |
| Validator (Stepien)         | `team.entitlementsOut`            | ✅ YES |
| Validator (Routing)         | `teams[].entitlementsOut`         | ✅ YES |
| Summary (TradeSummaryPanel) | `teamSlot?.entitlementsOut`       | ✅ YES |
| Export (TradeExportCapture) | `t.entitlementsOut`               | ✅ YES |

**Verdict:** ✅ PASS — All components read from the same `entitlementsOut` state array.

---

## Mismatch List

| Item                            | Found      | Notes                                                            |
| ------------------------------- | ---------- | ---------------------------------------------------------------- | --- | ------------------------ |
| UI vs Validator entitlement IDs | ✅ Match   | Both use `e.id                                                   |     | e.entitlementId` pattern |
| Validator vs Summary            | ✅ Match   | Both derive from same `entitlementsOut`                          |
| Summary vs Export               | ✅ Match   | Export uses `sanitizeEntitlement()` but same source              |
| Protection visibility           | ⚠️ Partial | UI shows `terms/termsShort`, validator uses for Stepien warnings |

---

## Protection Editing Status

**IMPLEMENTED** via `PickRightWizardModal.tsx`

1. **Edit Mode:** Opens wizard with existing entitlement data
2. **Protection Fields:** `protectionLadder`, `conveyance` terms supported
3. **Persist Mode:**
   - Vacuum mode: Uses `vacuumEntitlementOverlayStore` for session-only edits
   - World mode: Writes to Firestore via `writeWorldEntitlement()`
4. **State Sync:** `applyEntitlementOverrideUpdate()` in useTradeMachine applies edits

**Evidence:**

- [PickRightWizardModal.tsx](src/features/architect/admin/PickRightWizardModal.tsx#L1-20) — TM-4, TM-7, TM-8, TM-9 references
- [TradeEditor.jsx](src/features/architect/tradeMachine/TradeEditor.jsx#L148-180) — `handleEditEntitlement` handler

---

## Swap Handling Status

**IMPLEMENTED** — kind = `swap_right`

- Supported in entitlement schema (`kind: 'swap_right'`)
- Sorting priority in [EntitlementPicksList.jsx](src/features/architect/tradeMachine/EntitlementPicksList.jsx#L76-81)
- Stepien considers swap type (`swapType === 'worst_of'` does NOT reserve year)
- UI badge support in `getEntitlementKindBadge()` → displays "SWAP" badge

**Evidence:**

- [validateStepien.js](src/features/architect/utils/tradeMachine/rules/validateStepien.js#L20-30) — `reservesYearForStepien()` handles swaps

---

## Multi-Team Routing Status

**IMPLEMENTED** — Phase 17 closure

| Check                               | Status | Evidence                                                                                                                |
| ----------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Uniqueness (no duplicate IDs)       | ✅     | [validateEntitlementRouting.js](src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js#L99-105)  |
| Routing (3+ teams require toTeamId) | ✅     | [validateEntitlementRouting.js](src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js#L112-116) |
| Destination validity                | ✅     | [validateEntitlementRouting.js](src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js#L119-123) |
| Cannot route to self                | ✅     | [validateEntitlementRouting.js](src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js#L126-129) |
| Ownership verification              | ✅     | [validateEntitlementRouting.js](src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js#L132-136) |

---

## Stepien Rule Status

**IMPLEMENTED** — Phase 13 SSOT

| Feature                          | Status | Evidence                                                                                          |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Consecutive year check           | ✅     | [validateStepien.js](src/features/architect/utils/tradeMachine/rules/validateStepien.js#L240-253) |
| 7-year limit check               | ✅     | [validateStepien.js](src/features/architect/utils/tradeMachine/rules/validateStepien.js#L264-275) |
| Second apron frozen pick         | ✅     | [validateStepien.js](src/features/architect/utils/tradeMachine/rules/validateStepien.js#L281-290) |
| Meaningful protection bypass     | ✅     | Uses `isMeaningfulProtection()` helper                                                            |
| Entitlement-derived outgoing     | ✅     | `buildStepienOutgoingPicksFromEntitlements()`                                                     |
| Entitlement-derived baseline     | ✅     | `buildStepienBaselinePicksFromEntitlements()`                                                     |
| TM-5/TM-6 authored term warnings | ✅     | [validateStepien.js](src/features/architect/utils/tradeMachine/rules/validateStepien.js#L148-178) |

---

## Manual Scenario Scripts

### Scenario 1: Simple Pick Trade (2-team)

**Steps:**

1. Load Trade Machine
2. Select Team A (e.g., Lakers)
3. Select Team B (e.g., Celtics)
4. Go to "Picks" tab for Team A
5. Toggle a 2026 1st round pick
6. Click "Validate Trade"

**Expected:**

- Pick appears in "Entitlements Traded" section of summary
- Pick appears in Team B's "Entitlements Received"
- toTeamId auto-set to "BOS" (for 2-team trade)
- Stepien validation runs (may pass or warn depending on team basket)

### Scenario 2: Protected Pick Edit

**Steps:**

1. Follow Scenario 1 steps 1-5
2. Click the edit (pencil) icon on the selected entitlement
3. PickRightWizardModal opens
4. Modify protection terms (set protection tiers)
5. Apply changes
6. Re-validate trade

**Expected:**

- Modal shows current entitlement data
- Protection edits persist in session state
- Summary shows updated `termsShort` for protection
- Stepien validation may emit protection ladder warning

### Scenario 3: Stepien Violation Attempt

**Steps:**

1. Load Trade Machine
2. Select a team to trade FROM
3. Toggle 2026 1st round pick
4. Toggle 2027 1st round pick (consecutive year)
5. Click "Validate Trade"

**Expected:**

- Stepien validation fails with "Violates Stepien Rule (consecutive future 1sts)"
- Trade shows as illegal
- TradeLegalChecker displays stepienRule failure

**Caveat:** To reliably trigger Stepien, the team must not have baseline obligations that already reserve one of those years. Test with a team known to have a clean pick basket.

---

## Caveats / Known Gaps

1. **Phantom Pick Check:** No explicit UI indicator for "all expected picks accounted for". The system trusts the resolver output. If entitlement data is missing in Firestore, the UI simply shows fewer picks.

2. **Protection Impossible States:** No hard validation that protection terms are internally consistent (e.g., protection tiers must have ascending years). The wizard has some client-side validation but not exhaustive.

3. **Stepien Test Reliability:** Stepien tests depend on baseline entitlements. In vacuum mode without seed data, the baseline may be empty, making Stepien violations easier to trigger but less realistic.

---

## Summary

| Category                                | Status                  |
| --------------------------------------- | ----------------------- |
| Pick Source of Truth                    | ✅ PASS                 |
| UI → State → Validator → Summary/Export | ✅ PASS (single source) |
| Protection Editing                      | ✅ IMPLEMENTED          |
| Swap Handling                           | ✅ IMPLEMENTED          |
| Multi-team Routing                      | ✅ IMPLEMENTED          |
| Stepien Validation                      | ✅ IMPLEMENTED          |
| Validation Provides Clear Reasons       | ✅ PASS                 |

**Overall Section 7 Verdict:** ✅ PASS
