# PST Phase 11.3 — Entitlements in Trade Receipt + Event Log

**MODE**: PREFLIGHT RETURN PACKAGE  
**DATE**: 2026-01-22  
**STATUS**: Ready for Execution

---

## 1. Goal

Make entitlement trades **observable** in two surfaces:

1. **Trade Receipt Panel** — Developer-only debug panel displaying what entitlements moved
2. **World Event Log** — Persisted `architect_worlds/{worldId}/events/{eventId}` documents for history/audit UI

This is purely "make it observable." No new validation rules. No new trade mechanics.

---

## 2. Current Receipt Surface and How It Works

### 2.1 File Locations

| Component                | File Path                                                            | Purpose                                                      |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| Trade Receipt Panel      | `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`          | Debug-only panel showing Trade Receipt JSON                  |
| Validation Details Panel | `src/features/architect/tradeMachine/ValidationDetailsPanel.jsx`     | Parent that renders TradeReceiptPanel in Section 5           |
| Trade Validator          | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Generates `tradeReceipt` object via `generateTradeReceipt()` |

### 2.2 Data Flow

```
validateTrade()
  → generateTradeReceipt({teamsWithAssets, teamResults, context, ...})
  → returns result.tradeReceipt

ValidationDetailsPanel
  → receives result from validator
  → passes result.tradeReceipt to <TradeReceiptPanel receipt={result?.tradeReceipt} />
```

### 2.3 Current Trade Receipt Schema (per-team)

```javascript
// From generateTradeReceipt() in tradeValidator.js lines 107-237
{
  teamCode: string,
  teamName: string,
  preTradeTeamSalary: number,
  preTradeTeamSalarySource: string,
  outgoingPlayers: [{ id, name, baseSalary, matchingValue, flags, bycDetails }],
  incomingPlayers: [{ id, name, baseSalary, matchingValue, flags, poisonPillDetails, tradeKickerDetails }],
  totals: { outgoingBaseTotal, outgoingMatchingTotal, incomingBaseTotal, incomingMatchingTotal },
  salaryMatchingEvaluation: { ruleApplied, skipReason, formulaUsed, allowableIncoming, actualIncoming, passed, margin, capSettings, capSettingsSource },
  violations: string[],
  warnings: string[],
}
```

**Gap**: No `outgoingEntitlements` or `incomingEntitlements` fields exist in the trade receipt.

### 2.4 TradeReceiptPanel UI Sections (current)

1. Header with LEGAL/ILLEGAL badge + version
2. Quick summary (Year, Season, Teams, Violations)
3. Cap Settings Used (Phase 4)
4. Cap Settings Warnings (if any)
5. Primary Violation Alert (if illegal)
6. Expanded view:
   - Per-team summary cards with players in/out, salary flow, violations/warnings
   - Full Receipt JSON

**Gap**: No entitlements section in the per-team cards or receipt data.

---

## 3. Current Event Log Shape and Where It's Written

### 3.1 File Location

| Function                 | File Path                                          | Line Range      |
| ------------------------ | -------------------------------------------------- | --------------- |
| `persistWorldMutation()` | `src/features/architect/utils/mutationPipeline.js` | Lines 2040-2135 |

### 3.2 Event Document Schema (current)

```javascript
// Written at line 2092-2101 in mutationPipeline.js
const event = {
  eventId: string,           // e.g., "trade_1737590400000_abc123"
  type: string,              // mutationType, e.g., "executeTrade"
  timestamp: string,         // ISO timestamp
  seasonId: string,          // e.g., "2025-26"
  metadata: {                // from computeResult.metadata (sanitized)
    type: 'trade',
    teamsInvolved: string[], // teamCodes
    playersTraded: string[], // player IDs
    timestamp: number,
  },
  teamsAffected: string[],   // teamCodes from teamUpdates
};
```

### 3.3 Metadata Source for Trades

```javascript
// From computeTradeResult() at line ~998 in mutationPipeline.js
return {
  success: true,
  teamUpdates,
  playerUpdates,
  metadata: {
    type: 'trade',
    teamsInvolved: teamUpdates.map((u) => u.teamCode),
    playersTraded: payload.teams.flatMap((t) =>
      (t.sends || []).map((p) => p.player_id || p.id || p.name)
    ),
    timestamp,
  },
};
```

**Gap**: No `entitlementsTraded` field in metadata. The event log doesn't capture entitlement transfers.

