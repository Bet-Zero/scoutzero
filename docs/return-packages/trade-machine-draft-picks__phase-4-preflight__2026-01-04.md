# Trade Machine Draft Picks — Phase 4 PREFLIGHT Return Package

> **Date**: 2026-01-04  
> **Status**: PREFLIGHT COMPLETE  
> **Mode**: Discovery + docs + tests/fixtures only (NO runtime behavior changes)  
> **Document**: `docs/return-packages/trade-machine-draft-picks__phase-4-preflight__2026-01-04.md`

---

## 1. Summary + Scope Boundary

### Summary

Phase 4 PREFLIGHT is complete. This document provides a "no-surprises" implementation plan for:
1. **Conveyance / rollover** (protected pick chains, finalYear, convert-to-2nd, etc.)
2. **Protection normalization** (structured protection vs. loose string)
3. **Remove "Swap (+) / Swap (-)" entries** from protection dropdown

### Scope Boundary

**IN SCOPE (Completed)**:
- Map every place protection is stored, authored, parsed, displayed, used
- Audit `DraftPickConveyanceZ` schema and recommend runtime usage
- Identify minimal viable data model for conveyance chains
- Identify safe migration plan from string → structured protection
- Create fixtures and tests defining expected behaviors (skipped tests for Phase 4 execution)

**OUT OF SCOPE (Deferred)**:
- No implementation of rollover / draft outcomes
- No changes to `validateStepien` behavior
- No changes to UI behavior

---

## 2. Protection & Conveyance Truth Map (D1)

### Protection Touchpoints

| # | File Path | Function/Component | Fields Read/Written | Current Behavior | What It Should Do (Phase 4) |
|---|-----------|-------------------|---------------------|------------------|----------------------------|
| **P1** | `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js:74-80` | `isMeaningfulProtection()` | `protection` (string) | Regex: `/top\s*[1-9]\d*/i`, `/lottery/i`, `/1-14/i` | Accept string OR structured object; return boolean |
| **P2** | `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js:84-94` | `getPickOptions()` | N/A (returns array) | Returns 9 options including "Swap (+)", "Swap (-)" | Remove "Swap (+/-)" entries; swap is separate from protection |
| **P3** | `src/features/architect/tradeMachine/TradePickRow.jsx:122-131` | Protection dropdown | `pickObj.protection` (string) | Dropdown renders `getPickOptions()` | No change needed after `getPickOptions()` fixed |
| **P4** | `src/features/architect/utils/tradeMachine/rules/validateStepien.js:86-87` | Stepien consecutive check | `current.protection`, `next.protection` | Calls `isMeaningfulProtection(string)` | Support structured protection object |
| **P5** | `src/features/architect/utils/tradeMachine/rules/draftRules.js:41` | `validateDraftPicks()` | `p.protection` | Calls `isMeaningfulProtection(string)` | Support structured protection object |
| **P6** | `src/features/architect/utils/stepienUtils.js:27-29` | `buildFirstRoundCalendar()` | `p.protection`, `p.protectionText` | Uses protection for calendar status | Support structured protection |
| **P7** | `src/features/architect/utils/tradeHelpers.js:360` | `formatPick()` | `p.protection` (string) | Displays `🛡 ${p.protection}` | Display structured protection label |
| **P8** | `src/features/architect/utils/seasonManager.js:400-426` | `updateDraftPicks()` | `pick.status` only | Does NOT read protection | No change needed |
| **P9** | `src/features/architect/utils/seasonManager.js:817-912` | `updateDraftPicksWithStepien()` | `pick.year`, `pick.round`, ownership | Does NOT process conveyance | Phase 4: Add conveyance resolution hook |

### Conveyance Touchpoints

