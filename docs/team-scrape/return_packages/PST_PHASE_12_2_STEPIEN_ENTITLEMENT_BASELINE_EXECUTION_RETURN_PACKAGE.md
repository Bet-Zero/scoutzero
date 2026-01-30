# PST_PHASE_12_2_STEPIEN_ENTITLEMENT_BASELINE_EXECUTION_RETURN_PACKAGE.md

**MODE**: EXECUTION (Code changes completed)  
**DATE**: 2026-01-30  
**PHASE**: 12.2 — Stepien Entitlement Baseline Migration  
**STATUS**: COMPLETE

---

## Summary

Phase 12.2 completes the Stepien entitlement migration by switching the validation baseline from legacy `draftPicksObligations` to resolved team `entitlements`. This ensures Stepien validation uses the same source of truth as the Trade Machine UI.

**Before Phase 12.2:**

- Baseline: `draftPicksObligations` (legacy)
- Delta: `picksOut` + `entitlementsOut`
- Issue: UI uses entitlements, validator uses obligations → mismatch causes false failures

**After Phase 12.2:**

- Baseline: `validationEntitlements` (when available), fallback to `draftPicksObligations`
- Delta: `entitlementsOut` + `picksOut`
- Result: UI and validator use same source of truth

---

## Files Changed

### 1. Created: resolveValidationEntitlements.js

**File:** `src/features/architect/utils/tradeMachine/utils/resolveValidationEntitlements.js`

**Purpose:** Validation-only wrapper for batch entitlement resolution with per-call caching.

**Exported Functions:**

- `resolveEntitlementsForValidation({ worldId, teamCodes })` - Batch resolver for multiple teams
- `createCachedResolver(worldId)` - Creates cached resolver function for single validation run
- `preResolveTradeEntitlements({ worldId, teams })` - Pre-resolves entitlements for all teams in trade

**Key Features:**

