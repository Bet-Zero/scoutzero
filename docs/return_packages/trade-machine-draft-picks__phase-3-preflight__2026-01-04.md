# Trade Machine Draft Picks — Phase 3 PREFLIGHT Return Package

> **Date**: 2026-01-04  
> **Status**: PREFLIGHT COMPLETE  
> **Mode**: DOCS + tests-only (no runtime behavior changes)  
> **Document**: `docs/return-packages/trade-machine-draft-picks__phase-3-preflight__2026-01-04.md`

---

## Summary

Phase 3 PREFLIGHT is complete. This document addresses all questions from the Phase 3 PREFLIGHT scope:

1. Where pick ownership is ultimately *consumed* (trade output, offseason sim, cap engine, etc.)
2. What "resolution" means in this repo (when and where best/worst-of is decided)
3. What minimum data model is required for unresolved vs resolved picks
4. How protection/rollover is currently represented
5. Where pick label formatting is duplicated

---

## 1. Pick Consumers Table (P1)

### Places That *Use* Picks Beyond Display

| # | File Path | Function Name | Fields Read | Expects Already-Resolved? | Purpose |
|---|-----------|---------------|-------------|---------------------------|---------|
| **C1** | `src/features/architect/utils/seasonManager.js:398-425` | `updateDraftPicks()` | `year`, `status` | ❌ No | Advances pick status from 'future' to 'available' on season transition |
| **C2** | `src/features/architect/utils/seasonManager.js:817-912` | `updateDraftPicksWithStepien()` | `year`, `round`, `originalTeam`, `currentOwner`, `owner`, `tradedTo` | ❌ No | Recalculates Stepien eligibility/blocked status on season advance |
| **C3** | `src/features/architect/utils/tradeManager.js:166-178` | `executeTrade()` (pick update block) | `year`, `round`, `owner` | ❌ No | Filters outgoing picks and adds incoming picks to team's draftPicks array |
| **C4** | `src/features/architect/utils/mutationPipeline.js:636-647` | `computeTradeResult()` (pick update) | `year`, `round`, `owner` | ❌ No | Same as tradeManager - filters/adds picks during trade execution |
| **C5** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | `validateStepien()` | `year`, `round`, `protection`, `originalTeam`, `isSwap`, `swapType` | ❌ No | Validates Stepien rule, 7-year limit, second apron restrictions |
| **C6** | `src/features/architect/utils/tradeMachine/rules/draftRules.js:61-63` | `validateDraftPicks()` | `year` | ❌ No | Validates 7-year trading limit |
| **C7** | `src/features/architect/utils/stepienUtils.js` | `buildFirstRoundCalendar()` | `year`, `protected`, `protectionText`, `protection` | ❌ No | Builds calendar visualization of first-round pick obligations |
| **C8** | `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js` | `computeTradeDraftKey()` | `year`, `round`, `originalTeam` (via `ensurePickId`) | ❌ No | Generates cache key for trade validation state |

### Pick Consumer Categories

#### A. Season Advance / Offseason Simulation

- **`updateDraftPicks()`** (C1): Simple year-based status update
- **`updateDraftPicksWithStepien()`** (C2): Full Stepien recalculation

**Key Finding**: These functions process picks but do NOT perform swap resolution. They simply advance status and recalculate Stepien blocked status based on ownership.

#### B. Trade Execution

- **`tradeManager.executeTrade()`** (C3): Updates `draftPicks[]` array when trade applied
- **`mutationPipeline.computeTradeResult()`** (C4): Same logic, different pipeline

**Key Finding**: Pick comparison uses `year + round + owner` for filtering. Does NOT resolve swaps.

#### C. Validation

- **`validateStepien()`** (C5): Main Stepien validator - reads `isSwap` and `swapType`
- **`validateDraftPicks()`** (C6): 7-year limit check only

**Key Finding**: Validation does NOT assume picks are resolved. It uses swap type to determine year reservation.

#### D. Display/Utility