| # | File Path | Function/Component | Fields Read/Written | Current Behavior | What It Should Do (Phase 4) |
|---|-----------|-------------------|---------------------|------------------|----------------------------|
| **C1** | `src/schemas/architect.ts:91-123` | `DraftPickConveyanceZ` schema | `conveyance.*` | **SCHEMA ONLY** - never read at runtime | Runtime should use for rollover logic |
| **C2** | `src/schemas/architect.ts:141` | `DraftPickZ.conveyance` | `conveyance` field | Field exists on schema | Runtime should process conveyance conditions |
| **C3** | `src/features/architect/utils/seasonManager.js:950-1014` | `resolveDraftPickSwapsForYear()` | Swap fields only | Resolves swaps, NOT conveyance | Phase 4: Add parallel `resolveConveyance()` function |

### Schema Conveyance Fields (Unused)

```typescript
// src/schemas/architect.ts:91-123
DraftPickConveyanceZ = {
  id: string,
  description: string,
  originalYear: number,    // When pick obligation started
  currentYear: number,     // Current year in ladder
  finalYear: number,       // MUST convey by this year
  stepienImpact: {
    eligibleForStepien: boolean,
    locksYears: number[],
    deadYears: number[],
    affectedYears: number[],
    nextAvailableFirstRound: number,
    conveyanceDeadline: number,
    rolloverYears: number[],
  },
  conditions: {
    protection: string,     // e.g., "Top 3"
    ifConveys: string,      // e.g., "Sends 2026 1st"
    ifRolls: string,        // e.g., "Becomes unprotected 2027 1st"
  },
  affects: string[],        // Related pick IDs
}
```

**Evidence of Non-Use**:
```bash
$ grep -r "ifConveys\|ifRolls\|finalYear" src/features/
# Returns ZERO matches in feature code - only in schema
```

---

## 3. Protection Strings Inventory (D2)

### All Protection Strings in Codebase

#### Source 1: `getPickOptions()` UI Dropdown Values

| Value | Label | Meaningful? | Notes |
|-------|-------|-------------|-------|
| `""` | Unprotected | No | Empty string = unprotected |
| `"Top 3"` | Protected Top 3 | ✅ Yes | Regex match |
| `"Top 5"` | Protected Top 5 | ✅ Yes | Regex match |
| `"Top 8"` | Protected Top 8 | ✅ Yes | Regex match |
| `"Top 10"` | Protected Top 10 | ✅ Yes | Regex match |
| `"Lottery"` | Lottery Protected | ✅ Yes | Regex match |
| `"Top 20"` | Protected Top 20 | ✅ Yes | Regex match |
| `"Swap (+)"` | Swap (+) | ❌ No | **CONFUSING** - not meaningful protection |
| `"Swap (-)"` | Swap (-) | ❌ No | **CONFUSING** - not meaningful protection |

#### Source 2: Test Fixtures

| Fixture | Protection Values Used |
|---------|----------------------|
| `protectionStringPresent.json` | `"Top 3"`, `null` |
| `multiTeamTrade.json` | `null`, `"Lottery"` |
| `swapOnly.json` | `null` |
| `protection_swap_plus_minus_strings.json` | `"Swap (+)"`, `"Swap (-)"` |

#### Source 3: `isMeaningfulProtection()` Regex Patterns

```javascript
// tradeUtilities.js:74-80
/top\s*[1-9]\d*/i    // Matches: "Top 3", "Top 10", "top5", etc.
/lottery/i           // Matches: "Lottery", "LOTTERY", "lottery"
/1-14/i              // Matches: "1-14"
```

### Search Commands + Results

```bash
# Find all "Swap (+)" / "Swap (-)" occurrences
$ grep -rn "Swap (\+)\|Swap (-)" src/
src/features/architect/utils/tradeMachine/utils/tradeUtilities.js:92:  { label: 'Swap (+)', value: 'Swap (+)' },
src/features/architect/utils/tradeMachine/utils/tradeUtilities.js:93:  { label: 'Swap (-)', value: 'Swap (-)' },

# Find all isMeaningfulProtection call sites
$ grep -rn "isMeaningfulProtection" src/
src/features/architect/utils/tradeMachine/index.js:59
src/features/architect/utils/tradeMachine/utils/tradeUtilities.js:74
src/features/architect/utils/tradeMachine/rules/validateStepien.js:1,86,87
src/features/architect/utils/tradeMachine/rules/draftRules.js:8,41
src/features/architect/utils/tradeHelpers.js:368,369

# Find all getPickOptions call sites
$ grep -rn "getPickOptions" src/
src/features/architect/tradeMachine/TradePickRow.jsx:5,127
src/features/architect/utils/tradeMachine/utils/tradeUtilities.js:84
```

