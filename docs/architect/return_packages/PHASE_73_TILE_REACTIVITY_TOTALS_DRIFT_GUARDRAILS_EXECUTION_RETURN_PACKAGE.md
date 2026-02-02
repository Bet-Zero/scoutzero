# Phase 73 Return Package — Tile Reactivity Hardening + Totals Drift Guardrails

**Date:** 2026-02-01  
**Status:** ✅ COMPLETE  
**Predecessor:** Phase 72 (SSOT Cap Totals Unification)

---

## Executive Summary

Phase 73 hardened the highest-risk staleness surface (CapImpactTiles.jsx) by adding proper memoization, wired drift detection using the canonical `warnOnTotalsDivergence` helper, and added rate-limiting to prevent console spam during development.

---

## Changes Made

### 1. computeTeamCapTotals.js — Rate-Limited Divergence Warnings

**File:** `src/features/architect/utils/capTotals/computeTeamCapTotals.js`

- Added module-level `warnedKeys = new Set()` for tracking warned keys
- Modified `warnOnTotalsDivergence()` to only warn once per unique `componentName:fieldName` key
- Added exported `resetWarnedKeys()` function for test cleanup

**Key Code:**

```javascript
const warnedKeys = new Set();

export function warnOnTotalsDivergence(componentName, fieldName, displayedValue, canonicalValue, tolerance = 1) {
  if (import.meta.env.DEV) {
    const diff = Math.abs(displayedValue - canonicalValue);
    if (diff > tolerance) {
      const warnKey = `${componentName}:${fieldName}`;
      if (!warnedKeys.has(warnKey)) {
        warnedKeys.add(warnKey);
        console.warn(...);
      }
    }
  }
}

export function resetWarnedKeys() {
  warnedKeys.clear();
}
```

### 2. capTotals/index.js — Export resetWarnedKeys

**File:** `src/features/architect/utils/capTotals/index.js`

- Added `resetWarnedKeys` to barrel exports

### 3. CapImpactTiles.jsx — Memoization Added

**File:** `src/features/architect/tradeMachine/CapImpactTiles.jsx`

- Added `useMemo` import from React
- **baselineTotals**: Memoized with deps `[team, yearKey]`
- **hardCapStatus**: Memoized with deps `[team, yearKey]`
- **salaryIn/salaryOut**: Memoized with deps `[sends, incomingPlayers, yearKey]`

**Key Changes:**

```jsx
const baselineTotals = useMemo(
  () => computeTeamCapTotals(team, yearKey),
  [team, yearKey]
);

const hardCapStatus = useMemo(
  () => ({
    isFirstApronHardCapped: isHardCappedAtFirstApron(team, yearKey),
    isSecondApronHardCapped: isHardCappedAtSecondApron(team),
    firstApronReason: isHardCappedAtFirstApron(team, yearKey)
      ? getFirstApronHardCapReason(team)
      : '',
  }),
  [team, yearKey]
);

const { salaryOut, salaryIn } = useMemo(
  () => ({
    salaryOut: getSalaryForYear(sends, yearKey),
    salaryIn: getSalaryForYear(incomingPlayers, yearKey),
  }),
  [sends, incomingPlayers, yearKey]
);
```

### 4. TradeTeamCard.jsx — Canonical Drift Detection

**File:** `src/features/architect/tradeMachine/TradeTeamCard.jsx`

- Replaced DIY divergence check (lines 176-188) with canonical `warnOnTotalsDivergence` calls
- Now warns for both `outgoingSalary` and `incomingSalary` fields
- Uses rate-limited helper to prevent console spam

**Key Changes:**

```jsx
// DEV-ONLY: Divergence checks using canonical helper (Phase 1.8, Phase 73)
if (hasValidatorResult) {
  warnOnTotalsDivergence(
    'TradeTeamCard',
    'outgoingSalary',
    localOutgoingSalary,
    snapshot.outgoingMatchingSalary,
    1
  );
  warnOnTotalsDivergence(
    'TradeTeamCard',
    'incomingSalary',
    localIncomingSalary,
    snapshot.incomingMatchingSalary,
    1
  );
}
```

---

## New Files Created

### Guardrail Test File

**File:** `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js`

**Tests (18 total):**