### 3.4 Event Log Storage Model

The event log stores the **computed mutation result** (what actually changed), not the raw requested payload:

- `teamUpdates` contains the post-mutation team snapshots
- `metadata` is derived from the mutation result
- The event document is a summary of what changed, not a copy of the input payload

This is the correct model for audit purposes — it shows what _actually_ happened.

---

## 4. Proposed Event Log Additions for Entitlements

### 4.1 Metadata Extension (Lightweight)

Add to `computeResult.metadata` in `computeTradeResult()`:

```javascript
metadata: {
  type: 'trade',
  teamsInvolved: [...],
  playersTraded: [...],
  picksTraded: [...],           // Already missing - could add for completeness
  entitlementsTraded: {
    // Per-team summary: { teamCode: { out: string[], in: string[] } }
    BOS: { out: ['ent_abc123'], in: ['ent_xyz789'] },
    MIA: { out: ['ent_xyz789'], in: ['ent_abc123'] },
  },
  timestamp,
},
```

### 4.2 Alternative: Flat Arrays (Simpler)

```javascript
metadata: {
  type: 'trade',
  teamsInvolved: [...],
  playersTraded: [...],
  entitlementIdsTraded: string[],  // All entitlement IDs that moved (deduped)
  timestamp,
},
```

### 4.3 Recommended Approach

Use the **per-team structure** from 4.1 because:

- Audit UI needs to know which team sent/received each entitlement
- Consistent with how `playersTraded` could be enhanced
- Small payload (just IDs, not full objects)

---

## 5. Proposed Receipt UI Additions

### 5.1 Trade Receipt Data Extension

In `generateTradeReceipt()` (tradeValidator.js), add to each team receipt:

```javascript
return {
  teamCode,
  teamName,
  // ... existing fields ...
  outgoingEntitlements: team.outgoingEntitlements || team.entitlementsOut || [],
  incomingEntitlements: team.incomingEntitlements || team.entitlementsIn || [],
};
```

### 5.2 TradeReceiptPanel UI Extension

In expanded per-team card, add a new section after players:

```jsx
{
  /* Entitlements */
}
{
  (team.outgoingEntitlements?.length > 0 ||
    team.incomingEntitlements?.length > 0) && (
    <div className="mb-2">
      {team.outgoingEntitlements?.length > 0 && (
        <div className="mb-1">
          <div className="text-white/40 text-xs mb-1">Entitlements Out:</div>
          {team.outgoingEntitlements.map((ent, eIdx) => (
            <div key={eIdx} className="text-xs pl-2 py-0.5">
              {ent.seasonYear} R{ent.round} — {ent.kind}
              <span className="text-white/40 ml-1">
                ({ent.entitlementId || ent.id})
              </span>
            </div>
          ))}
        </div>
      )}
      {team.incomingEntitlements?.length > 0 && (
        <div>
          <div className="text-white/40 text-xs mb-1">Entitlements In:</div>
          {team.incomingEntitlements.map((ent, eIdx) => (
            <div key={eIdx} className="text-xs pl-2 py-0.5">
              {ent.seasonYear} R{ent.round} — {ent.kind}
              <span className="text-white/40 ml-1">
                ({ent.entitlementId || ent.id})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 6. Minimal File List for Execution

| File                                                                 | Change Type | Description                                                                                        |
| -------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/mutationPipeline.js`                   | MODIFY      | Add `entitlementsTraded` to trade metadata in `computeTradeResult()`                               |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | MODIFY      | Add `outgoingEntitlements` and `incomingEntitlements` to team receipts in `generateTradeReceipt()` |
| `src/features/architect/tradeMachine/TradeReceiptPanel.jsx`          | MODIFY      | Add Entitlements In/Out section in expanded team cards                                             |

**Total**: 3 files

---

## 7. Acceptance Criteria

| ID   | Criterion                                                                             | Validation Method                                   |
| ---- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| AC-1 | Trade Receipt includes `outgoingEntitlements[]` and `incomingEntitlements[]` per team | Inspect receipt JSON in TradeReceiptPanel           |
| AC-2 | TradeReceiptPanel displays entitlements in/out in expanded team cards                 | Visual inspection with VITE_SHOW_TRADE_RECEIPT=true |
| AC-3 | Event metadata includes `entitlementsTraded` structure with per-team in/out IDs       | Inspect Firestore event doc after trade execution   |
| AC-4 | Build passes with no new errors                                                       | `npm run build` succeeds                            |
| AC-5 | Existing tests continue to pass                                                       | `npm run test -- --run` passes                      |