---

## 4. Conveyance Schema Audit + Recommendation (D3)

### Current State: `DraftPickConveyanceZ` is UNUSED

**Evidence**:
- Schema defined at `src/schemas/architect.ts:91-123`
- Field attached to `DraftPickZ` at line 141
- **ZERO** runtime code reads `conveyance`, `ifConveys`, `ifRolls`, or `finalYear`

**Why It Exists**:
- Schema was likely added during initial design for future conveyance support
- Scraper may populate these fields from source data (RealGM, etc.)
- Trade Machine never implemented the logic to process them

### Recommendation: Phase 4 Should START Using It

**Option 1: Use Existing Schema (Recommended)**

The `DraftPickConveyanceZ` schema is well-designed. Phase 4 should:
1. Keep schema as-is
2. Implement `resolveConveyance()` function that reads `conveyance.conditions`
3. Wire into season advance via `updateDraftPicksWithConveyance()`

**Option 2: Replace Schema (Not Recommended)**

Replacing the schema would require:
- Migration of any scraped data that uses the existing format
- More effort for no clear benefit

### What Phase 4 Execution Needs to Add

```javascript
// New function in seasonManager.js or separate conveyance.js
export function resolveConveyance(pick, lotteryResults) {
  if (!pick.conveyance) return pick;
  
  const position = lotteryResults[pick.originalTeam];
  const protection = parseProtection(pick.conveyance.conditions.protection);
  
  if (protectionTriggers(protection, position)) {
    // Protection triggered - execute ifRolls
    return rollPick(pick, pick.conveyance);
  } else {
    // Protection didn't trigger - execute ifConveys
    return conveyPick(pick);
  }
}
```

---

## 5. Structured Model Proposal (D3)

### Option A: Minimal / Low Risk (Recommended for Phase 4)

**Approach**: Keep `protection` as string, add `protectionMeta` alongside

```typescript
interface DraftPick {
  // EXISTING - unchanged
  protection: string | null;       // "Top 3", "Lottery", etc.
  
  // NEW - structured metadata
  protectionMeta?: {
    type: 'position' | 'lottery' | 'playoff' | 'always' | 'never';
    maxPosition?: number;          // e.g., 3 for "Top 3"
    conversionTarget?: {
      action: 'roll' | 'convert' | 'cancel';
      toYear?: number;
      toRound?: 1 | 2;
    };
  };
}
```

**Schema Shape**:
```typescript
const ProtectionMetaZ = z.object({
  type: z.enum(['position', 'lottery', 'playoff', 'always', 'never']),
  maxPosition: z.number().int().optional(),
  conversionTarget: z.object({
    action: z.enum(['roll', 'convert', 'cancel']),
    toYear: z.number().int().optional(),
    toRound: z.number().int().optional(),
  }).optional(),
}).optional();
```

**Code Changes in Phase 4 Execution**:
1. `isMeaningfulProtection()` - Check `protectionMeta?.type` first, fall back to string regex
2. `getPickOptions()` - No change (dropdown still sets string value)
3. UI - Optionally add structured editor that populates both `protection` and `protectionMeta`

**Compatibility Plan**:
- Legacy picks with only `protection` string continue to work
- New picks can have both `protection` (for display) and `protectionMeta` (for logic)
- Migration: Optional batch job to populate `protectionMeta` from existing `protection` strings

### Option B: Correct / Future-Proof

**Approach**: Replace string `protection` with structured object

