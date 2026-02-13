# Draft Picks Trade Machine Audit - Return Package

> **Date**: 2026-01-15  
> **Version**: 2.5.0 (Audit Refresh)  
> **Mode**: PREFLIGHT (Analysis Only - No Implementation)  
> **Master Doc**: [`TRADE_MACHINE_DRAFT_PICKS_MASTER.md`](./TRADE_MACHINE_DRAFT_PICKS_MASTER.md)

---

## Executive Summary

The existing master document (v2.4.1) is comprehensive but **outdated**. Multiple gaps previously marked as "NOT IMPLEMENTED" have been resolved. This return package documents findings and updates the gap assessment.

| Finding | Count |
|---------|-------|
| Gaps Now Resolved | 3 |
| Gaps Partially Fixed | 2 |
| Gaps Still Open | 10 |
| New Gaps Identified | 2 |

---

## 1. Top 10 Highest-Risk Holes (Current State)

### 1. **G2: No Multi-Tier Protection UI**

- **File**: `TradePickRow.jsx`
- **Function**: Protection dropdown at line ~103
- **Issue**: Schema supports `protectionMeta` but UI only has string dropdown
- **Consequence**: Cannot define "Top 3 → Top 5 → Unprotected" real NBA protections

### 2. **G4: `isMeaningfulProtection()` Dead Code**

- **File**: `basicRules.js:25-29`
- **Function**: `isMeaningfulProtection(protection)` (array format)
- **Issue**: Never called; string version in `tradeUtilities.js:74` is canonical
- **Consequence**: Maintenance confusion, code rot

### 3. **Trade Machine ↔ Season Advance Disconnect**

- **Files**: `seasonManager.js`, Trade Machine UI
- **Issue**: Swap/conveyance resolution exists but Trade Machine doesn't preview outcomes
- **Consequence**: Users don't see what their swap rights will resolve to

### 4. **G7: No Stepien Calendar Visualization**

- **File**: `stepienUtils.js:46-78`
- **Function**: `buildFirstRoundCalendar()` exists but unused in UI
- **Consequence**: Users must manually track which years are Stepien-blocked

### 5. **G9: Second Apron Swap Year Blocking Incomplete**

- **File**: `validateStepien.js:192-221`
- **Function**: Checks frozen picks but may miss swap-specific CBA rules
- **Consequence**: May allow swaps that violate second apron restrictions

### 6. **G10: Pick Chain/Provenance Not Displayed**

- **File**: `DraftPickZ` schema has `route` field
- **Function**: Field exists but UI doesn't render full history
- **Consequence**: Users can't see "PHI → OKC → HOU" trade chain

### 7. **G14: Protection Dropdown Has "Swap (+/-)" Options**

- **File**: `tradeUtilities.js:93` `getPickOptions()`
- **Issue**: Swap as protection option is confusing UX
- **Consequence**: Users conflate protection and swap concepts

### 8. **draftPicks vs picks Alias Risk**

- **File**: `schemaAdapter.js:94-95`
- **Function**: Creates two aliases to same array
- **Consequence**: Mutation of one may not reflect in other; desync risk

### 9. **Multi-Team Trade Pick Routing UI Missing**

- **File**: `tradeManager.js:150-164`
- **Function**: Handles `tradeTo` but Trade Machine UI lacks destination picker
- **Consequence**: 3+ team trades can't direct picks to specific teams

### 10. **Trade Receipt Doesn't Show Swap Resolution**

- **File**: `TradeExportCapture.jsx`
- **Function**: `formatPick()` shows swap icon but not resolution outcome
- **Consequence**: Exported trade cards don't clarify who wins swaps

---

## 2. Gaps Now RESOLVED (Update Master Doc)