- Read-only (no Firestore writes)
- Emulator + prod safe
- Per-call deduplication (same team won't be resolved twice)
- Error handling with fallback to empty array

---

### 2. Modified: stepienEntitlementUtils.js

**File:** `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js`

**Added Function:** `buildStepienBaselinePicksFromEntitlements(entitlements)`

**Purpose:** Converts team's held entitlements to Stepien baseline year reservations.

**Conservative Policy (unchanged):**

| Entitlement Kind                         | Reserves Year? | Notes                   |
| ---------------------------------------- | -------------- | ----------------------- |
| `pick_ownership` (round 1, non-pooled)   | ✅ Yes         | Team controls a 1st     |
| `swap_right` (round 1, non-pooled)       | ✅ Yes         | Team may receive a 1st  |
| `conveyance_right` (round 1, non-pooled) | ✅ Yes         | Team may receive a 1st  |
| Any pooled entitlement                   | ❌ No          | Team doesn't control it |
| Any round 2 entitlement                  | ❌ No          | Stepien only for 1sts   |

**Output Format:**

```javascript
{
  year: 2027,
  round: 1,
  isSwap: false,
  swapType: undefined,
  _source: 'entitlement_baseline',
  _entitlementId: 'ent-123',
  _kind: 'pick_ownership'
}
```

---

### 3. Modified: useTradeMachine.js

**File:** `src/features/architect/hooks/useTradeMachine.js` (lines 723-742)

**Changes:**

1. Added `validationEntitlements: t.entitlements || []` to each team passed to `validateTrade()`
2. Added `tradeCtx: { worldId, yearKey }` to the validateTrade call

**Before:**

```javascript
const validation = validateTrade({
  teams: patchedTeams
    .filter((t) => t.team)
    .map((t) => ({
      team: t.team,
      sends: t.sends,
      picksOut: t.picksOut,
      hardCapped: t.team.hardCapped,
      entitlementsOut: t.entitlementsOut || [],
    })),
  capProjections,
  currentYear: yearKey,
});
```

**After:**

```javascript
const validation = validateTrade({
  teams: patchedTeams
    .filter((t) => t.team)
    .map((t) => ({
      team: t.team,
      sends: t.sends,
      picksOut: t.picksOut,
      hardCapped: t.team.hardCapped,
      entitlementsOut: t.entitlementsOut || [],
      validationEntitlements: t.entitlements || [], // ← Phase 12.2
    })),
  capProjections,
  currentYear: yearKey,
  tradeCtx: { worldId, yearKey }, // ← Phase 12.2
});
```

**Why entitlements are already resolved:**

- Teams already have `team.entitlements` loaded when team is selected (Phase 11.4)
- No async resolution needed in validator - entitlements pre-resolved at hook level

---

### 4. Modified: validateStepien.js

**File:** `src/features/architect/utils/tradeMachine/rules/validateStepien.js`

**Major Changes:**

#### A. Baseline Source Switch

```javascript
// Phase 12.2: Determine baseline source
const validationEntitlements = team.validationEntitlements || [];
const useEntitlementBaseline = validationEntitlements.length > 0;

if (useEntitlementBaseline) {
  // Build baseline from team's held entitlements
  const baselinePicks = buildStepienBaselinePicksFromEntitlements(validationEntitlements);
  baselineYears = baselinePicks.map(...);
} else {
  // Legacy fallback: Use draftPicksObligations
  const existingObligations = team.draftPicksObligations || [];
  baselineYears = existingObligations.filter(...).map(...);
}
```

#### B. Removed Early Return

**Issue:** Early return on `allStepienRelevant.length === 0` prevented 7-year and second apron checks from running.

**Fix:** Removed early return, allowing all validation checks to run even when no Stepien-relevant consecutive picks exist.

**Impact:** Fixed test failure where `worst_of` swaps (don't reserve years for consecutive check) were incorrectly passing second apron frozen pick restriction.

#### C. Updated Debug Output

**Before:**

```javascript
_debug: {
  tradePicksConsidered: stepienRelevantPicks.length,
  obligationsConsidered: obligationYears.length,
  entitlementsConsidered: entitlementDerivedPicks.length,
  totalStepienRelevant: allStepienRelevant.length,
}
```

**After:**

```javascript
_debug: {
  useEntitlementBaseline,
  baselineYearsCount: baselineYears.length,
  outgoingYearsCount: outgoingYears.length,
  tradePicksConsidered: tradePickYears.length,
  entitlementsConsidered: entitlementDerivedPicks.length,
  totalStepienRelevant: allStepienRelevant.length,
}
```

---

### 5. Created: stepienEntitlementBaseline.test.js

**File:** `tests/validators/stepienEntitlementBaseline.test.js`

**Coverage:** 19 new tests

**Test Groups:**

1. `buildStepienBaselinePicksFromEntitlements` (7 tests)
   - Empty input handling
   - Converts pick_ownership, swap_right, conveyance_right
   - Filters out pooled and round 2 entitlements
   - Includes encumbered (non-pooled) entitlements

2. `validateStepien with entitlement baseline` (12 tests)
   - **Baseline from validationEntitlements** (5 tests)
     - Uses entitlement baseline when available
     - Outgoing entitlement causes consecutive violation
     - Non-consecutive passes
     - Pooled entitlements don't reserve year
     - swap_right in baseline reserves year
   - **Legacy fallback when entitlements unavailable** (3 tests)
   - **Mixed sources** (1 test)
   - **Edge cases** (3 tests)

---

### 6. Modified: stepienEntitlements.test.js

**File:** `tests/validators/stepienEntitlements.test.js`

**Changes:** Updated 2 tests to match new behavior:

1. **Pooled entitlements message** (line 403):
   - Before: Expected `'No picks in trade'` (early return)
   - After: Expected `'Stepien Rule compliant'` (no early return)

2. **Obligation debug field** (line 446):
   - Before: Expected `_debug.obligationsConsidered`
   - After: Expected `_debug.baselineYearsCount` (obligations included in baseline for legacy mode)

---

### 7. Modified: stepienObligations.test.js

**File:** `src/tests/tradeMachine/stepienObligations.test.js`

**Changes:** Updated 1 test debug assertion (line 339):

- Before: Expected `_debug.obligationsConsidered`
- After: Expected `_debug.baselineYearsCount` (obligations included in baseline for legacy mode)

---

## Baseline vs Delta Model Explained

### Entitlement Baseline Mode (New)

When `validationEntitlements` is non-empty:

1. **Baseline** = Years team controls (from held entitlements)
   - Built using `buildStepienBaselinePicksFromEntitlements()`
   - Conservative policy: pick_ownership, swap_right, conveyance_right reserve years
   - Pooled entitlements excluded (team doesn't control them)

2. **Outgoing** = What's leaving in the trade
   - `entitlementsOut` → converted to years via `buildStepienOutgoingPicksFromEntitlements()`
   - `picksOut` → filtered to first-round via `reservesYearForStepien()`

3. **Validation** = Check if outgoing creates consecutive gaps
   - `allStepienRelevant` = outgoing years (what's leaving)
   - Sort and check for consecutive unprotected years
   - Also check 7-year limit and second apron restrictions

### Legacy Baseline Mode (Fallback)

When `validationEntitlements` is empty:

1. **Baseline** = Existing obligations (picks already owed/traded)
   - Built from `draftPicksObligations`
   - Filtered via `obligationReservesYear()`

2. **Outgoing** = Picks being traded in current trade
   - Same as entitlement mode

3. **Validation** = Merge baseline obligations + outgoing picks
   - `allStepienRelevant` = tradePickYears + baselineYears + entitlementDerivedPicks
   - Check for consecutive years across combined set

---

## Test Results

### All Stepien Tests Pass (76 total)

| Test File                                             | Tests | Status  |
| ----------------------------------------------------- | ----- | ------- |
| `tests/validators/stepien.test.js`                    | 14    | ✅ PASS |
| `tests/validators/stepienEntitlements.test.js`        | 28    | ✅ PASS |
| `tests/validators/stepienEntitlementBaseline.test.js` | 19    | ✅ PASS |
| `src/tests/tradeMachine/stepienObligations.test.js`   | 15    | ✅ PASS |

**Total:** 76 tests pass

---

## Build Verification

```bash
npm run build
```

**Result:** ✅ Build passes (7.3s)

**Warnings:** Standard chunking warnings for large files (>500KB) - expected, not a blocker

---

## Known Gaps / Future Work

1. **Lottery Resolution Not Implemented**
   - Entitlements use `seasonYear` directly
   - No lottery/standings resolution to determine actual pick order
   - Conservative policy handles this (best_of swaps reserve year)

2. **Protection Information Not Carried**
   - Entitlements don't have protection data at this level
   - `buildStepienBaselinePicksFromEntitlements()` sets `protection: null`
   - Protection only applies to legacy picks for now

3. **No UI Migration Yet**
   - Trade Machine UI still uses legacy draft picks alongside entitlements
   - Full UI migration is future work (out of scope for Phase 12.2)

4. **Firestore Schema Not Cleaned**
   - Legacy `draftPicksInventory`/`draftPicksObligations` fields remain in Firestore
   - Needed for fallback when entitlements unavailable
   - Schema cleanup is future work

---

## Acceptance Criteria

| AC   | Requirement                                       | Status |
| ---- | ------------------------------------------------- | ------ |
| AC-1 | Stepien baseline uses entitlements when available | ✅     |
| AC-2 | Legacy baseline works as fallback                 | ✅     |
| AC-3 | Outgoing entitlements affect Stepien result       | ✅     |
| AC-4 | Pooled entitlements never reserve year            | ✅     |
| AC-5 | Existing Stepien test suites pass                 | ✅     |
| AC-6 | New baseline tests pass                           | ✅     |
| AC-7 | npm run build passes                              | ✅     |

---

## Validation Commands

```bash
# Run build
npm run build

# Run all Stepien tests
npm run test tests/validators/stepien.test.js -- --run
npm run test tests/validators/stepienEntitlements.test.js -- --run
npm run test tests/validators/stepienEntitlementBaseline.test.js -- --run
npm run test src/tests/tradeMachine/stepienObligations.test.js -- --run
```

---

## Conclusion

Phase 12.2 successfully migrates Stepien validation to use entitlements as the authoritative baseline, eliminating the UI/validator mismatch that caused false Stepien failures when teams traded entitlements. Legacy draft-pick arrays remain as fallback for teams without entitlements loaded.

**Next Steps:** Phase 12.2 is complete. No further action required unless expanding to lottery resolution or removing legacy schema fields.