```typescript
interface DraftPick {
  // REPLACED - protection is now structured
  protection: ProtectionObject | null;
}

interface ProtectionObject {
  type: 'position' | 'lottery' | 'playoff' | 'unprotected';
  maxPosition?: number;
  displayLabel: string;            // "Top 3 Protected"
  conversionTarget?: {
    action: 'roll' | 'convert' | 'cancel';
    toYear?: number;
    toRound?: 1 | 2;
  };
}
```

**Code Changes in Phase 4 Execution**:
1. `isMeaningfulProtection()` - Handle object OR string (backward compat)
2. `getPickOptions()` - Return objects instead of strings
3. `TradePickRow.jsx` - Update dropdown to handle objects
4. `formatPick()` - Read `protection.displayLabel` instead of raw string
5. All validators - Update to read structured object

**Compatibility Plan**:
- Migration required: Convert all existing `protection: string` to objects
- Adapter layer during migration: `normalizeProtection(p)` handles both formats

### Recommendation: **Start with Option A**

Option A is lower risk and can be done incrementally:
1. Add `protectionMeta` without changing existing `protection` behavior
2. Update validators to prefer `protectionMeta` when present
3. After validation, consider migrating to Option B

---

## 6. Conveyance Runtime Target (D4)

### When Should Conveyance Execute?

| Event | Current Existence | Recommendation |
|-------|-------------------|----------------|
| Season advance | ✅ `advanceSeasonInWorld()` exists | **Primary target** - add conveyance resolution |
| Trade execution | ✅ `tradeManager.executeTrade()` exists | Secondary - validate conveyance obligations |
| Manual user input | ❌ Does NOT exist | Future - allow manual lottery result entry |

### Required Inputs for Conveyance Execution

```typescript
interface ConveyanceResolutionInputs {
  // REQUIRED
  pick: DraftPick;                           // Pick with conveyance conditions
  lotteryResults: Map<TeamCode, number>;     // Team → draft position (1-60)
  
  // OPTIONAL
  currentSeason: string;                     // "2025-26" - for determining which year to evaluate
  method: 'lottery' | 'manual' | 'inferred'; // Audit trail
}
```

### What the Repo Currently Lacks

1. **Draft Lottery Simulation** - No lottery sim exists
2. **Lottery Results Ingestion** - No data pipeline for real lottery results
3. **Manual Entry UI** - No way for users to input lottery positions
4. **Conveyance History Tracking** - No audit trail of protection triggers

### Hook Points for Phase 4 Execution

1. **`updateDraftPicksWithStepien()`** (seasonManager.js:817)
   - Already processes picks during season advance
   - Add conveyance resolution before Stepien recalculation

2. **New `resolveConveyanceForYear()` function**
   - Mirror `resolveDraftPickSwapsForYear()` pattern
   - Call from season advance when advancing past a draft year
   - NO-OP without lottery results (same pattern as swap resolution)

---

## 7. "Swap (+)/Swap (-)" Findings + Risk Analysis (T5)

### Where Defined

| Location | Line | Code |
|----------|------|------|
| `tradeUtilities.js` | 92 | `{ label: 'Swap (+)', value: 'Swap (+)' }` |
| `tradeUtilities.js` | 93 | `{ label: 'Swap (-)', value: 'Swap (-)' }` |

### Where Used

| Location | How Used | Impact |
|----------|----------|--------|
| `TradePickRow.jsx:127` | Rendered in protection dropdown | Users can select these values |
| `isMeaningfulProtection()` | **NOT matched** by regex | Treated as unprotected |
| `validateStepien()` | Calls `isMeaningfulProtection()` | Swap strings = unprotected for Stepien |

### Risk Analysis

| Risk | Severity | Evidence | Impact |
|------|----------|----------|--------|
| User confusion | HIGH | Users may think "Swap (+)" makes pick a swap | Picks not actually swaps |
| Stepien bypass | ❌ NONE | "Swap (+/-)" NOT treated as meaningful protection | No bypass risk |
| Persisted data | ❌ NONE | Search found zero fixtures with these values in real use | Safe to remove |

