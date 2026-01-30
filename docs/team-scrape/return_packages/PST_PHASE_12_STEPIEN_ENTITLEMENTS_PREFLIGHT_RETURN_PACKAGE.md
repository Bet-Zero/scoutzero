# PST_PHASE_12_STEPIEN_ENTITLEMENTS_PREFLIGHT_RETURN_PACKAGE.md

**MODE**: PREFLIGHT (READ-ONLY)  
**DATE**: 2026-01-30  
**PHASE**: 12 — Stepien/Validation Entitlements Migration  
**STATUS**: PREFLIGHT COMPLETE

---

## 1. Current Stepien Implementation Map

### Primary Implementation

| File                                                                 | Function                                       | Lines  | Purpose                                               |
| -------------------------------------------------------------------- | ---------------------------------------------- | ------ | ----------------------------------------------------- |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | `validateStepien(team, tradeCtx)`              | 1-266  | **Primary validator** — Core Stepien rule enforcement |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | `reservesYearForStepien(pick)`                 | 15-24  | Helper: determines if pick reserves year for Stepien  |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | `obligationReservesYear(obligation, teamCode)` | 42-85  | Helper: determines if obligation reserves year        |
| `src/features/architect/utils/stepienUtils.js`                       | `buildFirstRoundCalendar()`                    | 44-70  | Calendar builder for UI display                       |
| `src/features/architect/utils/stepienUtils.js`                       | `passesStepienRule(cal)`                       | 72-84  | Delegating wrapper                                    |
| `src/features/architect/utils/stepienUtils.js`                       | `hasStepienViolation(picks)`                   | 86-110 | Delegating wrapper to validateStepien                 |

### Parallel TypeScript Implementation (DEPRECATED)

| File                                                                 | Function            | Purpose                                                                        |
| -------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.ts` | `validateStepien()` | TypeScript parallel (~120 lines) — uses different approach, reads `team.picks` |

**Recommendation**: The JS version is canonical. The TS version should be removed or aligned in Phase 12.2.

### Input Shape Expected by validateStepien

```javascript
{
  teamId: string,
  teamCode: string,
  team?: {
    draftPicksObligations?: [],
    picks?: []
  },
  context?: { yearKey: number },
  outgoingPicks?: [],      // PRIMARY: picks being traded (tests use this)
  picksOut?: [],           // FALLBACK: alternate field name
  draftPicksObligations?: [], // Existing obligations for Stepien check
  postTradeStatus?: { isAtOrAboveSecondApron: boolean }
}
```

### How It Determines "Owns a Future 1st"

1. Reads `outgoingPicks` (or `picksOut` fallback) for picks in the current trade
2. Filters to first-round picks (`round === '1st' || round === 1`)
3. Applies `reservesYearForStepien(pick)`:
   - Outright picks → ALWAYS reserve the year
   - Swap picks with `swapType !== 'worst_of'` → Reserve year
   - Swap picks with `swapType === 'worst_of'` → Do NOT reserve year
   - Missing `swapType` defaults to `'best_of'` (backward compat)
4. Reads `draftPicksObligations` for existing commitments
5. Applies `obligationReservesYear(obligation, teamCode)` to filter obligations
6. Merges trade picks + obligations into `allStepienRelevant[]`
7. Checks for consecutive unprotected years using `isMeaningfulProtection()`

### How It Handles Swaps/Conditionals

- **Swap best_of**: Reserves year (conservative — team may get a 1st)
- **Swap worst_of**: Does NOT reserve year (team guaranteed to keep their pick)
- **Conditional obligations**: Reserved if `tradeable === false` or `stepienEligible === false`
- **Protected picks**: Bypassed via `isMeaningfulProtection()` check

---

## 2. Current Picks Source-of-Truth Map

### Property Names Used by Validation

| Context              | Property                | Description                       | Location                       |
| -------------------- | ----------------------- | --------------------------------- | ------------------------------ |
| Trade UI → Validator | `picksOut`              | Selected picks from trade UI      | `useTradeMachine.js` line 728  |
| validateStepien      | `outgoingPicks`         | Primary (tests use this)          | `validateStepien.js` line 106  |
| validateStepien      | `picksOut`              | Fallback                          | `validateStepien.js` line 106  |
| Existing obligations | `draftPicksObligations` | Pre-trade obligations for Stepien | `validateStepien.js` line 118  |
| Team data (loaded)   | `team.picks`            | Available picks for selection     | `useTradeMachine.js`           |
| Team data (schema)   | `draftPicksInventory`   | Canonical picks owned             | `architect.ts` line 263        |
| Team data (schema)   | `draftPicksObligations` | Picks owed/traded away            | `architect.ts` line 265        |
| Entitlements         | `entitlementsOut`       | Selected entitlements for trading | `useTradeMachine.js` line 496+ |

### Data Flow: UI → Validator

```
useTradeMachine.js:
  ├─► Loads team via loadWorldTeamData(worldId, primaryTeam)
  │     └─► Data has: draftAssets.picks || draftPicks || picks
  │
  ├─► Resolves entitlements: resolveEntitlementsForTeam(worldId, teamCode)
  │     └─► Stored as: teamObj.entitlements
  │
  ├─► Trade selection stored as:
  │     └─► teams[index].picksOut (legacy picks)
  │     └─► teams[index].entitlementsOut (entitlements)
  │
  └─► validateTrade() call (line 723):
        └─► Passes: { team, sends, picksOut, hardCapped }
        └─► ❌ DOES NOT PASS: entitlementsOut, worldId