---

## 8. Validation Plan

### 8.1 Emulator Validation

1. Start Firestore emulator
2. Create or load a world with entitlements
3. Execute a trade that includes entitlements
4. Inspect `architect_worlds/{worldId}/events/{eventId}` document
5. Verify `metadata.entitlementsTraded` contains correct per-team in/out IDs

### 8.2 Dev UI Validation

1. Set `VITE_SHOW_TRADE_RECEIPT=true` in `.env`
2. Run dev server: `npm run dev`
3. Navigate to Trade Machine
4. Select two teams with entitlements
5. Add entitlements to trade (via EntitlementSelector)
6. Observe:
   - TradeSummaryPanel shows "Entitlements Traded" (Phase 11.2 — already done)
   - TradeReceiptPanel shows entitlements in/out in expanded cards (NEW)
   - Full Receipt JSON includes `outgoingEntitlements` and `incomingEntitlements` (NEW)
7. Execute trade
8. Verify world snapshot updated correctly (Phase 11.1 — already done)

### 8.3 Build Validation

```bash
npm run build  # Must succeed
npm run test -- --run  # Existing tests must pass
```

---

## 9. Stop Conditions / Blockers

| Condition                                                        | Action                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `generateTradeReceipt()` doesn't have access to entitlement data | Need to thread `team.entitlementsOut` through `teamsWithAssets` — investigate upstream enrichment |
| Entitlement objects are too large to store in event log          | Store only IDs + minimal display metadata (year, round, kind)                                     |
| Event log schema validation fails                                | Check Firestore security rules for `events` subcollection                                         |

---

## 10. Phase 11.3 Execution Prompt

````
# AGENT PROMPT — PHASE 11.3 EXECUTION
## Entitlements in Trade Receipt + Event Log (World History)

MODE
EXECUTION — Implement the minimal changes

MASTER DOC (UPDATE REQUIRED)
docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md

Update Phase 11.3:
- Status: COMPLETE
- Date: <today>

------------------------------------------------------------
PREFLIGHT DOC (REFERENCE)
docs/team-scrape/PST_PHASE_11_3_ENTITLEMENTS_IN_RECEIPT_AND_EVENT_LOG_PREFLIGHT_RETURN_PACKAGE.md

------------------------------------------------------------
GOAL

Wire entitlement data into:
1) The Trade Receipt debug panel (immediate visual feedback)
2) The persisted event log metadata (for history/audit UI)

------------------------------------------------------------
IMPLEMENTATION STEPS

### Step 1: Extend Trade Metadata in computeTradeResult()

File: src/features/architect/utils/mutationPipeline.js
Location: computeTradeResult() return statement (~line 998)

Add `entitlementsTraded` to metadata:

```javascript
return {
  success: true,
  teamUpdates,
  playerUpdates,
  metadata: {
    type: 'trade',
    teamsInvolved: teamUpdates.map((u) => u.teamCode),
    playersTraded: payload.teams.flatMap((t) =>
      (t.sends || []).map((p) => p.player_id || p.id || p.name)
    ),
    // NEW: Entitlement transfers per team
    entitlementsTraded: payload.teams.reduce((acc, teamTrade) => {
      const teamCode = teamTrade.team?.id || teamTrade.teamCode;
      const outIds = (teamTrade.outgoingEntitlements || teamTrade.entitlementsOut || [])
        .map((e) => e.entitlementId || e.id);
      // Compute incoming from other teams' outgoing
      const inIds = [];
      payload.teams.forEach((otherTrade) => {
        if ((otherTrade.team?.id || otherTrade.teamCode) !== teamCode) {
          (otherTrade.outgoingEntitlements || otherTrade.entitlementsOut || [])
            .forEach((e) => inIds.push(e.entitlementId || e.id));
        }
      });
      acc[teamCode] = { out: outIds, in: inIds };
      return acc;
    }, {}),
    timestamp,
  },
};
````

### Step 2: Extend generateTradeReceipt() to Include Entitlements

File: src/features/architect/utils/tradeMachine/engine/tradeValidator.js
Location: generateTradeReceipt() team receipt builder (~line 107-237)

Add to each team receipt:

```javascript
// After incomingPlayers map...