### Recommendation: REMOVE in Phase 4 Execution

**Action**: Delete lines 92-93 from `getPickOptions()` in `tradeUtilities.js`

**Rationale**:
1. Swap is already properly modeled with `isSwap`, `swapType`, `swapWithTeamId` (Phase 2)
2. "Swap (+/-)" as protection is confusing and serves no purpose
3. These values are NOT treated as meaningful protection
4. No evidence of persisted data using these values

**Migration Risk**: NONE - search found zero real usage

---

## 8. Fixtures Created (D5)

| Fixture File | Purpose | Key Fields |
|--------------|---------|------------|
| `conveyance_rolls_forward.json` | Protected pick that rolls to next year | `conveyance.conditions.ifRolls`, `conveyance.finalYear` |
| `conveyance_converts_to_2nd.json` | Protected pick that converts to 2nd round | `conversionTarget.action`, `conversionTarget.toRound` |
| `conveyance_multi_year_ladder.json` | Multi-tier protection: Top 3 → Top 5 → Unprotected | `protectionLadder[]` array with year/condition/ifTriggered |
| `protection_swap_plus_minus_strings.json` | Documents "Swap (+/-)" confusion | `blastRadiusAnalysis`, `phase4Recommendation` |

### Fixture Shapes

**conveyance_rolls_forward.json**:
```json
{
  "conveyance": {
    "originalYear": 2026,
    "finalYear": 2027,
    "conditions": {
      "protection": "Top 3",
      "ifConveys": "Sends 2026 1st",
      "ifRolls": "Becomes unprotected 2027 1st"
    }
  }
}
```

**conveyance_multi_year_ladder.json**:
```json
{
  "protectionLadder": [
    { "year": 2026, "condition": "Top 3", "ifTriggered": "roll", "rollToYear": 2027 },
    { "year": 2027, "condition": "Top 5", "ifTriggered": "roll", "rollToYear": 2028 },
    { "year": 2028, "condition": "Unprotected", "ifTriggered": "cancel" }
  ]
}
```

---

## 9. Tests Run + Results (D5)

### Test File: `src/tests/tradeMachine/conveyancePreflight.test.js`

```bash
$ npm run test -- src/tests/tradeMachine/conveyancePreflight.test.js --run

 ✓ src/tests/tradeMachine/conveyancePreflight.test.js  (29 tests | 7 skipped) 12ms

 Test Files  1 passed (1)
      Tests  22 passed | 7 skipped (29)
```

### Test Breakdown

| Section | Tests | Status | Purpose |
|---------|-------|--------|---------|
| Protection String Current Behavior | 9 | ✅ Passed | Assert current `isMeaningfulProtection()` behavior |
| getPickOptions() Audit | 3 | ✅ Passed | Document Swap (+/-) presence |
| DraftPickConveyanceZ Schema Audit | 4 | ✅ Passed | Verify fixtures include conveyance structures |
| Stepien Impact Documentation | 2 | ✅ Passed | Document Stepien affected years |
| Protection Strings Inventory | 2 | ✅ Passed | Validate all protection values |
| **SKIPPED: Conveyance Resolution** | 3 | ⏭️ Skipped | Phase 4 execution will implement |
| **SKIPPED: Structured Protection** | 2 | ⏭️ Skipped | Phase 4 execution will implement |
| **SKIPPED: Remove Swap (+/-)** | 2 | ⏭️ Skipped | Phase 4 execution will implement |

### Skipped Tests List

1. `resolveConveyance() rolls pick forward when protection triggers`
2. `resolveConveyance() converts 1st to 2nd when conversion triggers`
3. `multi-year ladder tracks conveyance through all tiers`
4. `Option A: protectionMeta alongside string protection`
5. `Option B: Replace string with structured protection object`
6. `getPickOptions does NOT include "Swap (+)"`
7. `getPickOptions does NOT include "Swap (-)"`

### Existing Tests (Still Passing)

