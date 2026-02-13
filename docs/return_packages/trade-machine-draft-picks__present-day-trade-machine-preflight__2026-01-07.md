# Trade Machine Draft Picks — Present-day Trade Machine PREFLIGHT

**Date**: 2026-01-07  
**Mode**: PREFLIGHT (repo inspection + grep + targeted excerpts ONLY; NO code changes)  
**Goal**: Verify and map how draft picks work inside the Trade Machine *in isolation* (present-day trade checker), and ensure no worlds/seasons/positionsMap are required for normal Trade Machine legality.

---

## A) Trade Machine Entry Point — Call Graph

### Entry Point (UI → Validation)

1. **UI Component**: `useTradeMachine.js` hook (line 578)
2. **User Action**: User clicks "Validate Trade" button
3. **Handler**: `handleValidate()` (line 626) calls `validateCurrentTrade()` (line 533)

### Complete Call Graph

```
User clicks "Validate Trade"
          ↓
handleValidate() [useTradeMachine.js:626]
          ↓
validateCurrentTrade() [useTradeMachine.js:533]
          ↓
validateTrade({teams, capProjections, currentYear}) [tradeValidator.js:276]
          ↓
    ┌─────────────────────────────────────────────────────────────────┐
    │ FOR EACH TEAM:                                                  │
    │   ├── computeMatchingValues() [salaryUtils.js]                  │
    │   ├── validateSalaryMatching() [validateSalaryMatching.js]      │
    │   ├── validateHardCap() [hardCapValidation.js]                  │
    │   ├── validateStepien() [validateStepien.js:37]  ← DRAFT PICKS  │
    │   ├── validateCash() [eligibilityRules.js]                      │
    │   ├── validateTradeExceptions() [validateTradeExceptions.js]    │
    │   ├── validateSignAndTrade() [validateSignAndTrade.js]          │
    │   ├── validateConsent() [validateConsent.js]                    │
    │   ├── validateReacquisition() [eligibilityRules.js]             │
    │   ├── validateAggregation() [validateAggregation.js]            │
    │   └── Enforcement rules (consent, eligibility, timing, apron)   │
    └─────────────────────────────────────────────────────────────────┘
          ↓
Return: { legal: boolean, teamResults[], summaryByTeamIndex[], tradeReceipt }
```

### Key Files in Validation Path

| File | Path | Purpose |
|------|------|---------|
| useTradeMachine.js | `src/features/architect/hooks/useTradeMachine.js` | UI hook, prepares trade data |
| tradeValidator.js | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Main validation orchestrator |
| validateStepien.js | `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | Draft pick (Stepien) validation |
| draftRules.js | `src/features/architect/utils/tradeMachine/rules/draftRules.js` | Wrapper + 7-year rule |

---

## B) Draft Picks Inside the Trade Machine (Today)

### B1) Pick Sourcing Path

**Source**: Team cap sheet data loaded via `loadWorldTeamData()` or `loadTeamCapSheet()`

```javascript
// useTradeMachine.js:237-245
const rawPicks = data.draftPicks || data.picks || [];
const picksWithIds = rawPicks.map(p => ensurePickId(p));

const teamObj = {
  ...baseTeam,
  ...data,
  picks: picksWithIds, // ← Picks attached to team object
};
```

**Sources (Fallback Chain)**:

1. `worldId ? teamLoader.getTeam()` → world snapshot
2. `loadTeamCapSheet(teamId)` → Firebase `architect_baseTeams/{teamId}` or `teams/{teamId}`

**Pick Field**: `team.picks[]` or `team.draftPicks[]` (normalized to `picks`)

### B2) Pick Normalization/Processing for Display

**File**: `src/features/architect/utils/tradeMachine/utils/pickIdUtils.js`

- `ensurePickId(pick)` — Ensures all picks have canonical IDs (`{originalTeam}_{year}_{round}`)
- `normalizeRound(input)` — Normalizes round formats (`"1st"` → `1`, `"2nd"` → `2`)
- `generatePickId(pick)` — Creates canonical ID from pick properties

**Display Component**: `OutgoingPicksList.jsx` (line 15-23)

```javascript
const available = useMemo(
  () => [
    ...incomingPicks,
    ...(team.picks || []).filter(
      (p) => !picks.some((pk) => areSamePick(pk, p))
    ),
  ],
  [team.picks, picks, incomingPicks]
);
```

### B3) Stepien Evaluation

**File**: `src/features/architect/utils/tradeMachine/rules/validateStepien.js`

**Function**: `validateStepien(team, tradeCtx = {})`

**Exact Inputs**:

```typescript
// team object shape (from tradeValidator.js)
team: {
  teamId?: string,
  team?: { id: string, totalSalary: number, ... },
  picksOut?: Array<Pick>,      // From UI state (what user selected)
  outgoingPicks?: Array<Pick>, // Alternative name (from tests)
  postTradeStatus?: { isAtOrAboveSecondApron: boolean },
  context?: { yearKey: number, capSettings: {...} }
}