- **`buildFirstRoundCalendar()`** (C7): Calendar visualization
- **`computeTradeDraftKey()`** (C8): Cache key generation

### **STOP CONDITION CHECK: No Consumer Requires Resolution**

**Finding**: NO consumer in the repo currently expects "resolved" picks where swap ownership has been determined based on lottery results. All consumers work with the unresolved swap representation (`isSwap`, `swapType`, `swapWithTeamId`).

**Implication**: Phase 3 swap resolution has **NO IMMEDIATE EXECUTION TARGET** in the current codebase. Resolution would be needed for:

1. A draft lottery simulation (does not exist)
2. An offseason/world sim that advances through drafts (does not exist)
3. A pick value evaluation that needs concrete ownership (does not exist)

**Recommendation**: Phase 3 can implement resolution logic, but it will be **infrastructure for future phases** until a draft simulation or world-advancing sim is built.

---

## 2. Swap Resolution Timing Decision (P2)

### What "Resolution" Means in This Repo

**Current State**: There is NO resolution logic anywhere in the repo. Swaps remain in "unresolved" state permanently.

### When Would Resolution Happen?

Based on repo patterns, resolution would logically occur at one of these points:

| # | Timing Point | Current Existence | Evidence |
|---|--------------|-------------------|----------|
| **T1** | Draft lottery results available | ❌ Does NOT exist | No lottery simulation or data ingestion found |
| **T2** | Season advance (post-draft) | ⚠️ Partial | `seasonManager.js` exists but does NOT resolve swaps |
| **T3** | Trade execution (post-draft) | ❌ Does NOT exist | `tradeManager.js` passes picks through unchanged |
| **T4** | Manual user input | ❌ Does NOT exist | No UI for entering lottery results |

### Recommended Resolution Event

**Recommendation**: Resolution should occur during **season advance** (`advanceSeasonInWorld`) when moving past a draft year.

**Justification**:

1. `seasonManager.js` already processes picks during season transition
2. `updateDraftPicksWithStepien()` already updates pick status based on year
3. Adding resolution logic here is natural extension of existing flow

**Required Inputs for Resolution**:

- Draft lottery results: `Map<TeamCode, number>` (team → pick position 1-60)
- The pick's `swapType`: `'best_of' | 'worst_of'`
- The pick's `swapWithTeamId`: Partner team code

---

## 3. Proposed Resolved-Pick Schema (P2)

### Schema A: Minimal Extension (Recommended)

Extends current pick object with resolution fields:

```typescript
interface DraftPick {
  // === EXISTING FIELDS (unchanged) ===
  id: string;                    // "{originalTeam}_{year}_{round}"
  year: number;
  round: 1 | 2;
  originalTeam: TeamCode;
  currentOwner?: TeamCode;
  protection?: string;           // String: "Top 3", "Lottery", etc.
  isSwap: boolean;
  swapType?: 'best_of' | 'worst_of';
  swapWithTeamId?: TeamCode;
  
  // === NEW RESOLUTION FIELDS ===
  resolved: boolean;             // False until resolution event
  resolvedOwner?: TeamCode;      // Who got the pick after swap resolution
  resolvedPosition?: number;     // Draft position 1-60 (if known)
  resolutionMeta?: {
    resolvedAt: string;          // ISO timestamp
    method: 'lottery' | 'manual' | 'inferred';
    positions?: Record<TeamCode, number>;  // Snapshot of positions at resolution
  };
}
```

**Pros**:

- Additive - no breaking changes to existing consumers
- Clear distinction: `resolved: false` = swap pending, `resolved: true` = ownership determined
- Preserves original swap data for audit trail

**Cons**:

- Dual ownership fields (`currentOwner` vs `resolvedOwner`)
- Consumers must check `resolved` before using ownership

### Schema B: Status-Based Resolution

Uses status field to indicate resolution state:

```typescript
interface DraftPick {
  // ... existing fields ...
  
  // === STATUS-BASED APPROACH ===
  status: 'future' | 'available' | 'swap_pending' | 'swap_resolved' | 'conveyed' | 'cancelled';
  
  // Status-specific data
  swapData?: {
    type: 'best_of' | 'worst_of';
    partnerTeam: TeamCode;
    resolvedOwner?: TeamCode;     // Populated when status = 'swap_resolved'
    resolvedPosition?: number;
  };
}
```

**Pros**:

- Single status field to check
- Cleaner separation of swap data

**Cons**:

- More invasive change to existing status handling
- Status enum grows complex

### Schema C: Resolution as Separate Event Log

Resolution tracked separately from pick object:

```typescript
interface SwapResolutionEvent {
  pickId: string;                // Pick being resolved
  resolvedAt: string;
  swapType: 'best_of' | 'worst_of';
  teams: TeamCode[];
  positions: Record<TeamCode, number>;
  winner: TeamCode;              // Who got the pick
  loser: TeamCode;               // Who lost the swap
}

// Pick object unchanged, resolution looked up by pickId
```

**Pros**:

- Immutable event log
- Pick objects stay simple

**Cons**:

- Requires join to determine current ownership
- More complex query patterns

### **Recommendation: Schema A (Minimal Extension)**

Schema A is recommended because:

1. Additive change with no breaking changes
2. All existing consumers continue to work
3. New consumers can check `resolved` flag
4. Preserves full audit trail of swap data

---

## 4. Conveyance/Rollover Audit (P3)

### Current Reality

#### Protection Representation

**Storage**: Protection is stored as a **string** in pick objects.

| Location | Format | Example Values |
|----------|--------|----------------|
| UI dropdown (`TradePickRow.jsx`) | String | `""`, `"Top 3"`, `"Top 5"`, `"Lottery"`, `"Top 20"` |
| Firestore data | String | Same as UI |
| Validator input | String | Same |

**Parser**: `isMeaningfulProtection()` in `tradeUtilities.js:74-80`

```javascript
export const isMeaningfulProtection = (protection) => {
  if (!protection) return false;
  return (
    /top\s*[1-9]\d*/i.test(protection) ||  // "Top 3", "Top 10", etc.
    /lottery/i.test(protection) ||          // "Lottery"
    /1-14/i.test(protection)                // "1-14"
  );
};
```

**Available Options** (`getPickOptions()` in `tradeUtilities.js:84-94`):

- Unprotected (value: `""`)
- Protected Top 3 (value: `"Top 3"`)
- Protected Top 5 (value: `"Top 5"`)
- Protected Top 8 (value: `"Top 8"`)
- Protected Top 10 (value: `"Top 10"`)
- Lottery Protected (value: `"Lottery"`)
- Protected Top 20 (value: `"Top 20"`)
- Swap (+) (value: `"Swap (+)"`) - **CONFUSING: swap should not be protection**
- Swap (-) (value: `"Swap (-)"`) - **CONFUSING: swap should not be protection**

#### Rollover/Conveyance Fields

**Schema Definition** (`src/schemas/architect.ts:91-123`):

The `DraftPickConveyanceZ` schema exists but is **NEVER USED**:

```typescript
const DraftPickConveyanceZ = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  originalYear: z.number().int().optional(),
  currentYear: z.number().int().optional(),
  finalYear: z.number().int().optional(),
  stepienImpact: z.object({
    eligibleForStepien: z.boolean().optional(),
    locksYears: z.array(z.number().int()).optional(),
    deadYears: z.array(z.number().int()).optional(),
    affectedYears: z.array(z.number().int()).optional(),
    nextAvailableFirstRound: z.number().int().optional(),
    conveyanceDeadline: z.number().int().optional(),
    rolloverYears: z.array(z.number().int()).optional(),
  }).optional(),
  conditions: z.object({
    protection: z.string().optional(),
    ifConveys: z.string().optional(),
    ifRolls: z.string().optional(),
  }).optional(),
  affects: z.array(z.string()).optional(),
}).optional();
```

**Evidence of Non-Use**:

```bash
$ grep -r "conveyance\|ifConveys\|ifRolls\|finalYear" src/features/architect/
# Only returns schema definition - NO runtime usage
```

#### Existing Logic That Interprets Protection

| Location | What It Does |
|----------|--------------|
| `validateStepien.js:76-88` | Calls `isMeaningfulProtection()` to allow protected picks in consecutive years |
| `buildFirstRoundCalendar()` | Uses `protection` to set calendar status |
| `formatPick()` | Displays protection with 🛡 icon |

#### Rollover Behavior in Season Manager

**Finding**: `seasonManager.js` does NOT implement any rollover logic.

`updateDraftPicks()` (line 398-425) only updates `status` from 'future' to 'available'. It does NOT:

- Check if protection was triggered
- Roll pick to next year
- Convert to second round
- Process conveyance chains

### Minimum Viable Conveyance Plan for Phase 3

**Recommendation**: Phase 3 should focus on **swap resolution only**. Full conveyance/rollover is a separate, larger effort.

However, if conveyance must be addressed minimally:

#### Level 1: Document-Only (This Phase)

- Document the gap between schema and implementation
- Add test fixtures for expected conveyance behavior
- Update Master Doc with conveyance requirements

#### Level 2: Basic Conveyance Structure (Future Phase)

```typescript
interface ProtectionTier {
  year: number;
  condition: 'top_3' | 'top_5' | 'top_10' | 'lottery' | 'unprotected';
  ifTriggered: 'roll' | 'convert_2nd' | 'cancel';
  rollToYear?: number;
}

// Example: Top 3 in 2026 → Top 5 in 2027 → Unprotected 2028
const protection: ProtectionTier[] = [
  { year: 2026, condition: 'top_3', ifTriggered: 'roll', rollToYear: 2027 },
  { year: 2027, condition: 'top_5', ifTriggered: 'roll', rollToYear: 2028 },
  { year: 2028, condition: 'unprotected', ifTriggered: 'cancel' }
];
```

**Not In Scope for Phase 3**: Implementing this structure or any runtime conveyance logic.

---

## 5. Label Formatting Unification Audit (P4)

### All Pick Label/Format Helpers

| # | Function | File Path | Usage | Format Output |
|---|----------|-----------|-------|---------------|
| **F1** | `formatPick(p)` | `src/features/architect/utils/tradeHelpers.js:338-348` | Export capture, Team card | `"2026 1st Round (via OKC) 🛡 Top 3 🔁 Swap (Best of) vs CLE"` |
| **F2** | `getPickLabel(p)` | `src/features/architect/tradeMachine/TradeSummaryPanel.jsx:22-31` | Summary panel | `"2026 1st Round (via OKC) 🛡 Top 3 🔄 Swap (Best of) vs CLE"` |
| **F3** | `formatSwapInfo(pick)` | `src/features/architect/utils/tradeHelpers.js:316-325` | Helper used by F1 and F2 | `"Swap (Best of) vs OKC"` |
| **F4** | `getSwapTypeDisplay(swapType)` | `src/features/architect/utils/tradeHelpers.js:306-308` | Helper used by F3 | `"Best of"` or `"Worst of"` |

### Call Sites Analysis

#### `formatPick()` (F1) - tradeHelpers.js

**Call Sites**:

1. `TradeExportCapture.jsx:210` - Export/image capture
2. `TradeTeamCard.jsx:6` - Import (but uses via TradePickRow)
3. `TradePickRow.jsx:113` - Pick row display

**Format**:

```javascript
export const formatPick = (p) => {
  if (!p) return '';
  let str = `${p.year} ${p.round} Round`;
  if (p.via) str += ` (via ${p.via})`;
  if (p.protection) str += ` 🛡 ${p.protection}`;
  if (p.isSwap) {
    str += ` 🔁 ${formatSwapInfo(p)}`;
  }
  if (p.note) str += ` 📝 ${p.note}`;
  return str;
};
```

#### `getPickLabel()` (F2) - TradeSummaryPanel.jsx

**Call Sites**:

1. `TradeSummaryPanel.jsx:232` - Summary panel pick chips

**Format** (local function):

```javascript
const getPickLabel = (p) => {
  if (!p) return '';
  let label = `${p.year} ${p.round} Round`;
  if (p.via) label += ` (via ${p.via})`;
  if (p.protection) label += ` 🛡 ${p.protection}`;
  if (p.isSwap) {
    label += ` 🔄 ${formatSwapInfo(p)}`;  // Note: Uses 🔄 not 🔁
  }
  return label;
};
```

### Differences Between Formatters

| Aspect | `formatPick()` (F1) | `getPickLabel()` (F2) |
|--------|---------------------|----------------------|
| Swap emoji | 🔁 | 🔄 |
| Note field | ✅ Included | ❌ Not included |
| Export location | `tradeHelpers.js` (shared) | `TradeSummaryPanel.jsx` (local) |
| Can be imported | ✅ Yes | ❌ No (local const) |

### Duplication Impact

**Maintenance Risk**: Changes to pick display format must be made in TWO places.

**Inconsistency**: Different swap emojis (🔁 vs 🔄) create subtle visual inconsistency.

### Recommendation: Unify to Single Formatter

**Action**: Move `getPickLabel()` logic into `formatPick()` or create a shared formatter.

**Recommended Approach**:

```javascript
// In tradeHelpers.js - enhanced formatPick
export const formatPick = (p, options = {}) => {
  const { includeNote = true, swapEmoji = '🔁' } = options;
  
  if (!p) return '';
  let str = `${p.year} ${p.round} Round`;
  if (p.via) str += ` (via ${p.via})`;
  if (p.protection) str += ` 🛡 ${p.protection}`;
  if (p.isSwap) {
    str += ` ${swapEmoji} ${formatSwapInfo(p)}`;
  }
  if (includeNote && p.note) str += ` 📝 ${p.note}`;
  return str;
};

// In TradeSummaryPanel.jsx - use shared formatter
import { formatPick } from '@/features/architect/utils/tradeHelpers';
// ...
const label = formatPick(pk, { includeNote: false, swapEmoji: '🔄' });
```

**Follow-Up Patch (Optional for Phase 3)**:

1. Add options parameter to `formatPick()`
2. Replace `getPickLabel()` in TradeSummaryPanel with `formatPick(p, { includeNote: false })`
3. Standardize swap emoji (recommend 🔁 as it's more commonly associated with swap/exchange)

---

## 6. Phase 3 Test Plan (P5)

### Tests Needed BEFORE Coding Phase 3

#### A. Swap Resolution Tests

```javascript
describe('swap resolution', () => {
  // A1: best_of swap resolves to higher pick
  it('best_of swap resolves to team with better (lower) pick position', () => {
    const swap = { type: 'best_of', teams: ['PHI', 'OKC'] };
    const positions = { PHI: 12, OKC: 5 };
    // Pick 5 is "better" than pick 12 (lower number = better)
    expect(resolveSwap(swap, positions)).toBe('OKC');
  });
  
  // A2: worst_of swap resolves to lower pick
  it('worst_of swap resolves to team with worse (higher) pick position', () => {
    const swap = { type: 'worst_of', teams: ['PHI', 'OKC'] };
    const positions = { PHI: 12, OKC: 5 };
    // Pick 12 is "worse" than pick 5 (higher number = worse)
    expect(resolveSwap(swap, positions)).toBe('PHI');
  });
  
  // A3: Same position edge case
  it('handles tie in pick positions (defaults to first team)', () => {
    const swap = { type: 'best_of', teams: ['PHI', 'OKC'] };
    const positions = { PHI: 8, OKC: 8 };
    expect(resolveSwap(swap, positions)).toBe('PHI'); // First team wins tie
  });
  
  // A4: Missing position data
  it('throws if position data is incomplete', () => {
    const swap = { type: 'best_of', teams: ['PHI', 'OKC'] };
    const positions = { PHI: 12 }; // Missing OKC
    expect(() => resolveSwap(swap, positions)).toThrow();
  });
});
```

**Definition of "Higher" Pick**:

- In NBA draft, pick #1 is the "best" pick, #60 is the "worst"
- "Higher pick" = lower number = better position
- `best_of` → team gets the pick with the LOWER position number
- `worst_of` → team gets the pick with the HIGHER position number

#### B. Multi-Team Swap Tests (Out of Scope)

Multi-team swaps (3+ teams in a single swap) are **NOT currently supported** in the UI or data model.

```javascript
describe.skip('multi-team swaps (NOT SUPPORTED)', () => {
  // B1: 3-team best-of (not implemented)
  it('3-team best_of selects lowest position from all 3', () => {
    // SKIP: Not supported in current UI
    // Would need: { type: 'best_of', teams: ['PHI', 'OKC', 'LAL'] }
  });
  
  // B2: Chained swaps (not implemented)
  it('chained swaps resolve in order', () => {
    // SKIP: Not supported
    // Team A has swap with Team B, Team B has swap with Team C
  });
});
```

#### C. Protection + Swap Interaction Tests

```javascript
describe('protection + swap interaction', () => {
  // C1: Protected swap (expected behavior - NOT YET IMPLEMENTED)
  it.skip('protected swap defers resolution if protection triggers', () => {
    // SKIP: Not implemented - Phase 4+ work
    // If swap pick is protected and lands in protected range,
    // swap resolution may be deferred
  });
  
  // C2: Unprotected swap resolves immediately
  it('unprotected swap resolves based on lottery positions', () => {
    const pick = { 
      isSwap: true, 
      swapType: 'best_of',
      swapWithTeamId: 'OKC',
      protection: null  // Unprotected
    };
    const positions = { PHI: 12, OKC: 5 };
    expect(resolveSwap(pick, positions)).toBe('OKC');
  });
});
```

#### D. Season Advance + Resolution Integration Tests

```javascript
describe('season advance with swap resolution', () => {
  // D1: Swaps resolve when season advances past draft year
  it('resolves swaps for draft year when advancing past it', () => {
    const team = {
      teamCode: 'BOS',
      draftPicks: [{
        id: 'PHI_2026_1',
        year: 2026,
        isSwap: true,
        swapType: 'best_of',
        swapWithTeamId: 'OKC',
        resolved: false
      }]
    };
    
    const lotteryResults = { PHI: 12, OKC: 5, BOS: 20 };
    
    // Advance from 2025-26 to 2026-27 (past 2026 draft)
    const result = updateDraftPicksWithSwapResolution(
      team, '2025-26', '2026-27', lotteryResults
    );
    
    expect(result.draftPicks[0].resolved).toBe(true);
    expect(result.draftPicks[0].resolvedOwner).toBe('OKC');
  });
  
  // D2: Future swaps remain unresolved
  it('does not resolve swaps for future draft years', () => {
    const team = {
      teamCode: 'BOS',
      draftPicks: [{
        id: 'PHI_2027_1',
        year: 2027,
        isSwap: true,
        swapType: 'best_of',
        resolved: false
      }]
    };
    
    // Advance from 2025-26 to 2026-27 (before 2027 draft)
    const result = updateDraftPicksWithSwapResolution(
      team, '2025-26', '2026-27', {}
    );
    
    expect(result.draftPicks[0].resolved).toBe(false);
  });
});
```

#### E. Display Label Tests

```javascript
describe('pick label formatting', () => {
  // E1: Resolved swap shows resolved owner
  it('formatPick shows resolved owner when swap is resolved', () => {
    const pick = {
      year: 2026,
      round: '1st',
      isSwap: true,
      swapType: 'best_of',
      resolved: true,
      resolvedOwner: 'OKC'
    };
    const label = formatPick(pick);
    expect(label).toContain('2026 1st Round');
    expect(label).toContain('🔁');
    // Should indicate resolution result
    expect(label).toMatch(/resolved.*OKC|OKC.*won/i);
  });
  
  // E2: Unresolved swap shows swap info
  it('formatPick shows swap partners when unresolved', () => {
    const pick = {
      year: 2027,
      round: '1st',
      isSwap: true,
      swapType: 'best_of',
      swapWithTeamId: 'OKC',
      resolved: false
    };
    const label = formatPick(pick);
    expect(label).toContain('Swap (Best of) vs OKC');
  });
});
```

### Test Priority

| Priority | Test Suite | Reason |
|----------|------------|--------|
| P0 | A1, A2 (basic resolution) | Core functionality |
| P0 | E1, E2 (display) | User-facing |
| P1 | A3, A4 (edge cases) | Robustness |
| P1 | D1, D2 (integration) | End-to-end flow |
| P2 | C1, C2 (protection interaction) | Future work |
| OUT | B1, B2 (multi-team) | Not supported |

---

## 7. Stop Conditions Check

| Condition | Status | Evidence |
|-----------|--------|----------|
| NO consumer of picks anywhere | ⚠️ **PARTIAL** | Consumers exist (C1-C8) but NONE require resolution |
| Multiple sims with disagreeing timing | ✅ CLEAR | Only one sim path: `seasonManager.advanceSeasonInWorld()` |
| Picks are display-only | ❌ NOT TRUE | Picks used in trade execution, Stepien validation |

### Stop Condition Analysis

**"If there is NO consumer of picks anywhere"** → NOT triggered. Consumers exist.

**"If multiple sims exist and disagree on timing"** → NOT triggered. Only one sim path.

**HOWEVER**: Phase 3 "resolution" has **no execution target yet**. Resolution logic can be built, but there's currently:

- No draft lottery simulation
- No lottery results data ingestion
- No world advancement that needs resolved picks

**Recommendation**: Proceed with Phase 3 but scope it as **infrastructure**. Build resolution logic + tests, but don't expect it to execute in production until a draft simulation or world-advancing feature is built.

---

## 8. Master Doc Changes Summary

The following section should be added to `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md`:

### Phase 3 PREFLIGHT Findings (January 2026)

> **Status**: PREFLIGHT COMPLETE  
> **Mode**: DOCS + tests-only  
> **Purpose**: Produce no-surprises implementation plan for swap resolution

#### Key Findings

1. **Pick Consumers**: 8 consumers identified (C1-C8). All work with unresolved picks.

2. **Resolution Timing**: No resolution logic exists. Recommended timing: during `advanceSeasonInWorld()` when advancing past a draft year.

3. **Resolved-Pick Schema**: Recommended Schema A (Minimal Extension) with `resolved`, `resolvedOwner`, `resolvedPosition`, `resolutionMeta` fields.

4. **Conveyance/Rollover**: Schema exists (`DraftPickConveyanceZ`) but NO runtime implementation. Protection is string-only. No rollover logic.

5. **Label Formatting**: Two formatters exist (`formatPick`, `getPickLabel`) with minor inconsistencies. Recommend unifying to single configurable formatter.

6. **Resolution Has No Execution Target**: No draft lottery simulation or world-advancing sim exists to consume resolved picks. Phase 3 is infrastructure for future features.

---

## 9. Files Changed/Added

### Return Package Created

- `docs/return-packages/trade-machine-draft-picks__phase-3-preflight__2026-01-04.md` — This file

### Master Doc To Be Updated

- `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md` — Add Phase 3 PREFLIGHT Findings section

---

## 10. Next Steps for Phase 3 EXECUTION

1. **Create `resolveSwap()` function** in new file `src/features/architect/utils/tradeMachine/utils/swapResolution.js`
2. **Add resolution fields** to pick objects (non-breaking extension)
3. **Wire resolution into `updateDraftPicksWithStepien()`** or create new `updateDraftPicksWithSwapResolution()`
4. **Unify label formatters** (optional - low priority)
5. **Add test fixtures** for resolved swaps
6. **Document that resolution is infrastructure** until draft sim is built

---

*End of Return Package*