| Category                            | Test                                          | Status |
| ----------------------------------- | --------------------------------------------- | ------ |
| Source scan: CapImpactTiles         | uses useMemo                                  | ✅     |
| Source scan: CapImpactTiles         | imports useMemo from React                    | ✅     |
| Source scan: CapImpactTiles         | imports computeTeamCapTotals                  | ✅     |
| Source scan: CapImpactTiles         | memoizes baselineTotals with correct deps     | ✅     |
| Source scan: CapImpactTiles         | memoizes hardCapStatus                        | ✅     |
| Source scan: CapImpactTiles         | memoizes salaryIn/salaryOut                   | ✅     |
| Source scan: warnOnTotalsDivergence | contains DEV gate                             | ✅     |
| Source scan: warnOnTotalsDivergence | contains rate-limit mechanism                 | ✅     |
| Source scan: warnOnTotalsDivergence | exports resetWarnedKeys                       | ✅     |
| Source scan: TradeTeamCard          | imports warnOnTotalsDivergence                | ✅     |
| Source scan: TradeTeamCard          | calls for outgoingSalary                      | ✅     |
| Source scan: TradeTeamCard          | calls for incomingSalary                      | ✅     |
| Behavioral                          | does NOT warn when values match               | ✅     |
| Behavioral                          | does NOT warn within tolerance                | ✅     |
| Behavioral                          | DOES warn beyond tolerance                    | ✅     |
| Behavioral                          | only warns once per key (rate limiting)       | ✅     |
| Behavioral                          | resetWarnedKeys allows same key to warn again | ✅     |
| Behavioral                          | respects custom tolerance values              | ✅     |

---

## Verification Results

### Phase 73 Tests

```
✓ src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js (18)
Test Files  1 passed (1)

Tests  18 passed (18)
```

### Full Architect Test Suite

```

Test Files  41 passed (41)
Tests  597 passed (597)
```

### Build

```
✓ built in 41.32s
```

---

## Verification Checklist

- [x] CapImpactTiles.jsx uses useMemo for baselineTotals
- [x] CapImpactTiles.jsx uses useMemo for hardCapStatus
- [x] CapImpactTiles.jsx uses useMemo for salaryIn/Out
- [x] warnOnTotalsDivergence has rate-limiting (warnedKeys Set)
- [x] resetWarnedKeys exported for test cleanup
- [x] TradeTeamCard.jsx calls warnOnTotalsDivergence for outgoingSalary
- [x] TradeTeamCard.jsx calls warnOnTotalsDivergence for incomingSalary
- [x] Phase 73 guardrail tests pass (18/18)
- [x] Full architect test suite passes (597/597)
- [x] Build succeeds

---

## Risk Mitigation Summary

| Condition                                | Status       | Mitigation                                           |
| ---------------------------------------- | ------------ | ---------------------------------------------------- |
| STOP1: useMemo deps unstable             | ✅ LOW RISK  | team and yearKey are stable props; arrays memoized   |
| STOP2: Noisy warnings in tests           | ✅ MITIGATED | Rate-limiting via warnedKeys Set + resetWarnedKeys() |
| STOP3: Stale display from incorrect deps | ✅ LOW RISK  | All deps are direct prop dependencies                |

---

## Files Modified

| File                                                             | Change                                   |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.js` | Rate-limiting + resetWarnedKeys export   |
| `src/features/architect/utils/capTotals/index.js`                | Added resetWarnedKeys export             |
| `src/features/architect/tradeMachine/CapImpactTiles.jsx`         | Added 3 useMemo hooks                    |
| `src/features/architect/tradeMachine/TradeTeamCard.jsx`          | Replaced DIY check with canonical helper |

## Files Created

| File                                                                                                          | Purpose             |
| ------------------------------------------------------------------------------------------------------------- | ------------------- |
| `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js`                             | Guardrail tests     |
| `docs/architect/return_packages/PHASE_73_TILE_REACTIVITY_TOTALS_DRIFT_GUARDRAILS_EXECUTION_RETURN_PACKAGE.md` | This return package |

---

## Next Steps

Phase 73 completes the tile reactivity hardening initiative. Potential follow-ups:

1. **Monitor DEV warnings** - If divergence warnings appear in console during development, they indicate surfaces computing totals independently
2. **Extend memoization** - Consider similar memoization patterns for other expensive computations
3. **Performance profiling** - Validate that memoization reduces re-renders in React DevTools