// Pick shape
Pick: {
  id?: string,
  year: number,
  round: number | "1st" | "2nd",
  originalTeam: string,
  protection?: string | null,
  isSwap?: boolean,
  swapType?: "best_of" | "worst_of",
  swapWithTeamId?: string
}

// tradeCtx (optional context)
tradeCtx: {
  year?: number,
  yearKey?: number,
  capSettings?: { secondApron: number }
}
```

**Exact Outputs**:

```typescript
{
  passed: boolean,
  violations: string[],      // e.g., ["Violates Stepien Rule (consecutive future 1sts)."]
  message: string,           // "Stepien Rule compliant" or "Stepien Rule violation"
  details: string,           // violations joined by "; "
  currentYear: number,
  farthestYear: number
}
```

**Stepien Logic Summary** (lines 66-93):

1. Filter to first round picks (`round === '1st' || round === 1`)
2. Filter to Stepien-relevant picks (via `reservesYearForStepien()`)
   - Outright picks: ALWAYS reserve year
   - Swap picks: Reserve year UNLESS `swapType === 'worst_of'`
3. Sort by year, check for consecutive unprotected pairs
4. Check for meaningful protection via `isMeaningfulProtection()`

**Additional Checks**:

- 7-year limit (lines 96-101)
- Second apron frozen pick restriction (lines 103-132)

---

## C) HARD REQUIREMENT: No Season/World Coupling for Normal Use

### Search Results

```bash
grep -rn "advanceSeasonInWorld|resolveDraftPickConveyanceForYear|resolveDraftPickSwapsForYear|getDraftPositionsMap|draftPositionsByYear|positionsMap" src/
```

**Findings**:

| Function | Files Using It | Used by Trade Machine? |
|----------|----------------|------------------------|
| `advanceSeasonInWorld` | `seasonManager.js`, `SeasonAdvanceModal.jsx` | ❌ NO |
| `resolveDraftPickConveyanceForYear` | `seasonManager.js`, `phase5DraftPositions.test.js` | ❌ NO |
| `resolveDraftPickSwapsForYear` | `seasonManager.js`, `phase5DraftPositions.test.js` | ❌ NO |
| `getDraftPositionsMap` | `worldManager.js`, `seasonManager.js` | ❌ NO |
| `draftPositionsByYear` | `worldManager.js`, `seasonManager.js` | ❌ NO |
| `positionsMap` | Resolution utilities, tests | ❌ NO |

### Explicit Confirmation

✅ **Trade Machine present-day legality does NOT depend on positionsMap/worlds/seasons.**

The resolution functions (`resolveConveyanceForPick`, `resolvePickSwap`, etc.) are:

1. Exported from `tradeMachine/index.js` but NOT imported or called by `tradeValidator.js`
2. Only used in `seasonManager.js` for the season advance flow (GM Dashboard)
3. Designed as NO-OP when `positionsMap` is null/undefined/empty (defensive)

**Proof from tradeValidator.js imports** (lines 1-30):

```javascript
// NO imports from conveyanceResolution.js or swapResolution.js
import { validateStepien } from '../rules/validateStepien.js';
// validateStepien does NOT call any resolution functions
```

---

## D) What "Protections/Swap/Conveyance" Mean in Present-Day Mode

### D1) Whether a Pick is Tradeable

**Current Implementation**: ALL picks in `team.picks[]` are displayed and selectable.

**Tradeability is NOT explicitly checked** — The validation happens AFTER selection:

- `validateStepien()` checks if selected picks violate Stepien Rule
- No pre-selection filtering for "already owed" or "blocked by protection"

### D2) How a Pick is Labeled (Protection Text)

**Function**: `isMeaningfulProtection()` in `tradeUtilities.js:88-129`

```javascript
// Returns true if protection is meaningful for Stepien bypass:
// - "Top 3", "Top 5", "Lottery", etc.
// - protectionMeta.type === 'position' | 'lottery' | 'playoff'
isMeaningfulProtection(protectionOrPick)
```

**UI Display**: `TradePickRow.jsx` shows protection string directly from `pick.protection`

**Pick Options** (from `getPickOptions()` in `tradeUtilities.js:134-142`):

- Unprotected, Top 3, Top 5, Top 8, Top 10, Lottery, Top 20

### D3) How Swaps are Represented as Assets

**Pick Fields** (Phase 2 Implementation):

```javascript
{
  isSwap: true,                  // Marks as swap right
  swapType: 'best_of' | 'worst_of', // Type of swap
  swapWithTeamId: 'OKC',        // Team being swapped with
}
```

**Stepien Impact** (from `reservesYearForStepien()` in `validateStepien.js:14-24`):

- `isSwap: true` + `swapType: 'best_of'` → Reserves year
- `isSwap: true` + `swapType: 'worst_of'` → Does NOT reserve year
- Missing `swapType` → Defaults to `'best_of'` (backward compatibility)

---

## E) Gaps vs What We Want

### E1) Is Stepien Currently Enforced Correctly?

✅ **MOSTLY YES** — for picks being traded OUT.

**What Works**:

- Consecutive year detection
- Protection bypass (`isMeaningfulProtection`)
- Swap handling (Phase 2: `reservesYearForStepien`)
- 7-year limit
- Second apron frozen pick restriction

**What's Missing**:

- ❌ **Existing obligations not considered**: Stepien only checks `picksOut` (what's being traded NOW), NOT what's already owed to other teams from past trades.

### E2) Can Trade Machine Incorrectly Allow Trading a Blocked Pick?

⚠️ **YES — CRITICAL GAP**

**Scenario**: Team already owes 2027 1st to Team B. User tries to trade 2028 1st to Team C.

**Current Behavior**: Trade Machine sees only `picksOut: [2028_1st]`, which is a single pick — no Stepien violation detected.

**Correct Behavior**: Should detect that 2027 is already owed, making 2027+2028 a consecutive pair.

**Root Cause**: Stepien validation uses `team.outgoingPicks || team.picksOut` but does NOT access `team.owedPicks` or `team.previouslyTradedPicks`.

### E3) Are Protections Treated as "Resolution Logic"?

✅ **NO — CORRECTLY SEPARATE**

**Present-day mode**: `isMeaningfulProtection()` only checks if protection STRING exists for Stepien bypass. It does NOT resolve/execute protection logic.

**Resolution mode** (season advance): `resolveConveyanceForPick()` in `conveyanceResolution.js` actually evaluates lottery position against protection threshold.

These are correctly decoupled.

### E4) Missing Wiring — Picks Displayed But Not Used in Validation?

✅ **NO GAP HERE** — Picks are correctly wired.

**Path**:

1. User selects pick in UI → added to `team.picksOut`
2. `validateCurrentTrade()` passes `picksOut` to `validateTrade()`
3. `validateStepien()` reads `team.outgoingPicks || team.picksOut`
4. Validation runs on selected picks

---

## Summary of Gaps

### Critical Gaps

| # | Gap | Impact | Fix Complexity |
|---|-----|--------|----------------|
| G1 | **Existing obligations not considered** | Can trade consecutive picks if one is already owed | Medium — need `team.owedPicks` data structure |
| G2 | **No "already traded" visibility** | User can select same pick for multiple trades | Low — UI enhancement |

### Non-Issues (Verified Working)

| Item | Status |
|------|--------|
| Stepien consecutive year detection | ✅ Working |
| Protection bypass | ✅ Working |
| Swap handling | ✅ Working (Phase 2) |
| 7-year limit | ✅ Working |
| Second apron frozen pick | ✅ Working |
| Worlds/seasons independence | ✅ Confirmed |

---

## Recommended Minimal Execution Tasks

### Phase A: Data Foundation (Required for G1 Fix)

- [ ] **A1**: Add `owedPicks` field to team cap sheet schema
  - File: `src/features/architect/utils/firebaseTeamPlanHelpers.js`
  - File: `src/features/architect/utils/worldTeamData.ts`
- [ ] **A2**: Populate `owedPicks` from Firebase base teams
  - File: Team data migration or manual population
- [ ] **A3**: Ensure `loadWorldTeamData()` returns `owedPicks`

### Phase B: Stepien Enhancement (G1 Fix)

- [ ] **B1**: Modify `validateStepien()` to accept `existingObligations`
  - File: `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
  - Input: Add `team.owedPicks` or `tradeCtx.existingObligations`
