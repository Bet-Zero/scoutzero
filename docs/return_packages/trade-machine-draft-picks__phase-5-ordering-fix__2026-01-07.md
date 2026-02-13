# Trade Machine Draft Picks — Phase 5 ORDERING FIX Return Package

> **Date**: 2026-01-07  
> **Mode**: EXECUTION (small runtime fix)  
> **Status**: COMPLETE

---

## 1) Summary of the Bug and Fix

### Bug Description

In `seasonManager.js`, the Phase 5 auto-resolution logic was passing `updatedTeam` (the pre-conveyance state) to `resolveDraftPickSwapsForYear()` instead of `afterConveyance` (the post-conveyance state). This meant swaps could resolve using stale `draftPicks` that didn't reflect rolled/converted picks from conveyance resolution.

### Why This Matters

1. If a protected pick rolled forward during conveyance, swaps wouldn't see that change
2. The order of operations (conveyance → swaps) was documented correctly, but the variable chain was broken
3. This could cause incorrect swap resolution outcomes in edge cases

### The Fix

Changed the input to `resolveDraftPickSwapsForYear()` from `updatedTeam` to `afterConveyance`, ensuring swaps see the post-conveyance team state.

---

## 2) Before/After Code Excerpts

### BEFORE (Bug)

```javascript
// seasonManager.js lines 650-656

    // 2) Resolve swaps (best_of / worst_of resolution)
    const afterSwaps = resolveDraftPickSwapsForYear(
      updatedTeam,        // ❌ BUG: Uses pre-conveyance state
      draftYear,
      positionsMap,
      resolutionOpts
    );
```

### AFTER (Fix)

```javascript
// seasonManager.js lines 650-658

    // 2) Resolve swaps (best_of / worst_of resolution)
    // IMPORTANT: Pass afterConveyance (not updatedTeam) so swaps see post-conveyance state
    const afterSwaps = resolveDraftPickSwapsForYear(
      afterConveyance,    // ✅ FIXED: Uses post-conveyance state
      draftYear,
      positionsMap,
      resolutionOpts
    );
```

---

## 3) Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/utils/seasonManager.js` | Modified | Changed swap resolution input from `updatedTeam` to `afterConveyance` |
| `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md` | Modified | Updated T3 section to show correct variable chain |
| `docs/return-packages/trade-machine-draft-picks__phase-5-ordering-fix__2026-01-07.md` | Created | This return package |

---

## 4) Test Commands + Outputs

### Phase 5 Tests

```bash
npm run test -- src/tests/tradeMachine/phase5DraftPositions.test.js --run

 ✓ src/tests/tradeMachine/phase5DraftPositions.test.js  (32 tests) 12ms

 Test Files  1 passed (1)
      Tests  32 passed (32)
```

### Full Trade Machine Test Suite

```bash
npm run test -- src/tests/tradeMachine/ --run

 ✓ src/tests/tradeMachine/swapResolution.test.js  (34 tests | 4 skipped) 35ms
 ✓ src/tests/tradeMachine/conveyancePreflight.test.js  (38 tests) 39ms
 ✓ src/tests/tradeMachine/phase5DraftPositions.test.js  (32 tests) 14ms
 ✓ src/tests/tradeMachine/pickIdUtils.test.js  (34 tests) 20ms
 ✓ src/tests/tradeMachine/seasonSwapResolution.test.js  (13 tests) 11ms
 ✓ src/tests/tradeMachine/draftPicksPreflight.test.js  (23 tests) 9ms

 Test Files  6 passed (6)
      Tests  170 passed | 1 skipped | 3 todo (174)
```

---

## 5) NO-OP Preservation Confirmation

The fix **does not change** NO-OP behavior. The NO-OP guard clause remains at the start of the Phase 5 block:

```javascript
// seasonManager.js line 612
if (positionsMap && draftYear && Object.keys(positionsMap).length > 0) {
```

When `positionsMap` is null, undefined, or empty:

- The entire Phase 5 resolution block is skipped
- Neither conveyance nor swap resolution runs
- Team state is unchanged

Tests confirming NO-OP behavior:

- `resolveDraftPickSwapsForYear NO-OP` (3 tests)
- `resolveDraftPickConveyanceForYear NO-OP` (3 tests)

---

## 6) Doc Edits Made

### Master Doc (`TRADE_MACHINE_DRAFT_PICKS_MASTER.md`)

Updated the **T3) RUNTIME WIRING** section to include the correct variable chain:

```markdown
**Variable Chain (Critical):**
```javascript
// 1) Conveyance first — input is updatedTeam
const afterConveyance = resolveDraftPickConveyanceForYear(updatedTeam, draftYear, positionsMap, opts);
// 2) Swaps second — input is afterConveyance (NOT updatedTeam)
const afterSwaps = resolveDraftPickSwapsForYear(afterConveyance, draftYear, positionsMap, opts);
```

This ensures swaps see rolled/conveyed picks from the conveyance step.

```

---

## 7) Git Status Summary

Files modified:
- `src/features/architect/utils/seasonManager.js`
- `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md`

Files created:
- `docs/return-packages/trade-machine-draft-picks__phase-5-ordering-fix__2026-01-07.md`

---

## Acceptance Criteria Verification

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Swaps resolved using post-conveyance team object | ✅ `afterConveyance` passed to swap resolution |
| 2 | NO-OP behavior preserved when positionsMap missing/empty | ✅ Guard clause unchanged, tests pass |
| 3 | Tests pass (phase5DraftPositions + tradeMachine suite) | ✅ 32/32 + 170/174 |
| 4 | Docs updated to reflect actual order and variables | ✅ Master Doc T3 section updated |
| 5 | Only intended files changed | ✅ 2 modified + 1 created |