tradeValidator.js (line 374):
  └─► validateTrade({ teams, capProjections, currentYear, tradeCtx })
        │
        └─► For each team:
              └─► validateStepien(team, context)
                    └─► Uses: team.outgoingPicks || team.picksOut
                    └─► Uses: team.draftPicksObligations || team.team?.draftPicksObligations
                    └─► ❌ DOES NOT USE: entitlements
```

---

## 3. Where Entitlements Exist in the Validation Flow

### Current Entitlement Loading

| Location                       | Status         | Notes                                                                        |
| ------------------------------ | -------------- | ---------------------------------------------------------------------------- |
| `useTradeMachine.js` line 264  | ✅ Loaded      | `teamObj.entitlements = await resolveEntitlementsForTeam(worldId, teamCode)` |
| `useTradeMachine.js` line 314  | ✅ Tracked     | `entitlementsOut: []` initialized for each team slot                         |
| `useTradeMachine.js` line 496+ | ✅ Updated     | `toggleEntitlement()` adds/removes from `entitlementsOut`                    |
| `validateTrade()` call         | ❌ NOT PASSED  | `entitlementsOut` is not included in teams array                             |
| `validateTrade()` context      | ❌ NOT PASSED  | `worldId` is not in tradeCtx                                                 |
| `validateStepien()`            | ❌ NOT CHECKED | Only uses `outgoingPicks`/`picksOut`                                         |

### What's Available vs What's Missing

**Available in useTradeMachine:**

- `team.entitlements` — resolved entitlement objects (full schema)
- `teams[i].entitlementsOut` — selected entitlements for trading

**Missing in validateTrade:**

- `entitlementsOut` is not passed to `validateTrade()`
- `worldId` is not passed to `tradeCtx`

**Missing in validateStepien:**

- No entitlement awareness at all
- Only reads legacy pick arrays

---

## 4. Minimum Data Contract Change Needed

### Phase 12.1 Data Contract

**Recommended: Pass entitlementsOut alongside picksOut**

```javascript
// Updated validateTrade call in useTradeMachine.js:
const validation = validateTrade({
  teams: patchedTeams
    .filter((t) => t.team)
    .map((t) => ({
      team: t.team,
      sends: t.sends,
      picksOut: t.picksOut,
      entitlementsOut: t.entitlementsOut || [], // ← ADD
      hardCapped: t.team.hardCapped,
    })),
  capProjections,
  currentYear: yearKey,
});
```

### New Helper Function Needed

```javascript
/**
 * Converts entitlements to a Stepien-relevant pick inventory.
 */