```bash
$ npm run test -- src/tests/tradeMachine/draftPicksPreflight.test.js --run
 ✓ 23 passed

$ npm run test -- src/tests/tradeMachine/swapResolution.test.js --run
 ✓ 30 passed | 1 skipped | 3 todo

$ npm run test -- src/tests/tradeMachine/seasonSwapResolution.test.js --run
 ✓ 13 passed
```

---

## 10. Stop Conditions Check

| Stop Condition | Status | Evidence |
|----------------|--------|----------|
| Protection strings persisted widely in base team data | ❌ NOT TRIGGERED | Protection is string, but format is consistent. Existing fixtures use expected values. |
| Stepien treats "Swap (+/-)" as meaningful protection | ❌ NOT TRIGGERED | `isMeaningfulProtection('Swap (+)')` returns `false` - verified in tests |
| Existing conveyance implementation partially wired | ❌ NOT TRIGGERED | Schema exists but **ZERO** runtime code uses it |

**All stop conditions CLEAR** - Phase 4 can proceed.

---

## 11. Master Doc Edits Summary

Added section to `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md`:

### Phase 4 PREFLIGHT Findings (January 2026)

> **Status**: PREFLIGHT COMPLETE  
> **Mode**: Discovery + docs + tests/fixtures only  
> **Purpose**: Produce no-surprises implementation plan for conveyance and protection normalization

#### Key Findings

1. **Protection Storage**: Protection stored as string everywhere (`"Top 3"`, `"Lottery"`, etc.)
2. **Conveyance Schema**: `DraftPickConveyanceZ` exists but **NEVER USED** at runtime
3. **"Swap (+/-)" Confusion**: These values in protection dropdown but NOT meaningful protection
4. **Migration Risk**: LOW - no persisted data uses problematic formats
5. **Execution Target**: Season advance (`updateDraftPicksWithStepien`) is natural hook

#### Deliverables Created

| File | Description |
|------|-------------|
| `docs/return-packages/trade-machine-draft-picks__phase-4-preflight__2026-01-04.md` | This return package |
| `src/tests/tradeMachine/conveyancePreflight.test.js` | Phase 4 preflight tests (22 pass, 7 skip) |
| `src/tests/fixtures/tradeMachinePicks/conveyance_rolls_forward.json` | Roll-forward fixture |
| `src/tests/fixtures/tradeMachinePicks/conveyance_converts_to_2nd.json` | Conversion fixture |
| `src/tests/fixtures/tradeMachinePicks/conveyance_multi_year_ladder.json` | Multi-tier ladder fixture |
| `src/tests/fixtures/tradeMachinePicks/protection_swap_plus_minus_strings.json` | Swap (+/-) documentation |

---

## 12. Phase 4 EXECUTION Implied Plan

Based on PREFLIGHT findings, Phase 4 EXECUTION should:

### Priority 1: Remove "Swap (+/-)" from Protection Dropdown

**Effort**: ~15 minutes  
**Risk**: None  
**Files**: `tradeUtilities.js` lines 92-93

### Priority 2: Add `protectionMeta` (Option A)

**Effort**: ~2-4 hours  
**Risk**: Low (additive change)  
**Files**: 
- Schema: `architect.ts`
- Validator: `isMeaningfulProtection()` in `tradeUtilities.js`
- Optional: UI editor for structured protection

### Priority 3: Implement `resolveConveyance()` Function

**Effort**: ~4-8 hours  
**Risk**: Medium (new logic)  
**Files**:
- New: `conveyanceResolution.js` (mirror swapResolution.js pattern)
- Modified: `seasonManager.js` (hook into season advance)

### Priority 4: Wire Conveyance into Season Advance

**Effort**: ~2-4 hours  
**Risk**: Medium  
**Files**: `seasonManager.js:updateDraftPicksWithStepien()` or new function

### NOT IN Phase 4 EXECUTION

- Draft lottery simulation
- Lottery results ingestion
- Multi-team swaps
- Full Stepien calendar visualization

---

*End of Return Package*