// Build outgoing entitlements list
const outgoingEntitlements = (
  team.outgoingEntitlements ||
  team.entitlementsOut ||
  []
).map((ent) => ({
  id: ent.entitlementId || ent.id,
  seasonYear: ent.seasonYear,
  round: ent.round,
  kind: ent.kind,
  description: ent.description,
}));

// Build incoming entitlements list (from other teams' outgoing)
const incomingEntitlements = [];
teamsWithAssets.forEach((otherTeam, otherIndex) => {
  if (otherIndex !== index) {
    (otherTeam.outgoingEntitlements || otherTeam.entitlementsOut || []).forEach(
      (ent) => {
        incomingEntitlements.push({
          id: ent.entitlementId || ent.id,
          seasonYear: ent.seasonYear,
          round: ent.round,
          kind: ent.kind,
          description: ent.description,
          fromTeam: otherTeam.team?.id || otherTeam.team?.teamId,
        });
      }
    );
  }
});

// Return team receipt with entitlements
return {
  teamCode,
  teamName,
  // ... existing fields ...
  outgoingEntitlements,
  incomingEntitlements,
  violations: teamResult?.violations || [],
  warnings: teamResult?.warnings || [],
};
```

### Step 3: Add Entitlements Section to TradeReceiptPanel

File: src/features/architect/tradeMachine/TradeReceiptPanel.jsx
Location: Inside expanded per-team card, after players section (~line 380)

Add:

```jsx
{
  /* Entitlements */
}
{
  (team.outgoingEntitlements?.length > 0 ||
    team.incomingEntitlements?.length > 0) && (
    <div className="mb-2">
      {team.outgoingEntitlements?.length > 0 && (
        <div className="mb-2">
          <div className="text-white/40 text-xs mb-1">Entitlements Out:</div>
          {team.outgoingEntitlements.map((ent, eIdx) => (
            <div
              key={ent.id || eIdx}
              className="text-xs pl-2 py-0.5 border-l border-amber-500/30"
            >
              <span className="text-amber-300">
                {ent.seasonYear} R{ent.round}
              </span>
              <span className="text-white/60 ml-1">— {ent.kind}</span>
              <span className="text-white/30 ml-1 text-[10px]">({ent.id})</span>
            </div>
          ))}
        </div>
      )}
      {team.incomingEntitlements?.length > 0 && (
        <div>
          <div className="text-white/40 text-xs mb-1">Entitlements In:</div>
          {team.incomingEntitlements.map((ent, eIdx) => (
            <div
              key={ent.id || eIdx}
              className="text-xs pl-2 py-0.5 border-l border-green-500/30"
            >
              <span className="text-green-300">
                {ent.seasonYear} R{ent.round}
              </span>
              <span className="text-white/60 ml-1">— {ent.kind}</span>
              <span className="text-white/30 ml-1 text-[10px]">({ent.id})</span>
              {ent.fromTeam && (
                <span className="text-white/30 ml-1">from {ent.fromTeam}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

VALIDATION

1. Build check: `npm run build`
2. Test check: `npm run test -- --run`
3. Visual validation:
   - Set VITE_SHOW_TRADE_RECEIPT=true
   - Execute a trade with entitlements
   - Verify TradeReceiptPanel shows entitlements in/out
   - Verify Full Receipt JSON includes entitlement data
4. Event log validation:
   - Check Firestore event document for entitlementsTraded

---

ACCEPTANCE CRITERIA

- [ ] AC-1: Trade Receipt includes outgoingEntitlements[] and incomingEntitlements[] per team
- [ ] AC-2: TradeReceiptPanel displays entitlements in/out in expanded team cards
- [ ] AC-3: Event metadata includes entitlementsTraded structure with per-team in/out IDs
- [ ] AC-4: Build passes with no new errors
- [ ] AC-5: Existing tests continue to pass

---

OUTPUT

1. Update master doc with COMPLETE status
2. Create execution return package:
   docs/team-scrape/PST_PHASE_11_3_ENTITLEMENTS_IN_RECEIPT_AND_EVENT_LOG_EXECUTION_RETURN_PACKAGE.md

```

---

## 11. Summary

Phase 11.3 is a lightweight observability enhancement that makes entitlement trades visible in:

1. **Trade Receipt Panel** — Debug-only UI showing entitlements in/out per team
2. **Event Log** — Persisted metadata for history/audit purposes

The implementation touches only 3 files with minimal, additive changes. No validation logic changes. No new trade mechanics.

**Ready for execution.**
```