function buildStepienInventoryFromEntitlements(entitlements) {
  if (!Array.isArray(entitlements) || entitlements.length === 0) {
    return [];
  }

  return entitlements
    .filter((ent) => {
      if (
        !['pick_ownership', 'conveyance_right', 'swap_right'].includes(ent.kind)
      ) {
        return false;
      }
      if (ent.round !== 1) {
        return false;
      }
      if (ent.underlyingStatus === 'pooled') {
        return false;
      }
      return true;
    })
    .map((ent) => ({
      year: ent.seasonYear,
      round: 1,
      protection: null,
      isSwap: ent.kind === 'swap_right',
      swapType: ent.kind === 'swap_right' ? 'best_of' : undefined,
      _source: 'entitlement',
      _entitlementId: ent.id,
      _kind: ent.kind,
    }));
}
```

---

## 5. Recommended Policy for Conditional Entitlements

### Recommended Policy: Conservative

| Kind                                | Reserves Year? | Rationale               |
| ----------------------------------- | -------------- | ----------------------- |
| `pick_ownership` (clean/encumbered) | ✅ Yes         | Team controls a 1st     |
| `pick_ownership` (pooled)           | ❌ No          | Team doesn't control it |
| `swap_right`                        | ✅ Yes         | Team may receive a 1st  |
| `conveyance_right`                  | ✅ Yes         | Team may receive a 1st  |

**Rationale:** The Stepien Rule exists to ensure teams always have a first-round pick in at least alternating years. A `swap_right` or `conveyance_right` represents an obligation that _could_ result in the team receiving a first-round pick. The conservative approach treats these as reserving the year because if the conditional resolves favorably, the team would then be in violation. This matches the existing `reservesYearForStepien()` logic where `best_of` swaps reserve the year.

---

## 6. Execution Plan (Phase 12.1)

### P0 Files to Modify

| File                                                                 | Change                                       |
| -------------------------------------------------------------------- | -------------------------------------------- |
| `src/features/architect/hooks/useTradeMachine.js`                    | Pass `entitlementsOut` to `validateTrade()`  |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Accept `entitlementsOut` and pass to Stepien |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | Add entitlement-aware Stepien logic          |

### P1 Files to Create

| File                                                                         | Purpose                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js` | Helper: `buildStepienInventoryFromEntitlements()` |
| `tests/validators/stepienEntitlements.test.js`                               | New test file for entitlement-based Stepien       |

### Acceptance Criteria

1. ✅ `validateTrade()` receives `entitlementsOut` from `useTradeMachine.js`
2. ✅ `validateStepien()` builds Stepien inventory from `entitlementsOut` when present
3. ✅ Legacy `picksOut`/`draftPicksObligations` path still works (backward compat)
4. ✅ Conservative policy: `swap_right` and `conveyance_right` reserve years
5. ✅ `underlyingStatus === 'pooled'` entitlements do NOT reserve years
6. ✅ All existing Stepien tests pass (no regression)
7. ✅ New entitlement-based tests pass

### Validation Steps

1. Run existing tests: `npm run test tests/validators/stepien.test.js -- --run`
2. Run obligations tests: `npm run test src/tests/tradeMachine/stepienObligations.test.js -- --run`
3. Run new entitlement tests: `npm run test tests/validators/stepienEntitlements.test.js -- --run`
4. Build passes: `npm run build`

### Stop Conditions

- ❌ STOP if entitlement schema changes are required
- ❌ STOP if `underlyingStatus` is missing from entitlements
- ❌ STOP if existing tests fail after changes
- ❌ STOP if `worldId` is required for validation

---

## 7. Test Surface Analysis

### Existing Tests

| File                                                | Tests     | Coverage                                                             |
| --------------------------------------------------- | --------- | -------------------------------------------------------------------- |
| `tests/validators/stepien.test.js`                  | 208 lines | Consecutive picks, 7-year limit, second apron, swap year reservation |
| `src/tests/tradeMachine/stepienObligations.test.js` | 344 lines | Obligations wiring, obligation+trade combinations                    |

### Proposed New Tests

- 2-team trade with consecutive entitlements → FAIL
- 3-team trade validation
- Entitlement + obligation consecutive → FAIL
- Non-consecutive entitlements → PASS
- Pooled entitlements don't reserve year → PASS
- swap_right reserves year (conservative) → FAIL
- conveyance_right reserves year (conservative) → FAIL

---

## 8. Summary

### Gaps Identified

1. **`entitlementsOut` not passed to validation** — Critical gap, easy fix
2. **`validateStepien` has no entitlement awareness** — Core migration work
3. **Dual JS/TS implementations** — Technical debt, cleanup in Phase 12.2

### Minimum Viable Changes (Phase 12.1)

1. Add `entitlementsOut` to `validateTrade()` call in `useTradeMachine.js`
2. Create `buildStepienInventoryFromEntitlements()` helper
3. Update `validateStepien()` to merge entitlement inventory with legacy picks
4. Add new test file for entitlement Stepien scenarios