- [ ] **B2**: Merge `outgoingPicks + owedPicks` before consecutive year check
- [ ] **B3**: Add tests for existing obligation scenarios
  - File: `src/tests/tradeMachine/draftPicksPreflight.test.js`

### Phase C: UI Enhancement (G2 Fix)

- [ ] **C1**: Gray out / disable picks that are already owed
  - File: `src/features/architect/tradeMachine/OutgoingPicksList.jsx`
- [ ] **C2**: Show "Already traded to [Team]" tooltip for owed picks

### Phase D: Documentation

- [ ] **D1**: Update `TRADE_MACHINE_AUDIT.md` with Stepien obligation handling
- [ ] **D2**: Add pick data schema to `PROJECT_SCHEMA.md`

---

## Appendix: Key Code References

### validateStepien.js (lines 37-93)

```javascript
export function validateStepien(team, tradeCtx = {}) {
  const { picksOut = [], outgoingPicks = [] } = team;
  const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;
  
  // Filter to first round picks that reserve years for Stepien
  const firstRoundPicks = picks.filter(
    (pick) => pick.round === '1st' || pick.round === 1 || pick.round === 'first'
  );
  const stepienRelevantPicks = firstRoundPicks.filter(pick => reservesYearForStepien(pick));
  
  // Check for consecutive years
  if (stepienRelevantPicks.length >= 2) {
    const sortedPicks = stepienRelevantPicks.sort((a, b) => a.year - b.year);
    for (let i = 0; i < sortedPicks.length - 1; i++) {
      const current = sortedPicks[i];
      const next = sortedPicks[i + 1];
      if (next.year === current.year + 1 &&
          !isMeaningfulProtection(current.protection) &&
          !isMeaningfulProtection(next.protection)) {
        violations.push('Violates Stepien Rule (consecutive future 1sts).');
        break;
      }
    }
  }
  // ...
}
```

### reservesYearForStepien() (lines 14-24)

```javascript
function reservesYearForStepien(pick) {
  if (!pick.isSwap) return true;  // Outright picks always reserve
  const swapType = pick.swapType || 'best_of';
  return swapType !== 'worst_of';  // worst_of doesn't reserve
}
```

### isMeaningfulProtection() (tradeUtilities.js:88-129)

```javascript
export const isMeaningfulProtection = (protectionOrPick) => {
  if (!protectionOrPick) return false;
  // Handle protectionMeta or string protection
  // Returns true for "Top X", "Lottery", etc.
  return /top\s*[1-9]\d*/i.test(protection) ||
         /lottery/i.test(protection) ||
         /1-14/i.test(protection);
};
```

---

## Conclusion

The Trade Machine present-day validation is correctly isolated from world/season infrastructure. Stepien validation works for picks being traded in the current transaction, but does NOT account for existing pick obligations. This is the primary gap requiring Phase A+B fixes before the Trade Machine can accurately enforce Stepien for all scenarios.
