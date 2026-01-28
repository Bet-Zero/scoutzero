# Phase 19 Return Package: Cap Hold / Cap Space Enforcement

**Date:** 2026-01-20  
**Phase:** Cap Sheet Contract Rules Phase 19  
**Master Doc:** [CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md)

---

## Summary of Changes

Phase 19 adds **cap hold / cap-space signing enforcement** to prevent illegal cap-space signings that would exceed the salary cap when all cap holds are included.

### Implemented

| Rule ID | Type | Trigger | Description |
|---------|------|---------|-------------|
| `cap_hold_signing_violation` | HARD_BLOCK | Cap-space signing would exceed salary cap with holds | Blocks signings without exception or Bird rights that exceed cap when cap holds are counted |
| `cap_hold_renounce_required` | WARNING | Specific holds block signing | Informs which cap holds to renounce to fit signing under cap |

### Deferred (Stop Condition)

| Rule ID | Reason |
|---------|--------|
| `stretch_timing_invalid` | No canonical "world date" or "season phase" concept exists in the cap sheet validation system. `validateWaive()` lacks timing context. Trade machine uses `asOfDate` but it's not wired to waive validation. |

---

## Key Implementation Details

### Cap-Space Signing Detection

```javascript
export function isCapSpaceSigning(mechanism, rightsType) {
  // Exception signings are NOT cap-space signings
  if (mechanism && mechanism !== 'UNKNOWN') return false;
  
  // Bird rights signings are NOT cap-space signings
  if (rightsType && ['FULL_BIRD', 'EARLY_BIRD', 'NON_BIRD'].includes(rightsType)) return false;
  
  return true;
}
```

### Cap Hold Replacement Logic

When a player with an existing cap hold is re-signed:

1. Find the player's existing cap hold via `team.capHolds.find(h => h.playerId === playerId)`
2. Subtract that cap hold amount from current allocations
3. Add the new contract's cap hit
4. If result exceeds cap → hard-block

### Integration with SSOT

Uses `computeTeamCapTotals()` which includes `capHoldsTotal` in `totalCapAllocations`:

```javascript
const totalCapAllocations = playersTotal + deadMoneyTotal + capHoldsTotal + incompleteChargesTotal;
```

---

## Files Changed

| File | Change |
|------|--------|
| [capLegalityValidation.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capLegalityValidation.js) | Added import for `computeTeamCapTotals`, `cap_hold_signing_violation` to HARD_BLOCK_RULES, `isCapSpaceSigning()` helper, cap-space validation logic |
| [capLegalityValidation.test.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/tests/architect/capLegalityValidation.test.js) | Created with 22 tests covering all cap hold/cap-space scenarios |
| [CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md) | Added Phase 19 changelog, rule to hard block list |

---

## Test Results

```
✓ src/tests/architect/capLegalityValidation.test.js (22)
  ✓ isCapSpaceSigning helper (9)
  ✓ cap_hold_signing_violation in HARD_BLOCK_RULES (1)
  ✓ C1: Cap-space signing fits under cap with holds included (1)
  ✓ C2: Cap-space signing exceeds cap with holds included (1)
  ✓ C3: Re-signing replaces player cap hold; fits (1)
  ✓ C4: Re-signing replaces player cap hold; still exceeds (1)
  ✓ C5: Signing using exception is NOT subject to rule (2)
  ✓ C6: Signing using Bird rights is NOT subject to rule (1)
  ✓ C7: Cap-space signing exactly at cap → blocked (1)
  ✓ C8: Multiple cap holds present, signing fits (1)
  ✓ C9: Warning when renouncing holds would fit (1)
  ✓ C10: Team below cap with no holds → allowed (1)
  ✓ Two-way contracts excluded (1)

Tests: 22 passed
```

---

## Build Verification

```
✓ 2930 modules transformed
✓ built in 25.96s
Exit code: 0
```

---

## Stop Condition Documentation

**Stretch Timing Legality (`stretch_timing_invalid`):**

After extensive codebase research, no canonical "world date" or "season phase" concept exists in the Architect cap sheet validation system:

- Trade machine uses `asOfDate` in `tradeCtx`, but not wired to `validateWaive()`
- `TRADE_TIMING` constants define season boundaries (October 16 = regular season start)
- `validateWaive()` receives `{ team, player, stretch, year, isGracePeriod }` but no date parameter
- No world overlay has `currentDate` or `seasonPhase` field

**Recommendation for Future Phase:**
Add `asOfDate?: string (ISO)` parameter to `validateWaive()`, falling back to current date if not provided, to enable stretch timing enforcement.

---

## Phase 19 Checklist Complete

- [x] Added `cap_hold_signing_violation` to HARD_BLOCK_RULES
- [x] Added `isCapSpaceSigning()` helper function
- [x] Added cap-space signing validation in `validateSigning()`
- [x] Added cap hold replacement logic for re-signings
- [x] Added `cap_hold_renounce_required` warning
- [x] Created test file with 22 tests
- [x] All tests pass (22/22)
- [x] Build succeeds
- [x] Updated Master Doc changelog
- [x] Documented stretch timing stop condition
