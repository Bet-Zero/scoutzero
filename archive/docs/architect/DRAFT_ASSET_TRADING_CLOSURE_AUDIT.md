# DRAFT ASSET TRADING CLOSURE AUDIT

**Type**: PREFLIGHT + EXECUTION CLOSURE  
**Date**: 2026-02-03 (Preflight) → 2026-02-03 (Closure)  
**Scope**: Trade Machine draft pick / entitlement trading subsystem  
**Status**: ✅ CLOSED — ALL BLOCKERS RESOLVED

---

## PRIMARY OBJECTIVE

Audit whether **existing entitlements** can be traded correctly in 2-team and multi-team trades, specifically targeting two suspected blockers:

1. **Routing bug**: Selecting one entitlement appears to send the same entitlement to multiple receiving teams in 3+ team trades.
2. **Missing destination control**: User cannot choose which team receives a selected entitlement (checkbox-only UX).

---

## 1️⃣ CURRENT UX BEHAVIOR (OBSERVED + CODE TRACE)

### Behavior Summary

| Trade Type         | Observed Behavior    | Evidence                                                                  |
| ------------------ | -------------------- | ------------------------------------------------------------------------- |
| **2-team trade**   | ✅ Works correctly   | Entitlement from Team A goes to Team B (only other team)                  |
| **3-team trade**   | ❌ Duplicates appear | Entitlement selected by Team A appears as incoming for BOTH Teams B and C |
| **4/5-team trade** | ❌ Same as 3-team    | Broadcast to all non-sending teams                                        |

### What the UI Shows

**When a user checks an entitlement in a 2-team trade**:

- Entitlement appears in the sending team's "Outgoing" section
- Entitlement appears in the receiving team's "Incoming" section
- Behavior is correct (only one receiving team)

**When a user checks an entitlement in a 3+ team trade**:

- Entitlement appears in the sending team's "Outgoing" section
- **Entitlement appears in EVERY OTHER team's "Incoming" section** — this is the bug
- No mechanism exists to select destination

### UI Does NOT Auto-Assign Destinations

The UI does NOT prompt the user to select a destination team. Checking an entitlement is a binary toggle with no destination picker.

### Code Path Evidence