| Gap ID | Gap Title | Previous Status | New Status | Evidence |
|--------|-----------|-----------------|------------|----------|
| **G3** | Conveyance/Rollover Logic | ❌ NOT IMPLEMENTED | ✅ **RESOLVED** | [`conveyanceResolution.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js) (430 lines) |
| **G5** | Stable Pick ID Strategy | ❌ MISSING | ✅ **RESOLVED** | [`pickIdUtils.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeMachine/utils/pickIdUtils.js) (169 lines) |
| **G6** | Pick Swap Best/Worst-Of | ❌ NOT IMPLEMENTED | ✅ **RESOLVED** | [`swapResolution.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeMachine/utils/swapResolution.js) (265 lines) |

### Evidence for G3 (Conveyance)

```javascript
// conveyanceResolution.js:105
export function resolveConveyanceForPick(pick, positionsMap, opts = {}) { ... }

// Called by seasonManager.js:1222
return resolveConveyanceForPick(pick, positionsMap, { draftYear, nowIso, method });
```

### Evidence for G5 (Pick IDs)

```javascript
// pickIdUtils.js:63
export function generatePickId(pick) {
  const team = pick.originalTeam || 'UNK';
  const year = pick.year || '????';
  const round = normalizeRound(pick.round);
  return `${team}_${year}_${round}`;
}
```

### Evidence for G6 (Swap Resolution)

```javascript
// swapResolution.js:112
export function resolvePickSwap(pick, positionsMap, options = {}) { ... }

// swapResolution.js:38
export function resolveSwapWinner({ teamA, teamB, swapType = 'best_of' }, positionsMap) { ... }
```

---

## 3. Gaps PARTIALLY FIXED

| Gap ID | Gap Title | Previous Status | New Status | What Remains |
|--------|-----------|-----------------|------------|--------------|
| **G1** | Swap Rights Not Validated | ❌ BLOCKER | ⚠️ PARTIAL | `validateStepien.js` reads obligations but swap-specific Stepien year reservation still needs verification |
| **G8** | Three Stepien Implementations | ❌ DUPLICATE | ⚠️ DELEGATED | `stepienUtils.js:hasStepienViolation()` now delegates to canonical; `draftRules.js` version still exists (dead code) |

### Evidence for G1 (Swap Validation Improved)

```javascript
// validateStepien.js:14-24
function reservesYearForStepien(pick) {
  if (!pick.isSwap) return true;
  const swapType = pick.swapType || 'best_of';
  return swapType !== 'worst_of';
}

// validateStepien.js:116
const existingObligations = team.draftPicksObligations || team.team?.draftPicksObligations || [];
```

### Evidence for G8 (Delegation)

```javascript
// stepienUtils.js:101-109
export function hasStepienViolation(picks) {
  if (!picks || picks.length === 0) return false;
  const result = validateStepien({ outgoingPicks: picks }, {});
  return !result.passed;
}
```

---

## 4. Recommended Phase 1 Scope

### 4.1 Dead Code Removal (~2 hours)

- [ ] Delete `basicRules.js:isMeaningfulProtection()` (array format, never called)
- [ ] Delete `draftRules.js:hasStepienViolation()` (dead code)
- [ ] Verify `tradeHelpers.js` re-export uses canonical `tradeUtilities.js`

### 4.2 Update Master Doc to v2.5.0 (~1 hour)

- [ ] Mark G3, G5, G6 as RESOLVED in Gap List
- [ ] Update G1, G8 status to PARTIALLY FIXED
- [ ] Add new Evidence Index entries for swap/conveyance utilities
- [ ] Add file map entries for new utilities

### 4.3 Multi-Tier Protection Editor (~4 hours)

- [ ] Add tier editor component to `TradePickRow.jsx`
- [ ] Connect to existing `protectionMeta` field in `DraftPickZ`
- [ ] Support: year, condition type, conversion action

### 4.4 Stepien Calendar Preview (~4 hours)

- [ ] Wire `buildFirstRoundCalendar()` to Trade Machine UI
- [ ] Show blocked/available years before trade confirmation
- [ ] Include existing obligations from `draftPicksObligations`

---

## 5. File Map (Key Files)

### Data Models / Schemas

| Path | Responsibility |
|------|----------------|
| [`architect.ts`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/schemas/architect.ts) | `DraftPickZ`, `ProtectionMetaZ`, `DraftPickConveyanceZ` |
| [`types.ts`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeMachine/constants/types.ts) | TypeScript interfaces for trade validation |

### Pick Utilities (NOW IMPLEMENTED)

| Path | Responsibility |
|------|----------------|
| [`pickIdUtils.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeMachine/utils/pickIdUtils.js) | `generatePickId()`, `ensurePickId()`, `areSamePickById()` |
| [`swapResolution.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeMachine/utils/swapResolution.js) | `resolvePickSwap()`, `resolveSwapWinner()`, `resolveTeamSwaps()` |
| [`conveyanceResolution.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeMachine/utils/conveyanceResolution.js) | `resolveConveyanceForPick()`, `protectionTriggers()` |

### Validator / Rules

| Path | Responsibility |
|------|----------------|
| [`validateStepien.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeMachine/rules/validateStepien.js) | **CANONICAL** - Stepien Rule validation with obligations wiring |
| [`tradeUtilities.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeMachine/utils/tradeUtilities.js) | **CANONICAL** - `isMeaningfulProtection()` (string format) |
| [`stepienUtils.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/stepienUtils.js) | `buildFirstRoundCalendar()`, delegates to canonical |

### Trade Execution

| Path | Responsibility |
|------|----------------|
| [`tradeManager.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeManager.js) | `executeTrade()` - pick movement logic |
| [`seasonManager.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/seasonManager.js) | Season advance with swap/conveyance resolution |

### UI Components

| Path | Responsibility |
|------|----------------|
| [`TradePickRow.jsx`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradePickRow.jsx) | Pick row with protection/swap editing |
| [`TradeTeamCard.jsx`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/tradeMachine/TradeTeamCard.jsx) | Team card with picks tab |
| [`tradeHelpers.js`](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeHelpers.js) | `formatPick()`, `formatSwapInfo()`, `areSamePick()` |

---

## 6. Open Questions / Missing Repo Facts

1. **Draft Pipeline → baseTeams Integration**
   - `team-scrape/draft-picks/` generates `draftAssets/{TEAM}.json`
   - How are these merged into `architect/baseTeams/{teamCode}.draftPicks`?
   - Need runtime/Firebase audit to confirm data flow

2. **Second Apron Swap CBA Rules**
   - Current code checks frozen picks (7+ years out)
   - CBA may have additional swap-specific second apron restrictions
   - Need CBA verification for completeness

3. **Swap Partner Validation at Trade Time**
   - `resolvePickSwap()` runs at season advance
   - Trade Machine doesn't verify swap partner team owns their pick
   - Risk: modeling impossible swaps (team traded away their side)

4. **Test Coverage for New Utilities**
   - Tests exist: `stepienObligations.test.js`, `swapResolution.test.js`, `conveyancePreflight.test.js`
   - Need to verify all edge cases covered

---

## 7. Next Steps

1. **Update Master Doc** - Incorporate this return package into `TRADE_MACHINE_DRAFT_PICKS_MASTER.md` v2.5.0
2. **Execute Phase 1** - Dead code removal + multi-tier protection UI
3. **Add Stepien Calendar** - Wire existing utility to Trade Machine
4. **Verify Tests** - Ensure all new utilities have comprehensive test coverage

---

*End of Return Package*
