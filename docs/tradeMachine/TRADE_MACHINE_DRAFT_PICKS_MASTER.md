# Trade Machine Draft Picks Master Document

> **Version**: 1.0.0 (January 2026)  
> **Status**: PREFLIGHT AUDIT - Analysis Only  
> **Purpose**: Comprehensive audit of draft pick implementation in Trade Machine  
> **Author**: Automated Code Audit  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [File Map](#file-map)
3. [Current Reality Spec](#current-reality-spec)
4. [Gap List](#gap-list)
5. [Target Model Proposal](#target-model-proposal)
6. [Integration Plan](#integration-plan)
7. [Test Plan](#test-plan)
8. [Top 10 Highest-Risk Holes](#top-10-highest-risk-holes)

---

## Executive Summary

This document provides a **brutally honest audit** of draft pick implementation in the Trade Machine. The audit covers:
- Pick asset data model and schema
- Editing/authoring functionality
- Trade construction and validation
- UI display and receipt/export
- Stepien Rule and CBA compliance

### High-Level Assessment

| Area | Status | Risk Level |
|------|--------|------------|
| Pick Data Model | ⚠️ Partial | **MEDIUM** |
| Basic Trading | ✅ Implemented | Low |
| Protection Support | ⚠️ Basic/String-only | **HIGH** |
| Swap Rights | ⚠️ UI-only/Not Validated | **HIGH** |
| Stepien Validation | ✅ Basic Implementation | Medium |
| Conveyance/Rollover | ❌ Not Implemented | **HIGH** |
| Pick Swaps (Best-of) | ❌ Not Implemented | **HIGH** |
| Pick Chains | ❌ Not Implemented | **HIGH** |
| Multi-tier Protections | ❌ Not Implemented | **HIGH** |
| Receipt/Export Display | ✅ Basic Implementation | Low |

---

## File Map

### A) Data Models / Types / Schemas

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/schemas/architect.ts` | **Canonical pick schema definition** | `DraftPickZ` - Zod schema with fields: id, year, round, pick (nullable - draft position when known), owner, originalTeam, status, isSwap, protection, stepienEligible, tradeable, via, recipient, route, notes, conveyance, metadata |
| `src/schemas/architect.ts` | **Conveyance sub-schema** | `DraftPickConveyanceZ` - id, description, originalYear, currentYear, finalYear, stepienImpact, conditions (protection, ifConveys, ifRolls), affects |
| `src/features/architect/utils/tradeMachine/constants/types.ts` | **TypeScript interfaces** | `NormalizedTeam.picksOut` - Array of picks with year, round; limited pick typing |

### B) State Management / Reducers / Hooks

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/hooks/useTradeMachine.js` | **Main trade state hook** | `togglePick()` - Add/remove pick from trade; `updatePickField()` - Edit pick properties; `picksOut[]` array per team |
| `src/features/architect/hooks/useTradeMachine.js:239-240` | **Pick data loading** | Maps `draftPicks` from team data to `picks` for trade machine compatibility |
| `src/features/architect/GMDashboard/hooks/useArchitectState.ts` | **Dashboard state** | `draftPicks?: unknown[]` - Generic pick array |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` | **Dashboard actions** | `draftPicks?: unknown[]` - Generic pick array |

### C) Trade Machine UI Components

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/tradeMachine/TradePickRow.jsx` | **Individual pick row display** | Protection dropdown select, `isSwap` checkbox toggle, `swapWithTeamId` dropdown, team logo display |
| `src/features/architect/tradeMachine/OutgoingPicksList.jsx` | **Outgoing picks list** | Lists available + selected picks, uses `areSamePick()` for comparison |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx` | **Team card with picks tab** | Picks tab counter, routes to `OutgoingPicksList`, displays incoming picks with `formatPick()` |
| `src/features/architect/tradeMachine/TradeEditor.jsx` | **Main trade editor** | Passes `togglePick`, `updatePickField` to team cards |
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` | **Trade summary** | `getPickLabel()` helper displays year/round/via/protection/swap |
| `src/features/architect/tradeMachine/TradeExportCapture.jsx` | **Export/capture view** | Displays picks received per team with `formatPick()` |

### D) Validator / Rule Engine

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | **Stepien Rule validation** | Checks consecutive unprotected 1st rounders, 7-year limit, second apron frozen pick restriction |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.ts` | **TypeScript version** | `Pick` interface with year, round, teamId, isSwap, protection, originalTeam |
| `src/features/architect/utils/tradeMachine/rules/draftRules.js` | **Draft rules consolidated** | `hasStepienViolation()`, `validateDraftPicks()` - duplicate Stepien implementations |
| `src/features/architect/utils/tradeMachine/rules/basicRules.js` | **Protection utility** | `isMeaningfulProtection()` - checks if protection array has value >= 8 |
| `src/features/architect/utils/tradeMachine/utils/tradeUtilities.js` | **Trade utilities** | `isMeaningfulProtection()` - regex-based check for "top X", "lottery", "1-14" strings |
| `src/features/architect/utils/stepienUtils.js` | **Stepien calendar helpers** | `buildFirstRoundCalendar()`, `passesStepienRule()`, `hasStepienViolation()` |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | **Main validator** | Calls `validateStepien()`, passes `picksOut` to validation |

### E) Serialization / Firestore Read/Write

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/utils/firebaseTeamPlanHelpers.js` | **Team plan loading** | Loads `draftPicks` from Firebase baseDoc |
| `src/features/architect/utils/worldTeamData.ts` | **World team data** | `draftPicks?: unknown[]` interface |
| `src/features/architect/utils/schemaAdapter.js` | **Schema adapter** | Maps `draftPicks` to both `draftPicks` and `picks` properties |
| `src/features/architect/utils/tradeManager.js` | **Trade execution** | Updates `draftPicks` array when trade applied |
| `src/features/architect/utils/mutationPipeline.js` | **Mutation pipeline** | Filters `draftPicks` on trade execution |
| `src/features/architect/utils/seasonManager.js` | **Season transitions** | `updateDraftPicks()`, `updateDraftPicksWithStepien()` for advancing picks |

### F) Helper Functions

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `src/features/architect/utils/tradeHelpers.js` | **Trade helpers** | `areSamePick()` - compares by year/round/via; `formatPick()` - display string with protection/swap icons |
| `src/features/architect/utils/draftPickUtils.js` | **Pick utilities** | Checks if pick is owned by team |
| `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js` | **Draft key generation** | Creates cache key from picks using `originalTeam` |

### G) Team Data Scraping (Reference Only)

| Path | Responsibility | Key Functions/Types |
|------|----------------|---------------------|
| `team-scrape/draft-picks/scripts/realgm_draft_picks.ts` | **RealGM scraper** | Parses `originalTeam`, `currentOwner`, `protection`, `status` |
| `team-scrape/team-data/config/team_scrape_schema.ts` | **Scrape schema** | `originalTeam`, `currentOwner`, `protection` fields |

---

## Current Reality Spec

### What Picks Currently Support ✅

1. **Basic Pick Properties**
   - `year` (number) - Draft year
   - `round` (number or string "1st"/"2nd")
   - `originalTeam` (string) - Team that originally owned the pick
   - `owner` / `currentOwner` (string) - Current pick holder
   - `via` (string) - Team pick was acquired from (for display)
   - `status` (string) - "future", "own", "incoming", "outgoing", "contested"

2. **Trading Picks**
   - Add/remove picks from trade via `togglePick()`
   - Edit pick properties via `updatePickField()`
   - Track `fromTeamId` and `toTeamId` for pick movement
   - Display picks in team cards and summary panels

3. **Protection (Basic)**
   - String-based protection field (e.g., "Top 3", "Lottery", "Top 10")
   - UI dropdown with preset options: Unprotected, Top 3/5/8/10, Lottery, Top 20
   - `isMeaningfulProtection()` regex check for Stepien bypass

4. **Swap Rights (UI Only)**
   - `isSwap` boolean toggle in UI
   - `swapWithTeamId` dropdown to select swap partner
   - Displayed with 🔁 icon in `formatPick()`
   - **NOT validated** - no swap resolution logic exists

5. **Stepien Rule Validation**
   - Consecutive unprotected 1st round picks blocked
   - 7-year maximum future trading limit
   - Second apron teams blocked from trading 7-year-out own picks
   - Uses `isMeaningfulProtection()` to allow protected consecutive picks

6. **Pick Comparison**
   - `areSamePick()` compares year, round, and via (string-based)
   - Numeric leniency (`+a.year === +b.year`)

### What Picks Do NOT Support ❌

1. **Multi-Tier Protections**
   - Cannot define "Top 3 protected in 2026, Top 5 protected in 2027, unprotected in 2028"
   - No year-by-year protection breakdown
   - No conversion rules (e.g., "conveys to 2nd rounder if protection triggers")

2. **Conveyance / Rollover Logic**
   - Schema has `conveyance` field but it's unused in Trade Machine
   - No logic to roll picks forward when protection triggers
   - No final conveyance year tracking
   - No "becomes unprotected in 20XX" logic

3. **Pick Swap Resolution**
   - `isSwap` flag exists but swap logic is never evaluated
   - No "best of" or "worst of" swap resolution
   - No swap partner pick comparison
   - Swaps don't block/reserve years for Stepien

4. **Pick Chains / Provenance**
   - Cannot track "PHI 2026 1st → via OKC → currently owned by HOU"
   - `route` field in schema is unused
   - `via` is display-only, not used for validation

5. **Conditional Pick Structures**
   - No "less favorable of" A or B logic
   - No "more favorable of" logic
   - No conditional triggers (e.g., "if team makes playoffs")
   - No pick deferral logic

6. **Stable Pick Identity**
   - ID generation is inconsistent (`${year}_${round}_${originalTeam}` sometimes, `${idx}-${year}-${round}` other times)
   - No canonical pick ID across the system
   - Potential for duplicate picks or lost picks during trades

7. **Stepien Calendar Visualization**
   - `buildFirstRoundCalendar()` exists but not integrated with Trade Machine UI
   - No visual indicator of Stepien-blocked years
   - No pre-trade Stepien warning

8. **Second-Round Pick Trading**
   - Mostly ignored - Stepien only applies to 1st round
   - No 2nd round conversion logic
   - No 2nd round swap handling

### What is Partially Implemented / Stubbed ⚠️

1. **`conveyance` Schema Field** (Stubbed)
   - File: `src/schemas/architect.ts:91-123`
   - Has `stepienImpact`, `conditions`, `affects` sub-fields
   - **Never read or used** by Trade Machine validators

2. **`isMeaningfulProtection()` Dual Implementation** (Inconsistent)
   - File 1: `basicRules.js:25-29` - Checks array with `p.comparison === '<' && p.value >= 8`
   - File 2: `tradeUtilities.js:74-80` - Regex on string `/top\s*[1-9]\d*/i`
   - **Conflict**: Array vs string protection format causes inconsistent behavior

3. **Stepien Rule - Three Implementations** (Duplicated)
   - `validateStepien.js` - Primary, used by tradeValidator
   - `draftRules.js:hasStepienViolation()` - Unused duplicate
   - `stepienUtils.js:hasStepienViolation()` - Unused duplicate
   - **Risk**: Fixes to one aren't applied to others

4. **Pick Swap Partner** (UI-Only)
   - File: `TradePickRow.jsx:126-140`
   - `swapWithTeamId` stored but never used in validation
   - No resolution of which team gets better/worse pick

---

## Gap List

### BLOCKER Level Gaps

| # | Gap Title | Severity | Location | User Impact | Done Criteria |
|---|-----------|----------|----------|-------------|---------------|
| G1 | **Swap Rights Not Validated** | BLOCKER | `validateStepien.js`, `tradeValidator.js` | Swaps bypass Stepien illegally; swap partner selection is meaningless | Swap rights properly reserve years for Stepien; swap resolution shows which team keeps which pick |
| G2 | **No Multi-Tier Protection Support** | BLOCKER | `DraftPickZ`, `TradePickRow.jsx` | Cannot represent real NBA protections (e.g., "Top 3 → Top 5 → Unprotected") | Protection is tiered array with year/condition/conversion; UI allows tier editing |
| G3 | **No Conveyance/Rollover Logic** | BLOCKER | N/A - Not implemented | Protected picks that trigger have no forward path; users can't model real pick obligations | Conveyance rules execute at season advance; picks roll to next tier/year automatically |
| G4 | **`isMeaningfulProtection()` Format Mismatch** | BLOCKER | `basicRules.js:25`, `tradeUtilities.js:74` | Stepien validation may incorrectly pass/fail based on protection format | Single canonical implementation; all callers use same format |

### MAJOR Level Gaps

| # | Gap Title | Severity | Location | User Impact | Done Criteria |
|---|-----------|----------|----------|-------------|---------------|
| G5 | **No Stable Pick ID Strategy** | MAJOR | `areSamePick()`, `computeTradeDraftKey.js` | Picks can be duplicated or lost in complex multi-team trades | Canonical ID format: `{originalTeam}_{year}_{round}` enforced everywhere |
| G6 | **Pick Swap Best/Worst-Of Logic Missing** | MAJOR | N/A - Not implemented | Cannot model "more favorable of Team A / Team B pick" | Swap resolution function compares projected picks and assigns correctly |
| G7 | **Stepien Calendar Not Shown in UI** | MAJOR | `stepienUtils.js`, `TradeEditor.jsx` | Users don't know which years are blocked before creating trade | Calendar visualization shows blocked/available years per team |
| G8 | **Three Duplicate Stepien Implementations** | MAJOR | See File Map section D | Bug fixes may not propagate; maintenance burden | Single `validateStepien.js` is canonical; others removed or delegated |
| G9 | **Second Apron Swap Year Blocking Missing** | MAJOR | `validateStepien.js:76-96` | Second apron swap restrictions not enforced | Swaps properly count toward Stepien restrictions for second apron teams |
| G10 | **Pick Chain / Provenance Tracking** | MAJOR | `DraftPickZ.route` field | Cannot show full pick history "PHI → OKC → HOU" | Route array populated and displayed; validation uses full chain |

### MINOR Level Gaps

| # | Gap Title | Severity | Location | User Impact | Done Criteria |
|---|-----------|----------|----------|-------------|---------------|
| G11 | **No Pick Cash Conversion** | MINOR | N/A | Cannot model "pick becomes cash if..." | Cash conversion as pick resolution option |
| G12 | **Second Round Picks Largely Ignored** | MINOR | Various validators | 2nd round swaps and protections not handled | 2nd round picks have parity with 1st round where applicable |
| G13 | **No Pick Deferral Logic** | MINOR | N/A | Cannot delay pick conveyance by team choice | Deferral option in pick structure |
| G14 | **Protection Dropdown Has "Swap (+/-)" Options** | MINOR | `tradeUtilities.js:93` | Confusing UX - swap is separate from protection | Remove swap options from protection dropdown |
| G15 | **`via` Field Display-Only** | MINOR | `areSamePick()`, `formatPick()` | Via doesn't affect validation, only display | Document or enhance `via` usage |

---

## Target Model Proposal

### 5.1 Canonical Pick Entity Schema

```typescript
interface DraftPick {
  // === IDENTITY (Stable, Never Changes) ===
  id: string;                    // Format: "{originalTeam}_{year}_{round}"
                                  // e.g., "PHI_2026_1", "LAL_2028_2"
                                  // Note: For edge cases with multiple trades, the ID
                                  // remains stable based on ORIGINAL team, not current owner
  
  // === CORE PROPERTIES ===
  year: number;                  // Draft year (e.g., 2026)
  round: 1 | 2;                  // Draft round
  originalTeam: TeamCode;        // Team that originally owned the pick
  
  // === OWNERSHIP ===
  currentOwner: TeamCode;        // Who currently controls the pick
  route: TeamCode[];             // Full trade history: ["PHI", "OKC", "HOU"]
  via?: TeamCode;                // Immediate previous owner (derived from route)
  
  // === STATUS ===
  status: 'future' | 'conveyed' | 'cancelled';
  tradeable: boolean;            // Can be traded (Stepien compliant)
  stepienEligible: boolean;      // Computed: does it count for Stepien?
  
  // === SWAP RIGHTS ===
  isSwap: false | SwapRights;    // false if outright pick, SwapRights if swap
  
  // === PROTECTIONS ===
  protections: ProtectionTier[]; // Ordered array of protection tiers
  conveyedAs?: 'first' | 'second' | 'cash' | null;  // What it became after conveyance
  
  // === METADATA ===
  notes?: string;
  sourceTradeId?: string;        // Which trade created this obligation
  createdAt: string;             // ISO timestamp
}

interface SwapRights {
  type: 'best_of' | 'worst_of' | 'choice';
  teams: TeamCode[];             // Teams involved in swap (2+ teams)
  controller: TeamCode;          // Who makes selection (for 'choice' type)
  conditionalOn?: string;        // Optional condition
}

interface ProtectionTier {
  year: number;                  // Which year this tier applies
  condition: ProtectionCondition;
  ifTriggered: ConveyanceAction;
}

interface ProtectionCondition {
  type: 'position' | 'lottery' | 'playoff' | 'always' | 'never';
  maxPosition?: number;          // e.g., maxPosition: 3 = "Top 3 protected" (positions 1-3)
                                  // maxPosition: 14 = "Lottery protected" (positions 1-14)
}

interface ConveyanceAction {
  action: 'roll' | 'convert' | 'cancel';
  toYear?: number;               // For 'roll': which year
  toRound?: 1 | 2;               // For 'convert': becomes 2nd rounder
  toCash?: number;               // For 'convert': becomes cash
}
```

### 5.2 Human-Readable Description Generator Spec

```typescript
function generatePickDescription(pick: DraftPick): string {
  // Examples of expected output:
  // "2026 1st Round Pick (PHI)" 
  // "2026 1st Round Pick (PHI via OKC)"
  // "2026 1st Round Pick (PHI) - Top 3 Protected, Top 5 in 2027, Unprotected in 2028"
  // "2026 1st Round Pick Swap Rights - Best of PHI/OKC/CLE"
  // "2026 1st Round Pick (PHI) - Lottery Protected → Converts to 2nd Round"
}
```

### 5.3 Ownership & Conditionality Resolution

```typescript
interface PickResolutionContext {
  currentSeason: string;         // "2025-26"
  draftLotteryResults?: Map<TeamCode, number>;  // Team → pick position
  playoffTeams?: TeamCode[];
}

function resolvePickOwnership(
  pick: DraftPick, 
  context: PickResolutionContext
): ResolvedPick {
  // 1. Check if pick year has arrived
  // 2. Evaluate current protection tier
  // 3. Check if protection triggered
  // 4. Execute conveyance action (roll/convert/cancel)
  // 5. For swaps: compare positions and assign
  // 6. Return resolved ownership
}
```

---

## Integration Plan

### Phase 0: Safety & Instrumentation (1-2 days)

**Tasks:**
- [ ] Add logging to all Stepien validation paths
- [ ] Create debug panel showing pick states during trade
- [ ] Add assertions for pick ID format consistency
- [ ] Create pick state dump for debugging
- [ ] **DATA AUDIT**: Query Firestore to document actual `draftPicks` data format in production (protection format, field usage)

**Acceptance Criteria:**
- Console logs show which Stepien function is called
- Pick IDs logged on every trade operation
- Debug panel renders pick state in Trade Machine
- **DATA AUDIT REPORT**: Document shows actual protection formats in production data

**Validation Steps:**
- Open Trade Machine, add picks to trade
- Verify console shows pick operations
- Verify debug panel renders pick state

---

### Phase 1: Data Model Stabilization (3-5 days)

**Tasks:**
- [ ] G5: Implement canonical pick ID generation
- [ ] G4: Unify `isMeaningfulProtection()` to single implementation
- [ ] G8: Remove duplicate Stepien implementations, keep only `validateStepien.js`
- [ ] Add migration script for existing picks to new ID format
- [ ] Update `areSamePick()` to use canonical IDs

**Acceptance Criteria:**
- All picks have `{originalTeam}_{year}_{round}` format IDs
- Single `isMeaningfulProtection()` in `tradeUtilities.js`
- Only `validateStepien.js` used by tradeValidator
- Existing pick data migrated without data loss

**Validation Steps:**
- Run existing Stepien tests - all pass
- Load team with picks - IDs are canonical format
- Trade picks - no duplication or loss

---

### Phase 2: Trade Engine Correctness (5-7 days)

**Tasks:**
- [ ] G1: Implement swap rights validation in Stepien
- [ ] G9: Add second apron swap year blocking
- [ ] Properly track pick movement during multi-team trades
- [ ] Ensure `route` array updated when picks change hands
- [ ] Implement pick-to-team assignment for N-way trades

**Acceptance Criteria:**
- Swaps count toward Stepien calculations
- Second apron teams blocked from swaps in restricted years
- 3+ team trades correctly assign picks
- Route array shows full provenance

**Validation Steps:**
- Test: Swap rights block consecutive Stepien years
- Test: Second apron team cannot trade swap in restricted year
- Test: 3-team trade moves pick A→B→C, route updated

---

### Phase 3: Validator Correctness (5-7 days)

**Tasks:**
- [ ] G2: Implement multi-tier protection schema
- [ ] G3: Implement conveyance/rollover logic
- [ ] G6: Implement best-of / worst-of swap resolution
- [ ] Add protection tier validation
- [ ] Add conveyance simulation for season advance

**Acceptance Criteria:**
- Protection tiers can be defined with year/condition/action
- Season advance evaluates protections and rolls picks
- Swap resolution compares positions and assigns correctly
- Validation prevents invalid protection configurations

**Validation Steps:**
- Test: Define "Top 3 → Top 5 → Unprotected" protection
- Test: Season advance with triggered protection rolls pick
- Test: Best-of swap assigns to team with better pick

---

### Phase 4: UI Parity & Editing Tools (5-7 days)

**Tasks:**
- [ ] G7: Add Stepien calendar visualization
- [ ] G14: Remove swap options from protection dropdown
- [ ] Build multi-tier protection editor
- [ ] Build swap rights configurator
- [ ] Show pick provenance in UI
- [ ] Add conveyance preview ("becomes X if Y")

**Acceptance Criteria:**
- Stepien calendar shows blocked/available years
- Protection editor allows tier definition
- Swap configurator allows team selection
- Pick cards show full route history
- Conveyance outcome previewed before trade

**Validation Steps:**
- UI shows which years are Stepien-blocked
- Create pick with 3 protection tiers via UI
- Configure swap with 2 teams via UI
- Pick card shows "via OKC via PHI"

---

### Phase 5: Tests & Regression Harness (3-5 days)

**Tasks:**
- [ ] Unit tests for pick ID generation
- [ ] Unit tests for protection tier logic
- [ ] Unit tests for swap resolution
- [ ] Integration tests for multi-team trades
- [ ] Create fixture set covering all edge cases
- [ ] Add regression test suite

**Acceptance Criteria:**
- 100% coverage of new pick logic
- Fixture set covers: simple trade, multi-tier protection, swaps, conveyance
- All existing tests continue passing
- New regression suite catches future breakage

**Validation Steps:**
- Run `npm run test tests/trade/` - all pass
- Run `npm run test tests/validators/stepien.test.js` - all pass
- New pick tests pass

---

## Test Plan

### 7.1 Unit Tests

**Pick ID Generation**
```javascript
describe('pick ID generation', () => {
  it('generates canonical ID from year/round/team', () => {
    expect(generatePickId({ year: 2026, round: 1, originalTeam: 'PHI' }))
      .toBe('PHI_2026_1');
  });
  
  it('handles 2nd round picks', () => {
    expect(generatePickId({ year: 2027, round: 2, originalTeam: 'LAL' }))
      .toBe('LAL_2027_2');
  });
});
```

**Protection Tier Logic**
```javascript
describe('protection evaluation', () => {
  it('triggers Top 3 protection at pick 2', () => {
    const result = evaluateProtection(
      { type: 'position', maxPosition: 3 },
      { pickPosition: 2 }
    );
    expect(result.triggered).toBe(true);
  });
  
  it('does not trigger Top 3 protection at pick 5', () => {
    const result = evaluateProtection(
      { type: 'position', maxPosition: 3 },
      { pickPosition: 5 }
    );
    expect(result.triggered).toBe(false);
  });
  
  it('executes roll action on trigger', () => {
    const tier = {
      condition: { type: 'position', maxPosition: 3 },
      ifTriggered: { action: 'roll', toYear: 2027 }
    };
    const result = executeConveyance(tier, { pickPosition: 2 });
    expect(result.rolledToYear).toBe(2027);
  });
});
```

**Swap Resolution**
```javascript
describe('swap resolution', () => {
  it('best_of assigns better pick to swap holder', () => {
    const swap = { type: 'best_of', teams: ['PHI', 'OKC'], controller: 'HOU' };
    const positions = { PHI: 12, OKC: 5 };
    expect(resolveSwap(swap, positions)).toBe('OKC'); // pick 5 is better
  });
  
  it('worst_of assigns worse pick to swap holder', () => {
    const swap = { type: 'worst_of', teams: ['PHI', 'OKC'], controller: 'HOU' };
    const positions = { PHI: 12, OKC: 5 };
    expect(resolveSwap(swap, positions)).toBe('PHI'); // pick 12 is worse
  });
});
```

### 7.2 Validator Tests

**Stepien with Swaps**
```javascript
describe('Stepien with swaps', () => {
  it('blocks consecutive years when swap counts', () => {
    const result = validateStepien({
      outgoingPicks: [
        { year: 2026, round: '1st' },
        { year: 2027, round: '1st', isSwap: { type: 'best_of', teams: ['A', 'B'] } }
      ]
    });
    expect(result.passed).toBe(false);
  });
  
  it('allows swaps to not count when properly protected', () => {
    // Swaps with meaningful protection should not block Stepien
  });
});
```

**Multi-Tier Protection**
```javascript
describe('multi-tier protection', () => {
  it('validates consistent tier years', () => {
    const result = validateProtectionTiers([
      { year: 2026, condition: { type: 'position', positions: [1, 3] } },
      { year: 2027, condition: { type: 'position', positions: [1, 5] } },
      { year: 2028, condition: { type: 'always' } } // unprotected
    ]);
    expect(result.valid).toBe(true);
  });
  
  it('rejects gaps in tier years', () => {
    const result = validateProtectionTiers([
      { year: 2026, condition: { type: 'position', positions: [1, 3] } },
      { year: 2028, condition: { type: 'always' } } // missing 2027
    ]);
    expect(result.valid).toBe(false);
  });
});
```

### 7.3 Integration Tests

**Trade Creation → Receipt → Reload**
```javascript
describe('pick trade lifecycle', () => {
  it('creates trade with picks, persists, reloads correctly', async () => {
    // 1. Create trade with PHI 2026 1st (Top 3 protected)
    // 2. Apply trade to plan
    // 3. Save plan
    // 4. Reload plan
    // 5. Verify pick ownership changed
    // 6. Verify protection preserved
  });
});
```

### 7.4 Minimum Fixture Set

| Fixture | Purpose | Covers |
|---------|---------|--------|
| `simple_pick_trade.json` | Basic pick trade between 2 teams | ID generation, ownership change |
| `protected_pick_trade.json` | Trade with single-tier protection | Protection parsing, Stepien bypass |
| `multi_tier_protection.json` | Trade with 3-year rolling protection | Tier evaluation, conveyance |
| `swap_rights_trade.json` | Trade of swap rights | Swap validation, Stepien counting |
| `three_team_pick_trade.json` | 3-team trade with picks | Multi-party routing, route tracking |
| `second_apron_frozen.json` | Second apron team trading picks | Frozen pick restrictions |
| `stepien_violation.json` | Invalid consecutive 1st trade | Stepien blocking |

---

## Top 10 Highest-Risk Holes

1. **G1: Swap Rights Not Validated** - `validateStepien.js` + `tradeValidator.js`
   - Swaps completely bypass Stepien; users can create illegal trades

2. **G4: `isMeaningfulProtection()` Format Mismatch** - `basicRules.js:25` vs `tradeUtilities.js:74`
   - Array vs string format causes unpredictable Stepien pass/fail

3. **G2: No Multi-Tier Protection** - `DraftPickZ` schema + `TradePickRow.jsx`
   - Cannot model real NBA pick protections; user expectation mismatch

4. **G3: No Conveyance Logic** - Not implemented anywhere
   - Protected picks have no resolution path; season advance doesn't work

5. **G5: Unstable Pick IDs** - `areSamePick()` + `computeTradeDraftKey.js`
   - Picks can be lost or duplicated in complex trades

6. **G8: Three Stepien Implementations** - `validateStepien.js`, `draftRules.js`, `stepienUtils.js`
   - Bug fixes may not propagate; maintenance nightmare

7. **G6: No Best/Worst-of Logic** - Not implemented
   - Swap rights selection is meaningless without resolution

8. **G9: Second Apron Swap Blocking Missing** - `validateStepien.js:76-96`
   - Second apron swap restrictions per CBA not enforced

9. **G7: No Stepien Calendar in UI** - `stepienUtils.js` exists but unused
   - Users must guess which years are tradeable

10. **G10: No Pick Chain Tracking** - `DraftPickZ.route` unused
    - Full pick provenance lost; can't trace "PHI → OKC → HOU"

---

## Recommended Phase 1 Scope

**Build first (highest ROI, lowest risk):**

1. **Unify `isMeaningfulProtection()`** (G4)
   - Single implementation in `src/features/architect/utils/tradeMachine/rules/` (near validation logic)
   - Update all callers in `validateStepien.js`, `draftRules.js`, `tradeHelpers.js`
   - ~2 hours work, high safety improvement

2. **Consolidate Stepien implementations** (G8)
   - Keep `validateStepien.js` as canonical
   - Delete/redirect `draftRules.js:hasStepienViolation` and `stepienUtils.js:hasStepienViolation`
   - ~4 hours work, reduces maintenance burden

3. **Implement canonical pick ID** (G5)
   - Add `generatePickId()` utility
   - Update `areSamePick()` to use IDs
   - Update `computeTradeDraftKey.js` 
   - ~8 hours work, prevents data loss

**Why these first:**
- Low implementation complexity
- High safety impact (prevents bugs)
- No UI changes required
- No schema migration required
- Foundation for Phase 2+ work

---

## Open Questions / Missing Repo Facts

1. **How are picks currently stored in Firestore?**
   - Are there real `draftPicks` arrays in production team documents?
   - What protection format is used in production data?

2. **Is there a separate "pick obligations" collection?**
   - Or are all picks stored per-team in `draftPicks` arrays?

3. **What is the expected behavior for contested picks?**
   - The schema mentions "contested" status but no validation logic exists

4. **Are there any existing world snapshots with pick trade history?**
   - Would help understand if route/provenance is tracked anywhere

5. **What is the source of truth for "current year" in validation?**
   - `context.yearKey`, `tradeCtx.year`, or `new Date().getFullYear()`?

---

*Document generated by automated code audit. This is analysis only - no code changes made.*