**Selection handler**: [useTradeMachine.js#L560-L585](src/features/architect/hooks/useTradeMachine.js#L560-L585)

```javascript
// Phase 11.1: Toggle entitlement selection for trading
const toggleEntitlement = useCallback((index, entitlement) => {
  setTeams((prev) => {
    // ...
    newTeams[index].entitlementsOut = [
      ...(newTeams[index].entitlementsOut || []),
      {
        ...entitlement,
        entitlementId,
        fromTeamId: newTeams[index].team?.id,
        // NOTE: toTeamId is NEVER set
      },
    ];
    // ...
  });
}, []);
```

**Key observation**: `fromTeamId` is set, but **`toTeamId` is NEVER set** during toggle.

**Incoming derivation (UI)**: [useTradeMachine.js#L237-L258](src/features/architect/hooks/useTradeMachine.js#L237-L258)

```javascript
const incomingAssets = useMemo(() => {
  return teams.map((tm, idx) => {
    const entitlements = [];
    teams.forEach((t, j) => {
      if (j !== idx && t.team) {
        (t.entitlementsOut || []).forEach((e) => {
          // CRITICAL: If toTeamId is NOT set, entitlement is included for ALL teams
          if (!e.toTeamId || e.toTeamId === tm.team?.id) {
            entitlements.push({ ...e, fromTeamId: t.team.id });
          }
        });
      }
    });
    return { teamId: tm.team?.id, players, entitlements };
  });
}, [teams]);
```

The condition `!e.toTeamId || e.toTeamId === tm.team?.id` causes **broadcast mode** when `toTeamId` is absent.

---

## 2️⃣ CURRENT TRADE PAYLOAD SHAPE (SSOT)

### Where Outgoing Entitlements Are Stored

```javascript
// Trade team slot state structure
teams[index] = {
  team: { id, teamCode, ... },
  sends: [],           // Outgoing players
  entitlementsOut: [], // Outgoing entitlements
};
```

### Entitlement Object Shape (Current)

When an entitlement is toggled, it is stored in `entitlementsOut[]` with this shape:

```typescript
interface EntitlementOut {
  id: string; // entitlement ID
  entitlementId: string; // duplicate of id (canonical)
  fromTeamId: string; // team sending the entitlement
  toTeamId?: string; // OPTIONAL: destination team (NEVER SET BY UI)
  seasonYear: number; // e.g., 2027
  round: number; // 1 or 2
  kind: string; // 'pick_ownership' | 'conveyance_right' | 'swap_right'
  description?: string; // human-readable description
  // ...other entitlement fields
}
```

### `toTeamId` Representation

- **Field exists**: The `toTeamId` field is recognized by the system (validator, apply, receipt)
- **Never populated by UI**: The `toggleEntitlement` handler does NOT set `toTeamId`
- **Routing respects it when present**: Both validator and apply logic have Phase 11.3.1 routing support

### Export Payload Shape

When trade is exported via `exportCurrentTrade()`: [useTradeMachine.js#L856-L870](src/features/architect/hooks/useTradeMachine.js#L856-L870)

```javascript
{
  teamId: t.team.id,
  outgoingPlayers: t.sends,
  outgoingEntitlements: t.entitlementsOut || [],
  incomingPlayers: [...],
  incomingEntitlements: [...],
  usedTradeExceptions: [...]
}
```

---

## 3️⃣ CURRENT VALIDATION COVERAGE (ENTITLEMENTS)

### Validation Check Analysis

| Check                                              | Implemented? | Blocks? | Evidence                                                                                                     |
| -------------------------------------------------- | :----------: | :-----: | ------------------------------------------------------------------------------------------------------------ |
| Entitlement appears in more than one outgoing list |    ❌ No     |  ❌ No  | No validation for cross-team duplicate selection                                                             |
| Entitlement routed to multiple receiving teams     |    ⚠️ N/A    |  ❌ No  | Can't happen because `toTeamId` is never set; system broadcasts                                              |
| Entitlement owned by sending team                  |    ❌ No     |  ❌ No  | No ownership validation in validator                                                                         |
| Stepien / frozen pick rules                        |    ✅ Yes    | ✅ Yes  | [validateStepien.js#L143-L200](src/features/architect/utils/tradeMachine/rules/validateStepien.js#L143-L200) |
| Duplicate entitlement in same team's outgoing      | ⚠️ Implicit  |  ⚠️ No  | Toggle removes if exists; no validator check                                                                 |

### Validator Entitlement Handling

The validator does NOT validate entitlement routing correctness. It only:

1. **Respects `toTeamId` for receipt generation** — [tradeValidator.js#L244-L262](src/features/architect/utils/tradeMachine/engine/tradeValidator.js#L244-L262)
2. **Passes entitlements through for Stepien validation** — only for outgoing picks
3. **Does NOT check for duplicates or uniqueness**

### No League-Wide Entitlement Invariant

The existing `leagueInvariants.ts` only validates **player uniqueness**:

```typescript
// src/features/architect/utils/leagueInvariants.ts
export function validateNoDuplicatePlayers(teams: any[]): LeagueInvariantResult;
```

There is **no equivalent `validateNoDuplicateEntitlements`** function.

---

## 4️⃣ APPLY / MUTATION LOGIC (ENTITLEMENTS)

### Fields Updated on Apply

When a trade is applied via `buildPostTradeTeamsSnapshot()` in [tradeContext.js#L195-L260](src/features/architect/utils/tradeContext/tradeContext.js#L195-L260):

```javascript
// Update entitlementIds if any entitlements are traded
const outgoingEntitlementIds = (
  teamTrade.outgoingEntitlements ||
  teamTrade.entitlementsOut ||
  []
)
  .map((e) => e.entitlementId || e.id)
  .filter(Boolean);

const incomingEntitlementIds = [];
payload.teams.forEach((otherTeamTrade, otherIndex) => {
  if (otherIndex === i) return;
  const otherOut =
    otherTeamTrade.outgoingEntitlements || otherTeamTrade.entitlementsOut || [];

  otherOut.forEach((e) => {
    const entId = e.entitlementId || e.id;
    const toTeam = normalizeTeamCodeLike(e.toTeamId);

    if (toTeam) {
      // Routing specified: only include if this team matches
      if (toTeam === thisTeamCode) {
        incomingEntitlementIds.push(entId);
      }
    } else {
      // NO ROUTING: broadcast to all teams
      incomingEntitlementIds.push(entId);
    }
  });
});

updatedTeam.entitlementIds = [
  ...new Set([
    ...currentEntitlementIds.filter(
      (id) => !outgoingEntitlementIds.includes(id)
    ),
    ...incomingEntitlementIds,
  ]),
];
```

### Apply Uses UI Payload Directly

The apply step uses the **UI payload** (`entitlementsOut[]`) directly, not a recomputed scheme. It respects `toTeamId` when present but defaults to broadcast when absent.

### Deduplication

Apply applies `[...new Set()]` to prevent duplicate entitlement IDs within a single team's `entitlementIds` array, but this does NOT prevent the **same entitlement being added to multiple teams** (the bug).

### League Invariant Gap

The Phase 86 `validateNoDuplicatePlayers` check is **player-only**. It would NOT catch duplicate entitlements across teams:

```typescript
// leagueInvariants.ts - ONLY checks players
export function validateNoDuplicatePlayers(
  teams: any[]
): LeagueInvariantResult {
  // ...collects players from roster
  // Does NOT check entitlementIds
}
```

---

## 5️⃣ ROOT CAUSE SUMMARY

The duplication bug originates from **three compounding factors**:

### Primary Cause: UI Does Not Set `toTeamId`

The `toggleEntitlement` handler in `useTradeMachine.js` adds entitlements to `entitlementsOut[]` but **never sets `toTeamId`**. This is a UX gap, not a routing bug.

**Evidence**: [useTradeMachine.js#L576-L581](src/features/architect/hooks/useTradeMachine.js#L576-L581)

```javascript
{
  ...entitlement,
  entitlementId,
  fromTeamId: newTeams[index].team?.id,
  // toTeamId: ← NEVER SET
}
```

### Secondary Cause: Broadcast Mode Fallback

When `toTeamId` is absent, the system falls back to "broadcast mode" — sending the entitlement to ALL other teams. This was an intentional backward-compatibility design for 2-team trades (Phase 11.3.1) but becomes a bug in 3+ team trades.

**Evidence**:

- [useTradeMachine.js#L251](src/features/architect/hooks/useTradeMachine.js#L251): `if (!e.toTeamId || e.toTeamId === tm.team?.id)`
- [tradeValidator.js#L248](src/features/architect/utils/tradeMachine/engine/tradeValidator.js#L248): "broadcast mode - backward compatible"
- [tradeContext.js#L241](src/features/architect/utils/tradeContext/tradeContext.js#L241): Same broadcast fallback

### Tertiary Cause: No Uniqueness Enforcement

Neither the validator nor the apply step checks whether an entitlement ID would end up on multiple teams after the trade. The `leagueInvariants.ts` only validates players, not entitlements.

---

## 6️⃣ BLOCKERS LIST

### Confirmed Blockers for "Existing entitlements can be traded correctly"

| Blocker                                                  | Confirmed? |  Severity   | Description                                                                           |
| -------------------------------------------------------- | :--------: | :---------: | ------------------------------------------------------------------------------------- |
| **One entitlement appears for multiple receiving teams** |   ✅ Yes   | 🔴 CRITICAL | In 3+ team trades, any selected entitlement is broadcast to ALL other teams           |
| **No destination selection exists**                      |   ✅ Yes   | 🔴 CRITICAL | UI provides checkbox-only toggle; user cannot specify which team receives             |
| **No uniqueness enforcement exists**                     |   ✅ Yes   |   🟠 HIGH   | Validator and apply allow the same entitlement to land on multiple teams              |
| Entitlement ownership not validated                      | ⚠️ Present |  🟡 MEDIUM  | No check that sending team actually owns the entitlement (though UI filters to owned) |

### Not Blockers (Working Correctly)

- ✅ 2-team trades work correctly (only one other team)
- ✅ Stepien validation works for entitlements
- ✅ `toTeamId` routing is respected when present (infrastructure exists)
- ✅ Trade receipt shows entitlements correctly when routed

---

## 7️⃣ VERDICT

> ❌ **Existing entitlement trading is NOT structurally correct for multi-team trades.**

### Blocking Gaps

1. **UI does not provide destination selection** — `toggleEntitlement` never sets `toTeamId`, so multi-team trades cannot specify routing
2. **Broadcast mode causes duplicates** — Without `toTeamId`, entitlements are sent to all other teams
3. **No uniqueness guard** — Neither validator nor apply blocks the same entitlement from appearing on multiple teams post-trade

### Infrastructure That Exists (Not Missing)

- `toTeamId` field is recognized and processed by validator, receipt, and apply
- Routing logic respects `toTeamId` when present (Phase 11.3.1 / 11.3.2 complete)

### What's Needed for Correctness

1. UI mechanism to set `toTeamId` when toggling an entitlement in 3+ team trades
2. Uniqueness validation: entitlement can only be routed to ONE destination team
3. Apply guard: reject trades where same entitlement would land on multiple teams

---

## APPENDIX: File References

| File                                                                                                           | Purpose                                                   |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [useTradeMachine.js](src/features/architect/hooks/useTradeMachine.js)                                          | Trade machine hook; `toggleEntitlement`, `incomingAssets` |
| [tradeValidator.js](src/features/architect/utils/tradeMachine/engine/tradeValidator.js)                        | Trade validation; receipt generation                      |
| [tradeContext.js](src/features/architect/utils/tradeContext/tradeContext.js)                                   | `buildPostTradeTeamsSnapshot` — apply logic               |
| [mutationPipeline.js](src/features/architect/utils/mutationPipeline.js)                                        | `computeTradeResult` — event metadata                     |
| [leagueInvariants.ts](src/features/architect/utils/leagueInvariants.ts)                                        | Player uniqueness validation (no entitlement check)       |
| [EntitlementPicksList.jsx](src/features/architect/tradeMachine/EntitlementPicksList.jsx)                       | UI for selecting entitlements                             |
| [TradeTeamCard.jsx](src/features/architect/tradeMachine/TradeTeamCard.jsx)                                     | Team card showing outgoing/incoming                       |
| [PST_PHASE_11_3_1...md](docs/team-scrape/PST_PHASE_11_3_1_ENTITLEMENT_ROUTING_OBSERVABILITY_RETURN_PACKAGE.md) | Phase 11.3.1 routing observability                        |

---

**END OF AUDIT**

---

# CLOSURE SECTION — EXECUTION COMPLETE

**Executed**: 2026-02-03  
**Tests**: 9/9 passed

---

## 8️⃣ CHANGES IMPLEMENTED

### Summary

All three confirmed blockers from Section 6 have been resolved:

| Blocker                                              | Resolution | Evidence                                                                                           |
| ---------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| One entitlement appears for multiple receiving teams | ✅ Fixed   | `incomingAssets` memo now requires `toTeamId` for 3+ team trades; broadcast only for 2-team trades |
| No destination selection exists                      | ✅ Fixed   | Added destination dropdown in `EntitlementPickRow.jsx` with amber warning state                    |
| No uniqueness enforcement exists                     | ✅ Fixed   | New `validateEntitlementRouting.js` rule + apply-time invariant guard                              |

### Files Modified

| File                                                                 | Changes                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/hooks/useTradeMachine.js`                    | Added `setEntitlementDestination` handler; modified `toggleEntitlement` to auto-set `toTeamId` for 2-team trades; added `activeTeamCount` memo; updated `incomingAssets` to require `toTeamId` for 3+ teams |
| `src/features/architect/tradeMachine/EntitlementPickRow.jsx`         | Added destination dropdown UI when `otherTeams.length > 1` and entitlement is selected; amber warning when destination needed but not set                                                                   |
| `src/features/architect/tradeMachine/EntitlementPicksList.jsx`       | Added `toTeamIdByEntitlement` lookup; passes `otherTeams`, `currentToTeamId`, `onSetDestination` to EntitlementPickRow                                                                                      |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx`              | Added `onSetEntitlementDestination` prop; passes to EntitlementPicksList                                                                                                                                    |
| `src/features/architect/tradeMachine/TradeEditor.jsx`                | Destructured `setEntitlementDestination` and `activeTeamCount` from hook; passed to TradeTeamCard                                                                                                           |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Imported and calls `validateEntitlementRouting`; returns early with blocking error on failure                                                                                                               |
| `src/features/architect/utils/tradeContext/tradeContext.js`          | Removed broadcast fallback for 3+ teams (logs warning, skips); added post-apply invariant check                                                                                                             |

### Files Created

| File                                                                            | Purpose                                                                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/tradeMachine/rules/validateEntitlementRouting.js` | New validation rule: uniqueness check, routing requirement for 3+ teams, ownership validation, destination validation |
| `src/tests/architect/phase17_entitlement_routing_guardrail.test.js`             | 9 test cases covering validator and apply logic                                                                       |

---

## 9️⃣ HOW THE FIX WORKS

### 2-Team Trades (Unchanged Behavior)

1. User toggles entitlement checkbox
2. `toggleEntitlement` auto-sets `toTeamId` to the only other team
3. Entitlement appears in correct team's incoming section
4. Validation passes (2-team trades don't require explicit `toTeamId`)

### 3+ Team Trades (New Behavior)

1. User toggles entitlement checkbox
2. `toggleEntitlement` does NOT set `toTeamId` (multiple destinations possible)
3. **NEW**: Destination dropdown appears with amber warning
4. User selects destination team from dropdown
5. `setEntitlementDestination` sets `toTeamId` on the entitlement
6. Entitlement now appears ONLY in selected team's incoming section
7. Validation passes (explicit routing present)

### Validation Guards

1. **`validateEntitlementRouting`** (blocking):
   - ❌ Same entitlement in multiple outgoing lists
   - ❌ Missing `toTeamId` in 3+ team trade
   - ❌ `toTeamId` not a valid trade participant
   - ❌ `toTeamId` points to sending team (self-routing)
   - ❌ Team doesn't own the entitlement

2. **Apply-time invariant** (last resort):
   - Throws if same entitlement would land on multiple teams post-trade
   - This should never trigger if validator is working correctly

---

## 🔟 TEST RESULTS

```
✓ Phase 17: validateEntitlementRouting (7)
  ✓ Test 1: 3-team trade - requires explicit routing (2)
    ✓ should pass when all entitlements have toTeamId in 3+ team trade
    ✓ should fail when entitlement lacks toTeamId in 3+ team trade
  ✓ Test 2: Duplicate entitlement detection (1)
    ✓ should fail when same entitlement is in two outgoing lists
  ✓ Test 3: 2-team trade - toTeamId not required (1)
    ✓ should pass when entitlement lacks toTeamId in 2-team trade
  ✓ Test 4: Invalid destination detection (2)
    ✓ should fail when toTeamId is not a team in the trade
    ✓ should fail when toTeamId points to the sending team
  ✓ Test 5: Ownership validation (1)
    ✓ should fail when team trades entitlement it does not own

✓ Phase 17: buildPostTradeTeamsSnapshot - Entitlement Transfer (2)
  ✓ Test 1: 3-team trade - routed entitlements (1)
    ✓ should route entitlement to specified toTeamId only
  ✓ Test 2: 2-team trade - broadcast fallback (1)
    ✓ should transfer entitlement to other team without toTeamId

Test Files: 1 passed (1)
Tests: 9 passed (9)
Duration: 5.23s
```

---

## 1️⃣1️⃣ UPDATED VERDICT

> ✅ **Existing entitlement trading is now structurally correct for multi-team trades.**

### Resolved Gaps

1. ✅ **UI provides destination selection** — Dropdown appears when 3+ teams and entitlement is selected
2. ✅ **Broadcast mode limited to 2-team trades** — 3+ team trades require explicit `toTeamId`
3. ✅ **Uniqueness enforced** — Validator blocks duplicates; apply throws on invariant violation

### Remaining Infrastructure (Unchanged, Working)

- `toTeamId` field recognized by validator, receipt, and apply
- Stepien validation for entitlements
- Trade receipt shows entitlements correctly

### Out-of-Scope (Not Addressed)

- **Entitlement creation** (new draft picks from UI) — separate feature
- **Stepien enhancements** — existing validation preserved
- **UI polish** (animations, styling) — functional behavior complete

---

**END OF CLOSURE SECTION**
