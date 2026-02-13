# RETURN PACKAGE: Trade Machine Stepien Obligations Wiring — EXECUTION

**Date:** 2026-01-08  
**Mode:** EXECUTION (Runtime code changes + tests + doc updates)  
**Scope:** Present-day Trade Machine validation ONLY (NOT worlds/seasons/season advance)  
**Status:** ✅ COMPLETE

---

## Executive Summary

This execution wires the newly-added pipeline pick ledger fields (`draftPicksObligations`) into present-day Trade Machine Stepien enforcement so it accounts for existing obligations (previously traded picks), not just picks being traded in the current transaction.

**Root Cause Fixed:** Previously, Stepien validation only checked `picksOut`/`outgoingPicks` from the current trade. A team with an existing obligation in year N could illegally trade their year N+1 pick without triggering a violation. Now, existing obligations are merged with current trade picks before the consecutive-year check.

---

## What Changed

### 1. Schema Updated (architect.ts)

Added three new optional fields to `BaseTeamDocZ` for the draft pick ledger views:

```typescript
// Draft pick ledger views (from pipeline - see PIPELINE_DRAFT_PICKS_LEDGER__EXECUTION__2026-01-08.md)
// draftPicksInventory: Picks the team currently owns (same as draftPicks for backward compat)
draftPicksInventory: z.array(DraftPickZ).optional().default([]),
// draftPicksObligations: Picks the team owes / has traded away (used for Stepien validation)
draftPicksObligations: z.array(DraftPickZ).optional().default([]),
// draftPicksContested: Swaps and conditional picks involving the team
draftPicksContested: z.array(DraftPickZ).optional().default([]),
```

### 2. Loader Updated (firebaseTeamPlanHelpers.js)

`hydrateBaseTeam()` now returns the new ledger fields with safe fallbacks:

```javascript
// Draft pick ledger views (from pipeline - see PIPELINE_DRAFT_PICKS_LEDGER__EXECUTION__2026-01-08.md)
// draftPicksInventory: Picks the team currently owns
draftPicksInventory: baseDoc.draftPicksInventory || baseDoc.draftPicks || [],
// draftPicksObligations: Picks the team owes / has traded away (used for Stepien validation)
draftPicksObligations: baseDoc.draftPicksObligations || [],
// draftPicksContested: Swaps and conditional picks involving the team
draftPicksContested: baseDoc.draftPicksContested || [],
```

### 3. Stepien Validation Updated (validateStepien.js)

**Core Fix:** Added `obligationReservesYear()` helper and merged obligations with trade picks.

#### Before (validateStepien.js excerpt)

```javascript
export function validateStepien(team, tradeCtx = {}) {
  const { picksOut = [], outgoingPicks = [] } = team;
  const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;
  
  // Only checked current trade picks
  const stepienRelevantPicks = firstRoundPicks.filter(pick => reservesYearForStepien(pick));
  // ... consecutive year check on stepienRelevantPicks only
}
```

#### After (validateStepien.js excerpt)

```javascript
export function validateStepien(team, tradeCtx = {}) {
  const { picksOut = [], outgoingPicks = [] } = team;
  const picks = outgoingPicks.length > 0 ? outgoingPicks : picksOut;
  
  // Get existing obligations from the team
  const existingObligations = team.draftPicksObligations || team.team?.draftPicksObligations || [];
  
  // Filter obligations to first-round picks that reserve years
  const obligationYears = existingObligations
    .filter(ob => obligationReservesYear(ob, teamCode))
    .map(ob => ({ year: ob.year, protection: ob.protection, _source: 'obligation' }));
  
  // Merge current trade picks with existing obligations
  const allStepienRelevant = [...stepienRelevantPicks, ...obligationYears];
  
  // ... consecutive year check on merged set
}
```

### 4. New Helper Function: `obligationReservesYear()`

Determines if an existing obligation should reserve a year for Stepien:

```javascript
function obligationReservesYear(obligation, teamCode) {
  // Only first-round picks matter
  if (!isFirstRound) return false;
  
  // Swap worst_of does NOT reserve year
  if (obligation.isSwap && obligation.swapType === 'worst_of') return false;
  if (obligation.isSwap) return true; // best_of or default reserves
  
  // Non-swap: reserve if team doesn't freely control the pick
  return isOutgoingStatus || notCurrentOwner || notTradeable || notStepienEligible;
}
```

---

## Files Changed/Added

| File | Action | Description |
|------|--------|-------------|
| `src/schemas/architect.ts` | Modified | Added `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` fields to `BaseTeamDocZ` |
| `src/features/architect/utils/firebaseTeamPlanHelpers.js` | Modified | `hydrateBaseTeam()` returns new ledger fields with safe defaults |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js` | Modified | Added `obligationReservesYear()` helper, merged obligations into Stepien check |
| `src/tests/tradeMachine/stepienObligations.test.js` | **Created** | 15 tests covering obligation-based Stepien validation |
| `docs/tradeMachine/TRADE_MACHINE_DRAFT_PICKS_MASTER.md` | Modified | Added "Present-Day Stepien Obligations Wiring" section |
| `docs/return-packages/TRADE_MACHINE_STEPIEN_OBLIGATIONS_WIRING__EXECUTION__2026-01-08.md` | **Created** | This document |

---

## Before/After Key Excerpts

### architect.ts (Schema Additions)

**Before:**

```typescript
export const BaseTeamDocZ = z.object({
  // ... other fields ...
  draftPicks: z.array(DraftPickZ).optional().default([]),
  // ... other fields ...
});
```

**After:**

```typescript
export const BaseTeamDocZ = z.object({
  // ... other fields ...
  draftPicks: z.array(DraftPickZ).optional().default([]),
  // Draft pick ledger views (from pipeline)
  draftPicksInventory: z.array(DraftPickZ).optional().default([]),
  draftPicksObligations: z.array(DraftPickZ).optional().default([]),
  draftPicksContested: z.array(DraftPickZ).optional().default([]),
  // ... other fields ...
});
```

### firebaseTeamPlanHelpers.js (Loader)

**Before:**

```javascript
return {
  // ... other fields ...
  draftPicks: baseDoc.draftPicks || [],
  // ... other fields ...
};
```

**After:**

```javascript
return {
  // ... other fields ...
  draftPicks: baseDoc.draftPicks || [],
  draftPicksInventory: baseDoc.draftPicksInventory || baseDoc.draftPicks || [],
  draftPicksObligations: baseDoc.draftPicksObligations || [],
  draftPicksContested: baseDoc.draftPicksContested || [],
  // ... other fields ...
};
```

### validateStepien.js (Merged-Year Logic)

**Before:**

```javascript
// Build Stepien-relevant calendar (only picks that reserve years)
const stepienRelevantPicks = firstRoundPicks.filter(pick => reservesYearForStepien(pick));

if (stepienRelevantPicks.length >= 2) {
  // Sort picks by year and check consecutive
}
```

**After:**

```javascript
// Get existing obligations
const existingObligations = team.draftPicksObligations || team.team?.draftPicksObligations || [];

// Filter obligations to first-round picks that reserve years
const obligationYears = existingObligations
  .filter(ob => obligationReservesYear(ob, teamCode))
  .map(ob => ({ year: ob.year, protection: ob.protection, _source: 'obligation' }));

// Build Stepien-relevant calendar from current trade
const stepienRelevantPicks = firstRoundPicks
  .filter(pick => reservesYearForStepien(pick))
  .map(pick => ({ year: pick.year, protection: pick.protection, _source: 'trade' }));

// Merge current trade picks with existing obligations (THE CORE FIX)
const allStepienRelevant = [...stepienRelevantPicks, ...obligationYears];

if (allStepienRelevant.length >= 2) {
  // Sort and check consecutive on merged set
}
```

---

## New Stepien Rule Summary (Plain English)

### Data Contract

| Field | Source | Purpose |
|-------|--------|---------|
| `picksOut` / `outgoingPicks` | Current trade | Picks being traded in this transaction |
| `draftPicksObligations` | Team ledger (from pipeline) | Existing obligations (previously traded picks) |

### Algorithm

1. **Extract current trade picks**: Filter `picksOut`/`outgoingPicks` to first-round picks that reserve years
2. **Extract obligations**: Filter `draftPicksObligations` to first-round obligations that reserve years
3. **Merge**: Combine both sets into `allStepienRelevant`
4. **Check consecutive**: Sort by year, scan for consecutive unprotected years
5. **Violation**: If two adjacent years are both unprotected → "Violates Stepien Rule (consecutive future 1sts)."

### Obligation Year Reservation Rules

An obligation reserves a year for Stepien if:

- `round === 1` (first round)
- AND one of:
  - `status` in `['outgoing', 'conditional']`
  - `currentOwner !== originalTeam`
  - `tradeable === false`
  - `stepienEligible === false`
  - `isSwap === true` with `swapType !== 'worst_of'`

### Swap Handling

- `swapType === 'worst_of'` → does NOT reserve year (team gets worse pick)
- `swapType === 'best_of'` or missing → DOES reserve year (team might lose pick)

### Meaningful Protection Bypass

If either pick in a consecutive pair has meaningful protection (Top 3, Lottery, etc. as determined by `isMeaningfulProtection()`), the consecutive violation is bypassed.

---

## Test Coverage Summary

### New Test File: `src/tests/tradeMachine/stepienObligations.test.js`

| Test Category | Count | Description |
|---------------|-------|-------------|
| Obligation causes failure | 3 | Existing obligation + adjacent trade pick → violation |
| Conditional/protected reserves | 4 | `tradeable: false`, `stepienEligible: false`, protection bypass |
| Swap worst_of exception | 3 | worst_of doesn't reserve, best_of does, missing defaults to best_of |
| Edge cases | 5 | Empty array, missing field, second-round ignored, fallback path, debug info |
| **Total** | **15** | All passing |

### Raw Command Outputs

```bash
$ npm run test -- src/tests/tradeMachine/stepienObligations.test.js --run

 RUN  v1.6.1 /home/runner/work/scoutzero/scoutzero

 ✓ src/tests/tradeMachine/stepienObligations.test.js  (15 tests) 8ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  09:13:30
   Duration  1.01s
```

```bash
$ npm run test -- src/tests/tradeMachine/ --run

 RUN  v1.6.1 /home/runner/work/scoutzero/scoutzero

 ✓ src/tests/tradeMachine/swapResolution.test.js  (34 tests | 4 skipped) 31ms
 ✓ src/tests/tradeMachine/conveyancePreflight.test.js  (38 tests) 28ms
 ✓ src/tests/tradeMachine/phase5DraftPositions.test.js  (32 tests) 28ms
 ✓ src/tests/tradeMachine/pickIdUtils.test.js  (34 tests) 19ms
 ✓ src/tests/tradeMachine/stepienObligations.test.js  (15 tests) 7ms
 ✓ src/tests/tradeMachine/seasonSwapResolution.test.js  (13 tests) 11ms
 ✓ src/tests/tradeMachine/draftPicksPreflight.test.js  (23 tests) 11ms

 Test Files  7 passed (7)
      Tests  185 passed | 1 skipped | 3 todo (189)
   Start at  09:13:40
   Duration  2.94s
```

```bash
$ npm run test -- tests/validators/stepien.test.js tests/hasStepienViolation.test.js --run

 RUN  v1.6.1 /home/runner/work/scoutzero/scoutzero

 ✓ tests/hasStepienViolation.test.js  (4 tests) 4ms
 ✓ tests/validators/stepien.test.js  (14 tests) 10ms

 Test Files  2 passed (2)
      Tests  18 passed (18)
   Start at  09:13:52
   Duration  1.05s
```

```bash
$ npm run build

vite v4.5.14 building for production...
✓ 2922 modules transformed.
✓ built in 9.95s
```

---

## Risks / Follow-ups

### 1. Data Population Required

The `draftPicksObligations` field must be populated in Firestore `architect_baseTeams` documents by the pipeline. See `PIPELINE_DRAFT_PICKS_LEDGER__EXECUTION__2026-01-08.md` for the pipeline implementation.

### 2. World Snapshots

When worlds are created or seasons are advanced, the obligations should be carried forward to world team snapshots. This is outside the scope of this execution (present-day only).

### 3. No UI Changes

This execution adds no UI — it's purely validation logic. Users won't see the obligations being considered unless they inspect the debug output (`result._debug`).

### 4. Backward Compatibility

All changes use safe defaults (`|| []`). Teams without `draftPicksObligations` in Firestore will simply have empty obligations, which means no additional blocking — same behavior as before.

---

## Acceptance Criteria Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Present-day Stepien considers existing obligations (not just current picksOut) | ✅ |
| 2 | Schema accepts `draftPicksInventory`, `draftPicksObligations`, `draftPicksContested` | ✅ |
| 3 | Loader returns new fields with safe defaults | ✅ |
| 4 | Test: Obligation-based consecutive failure | ✅ |
| 5 | Test: Conditional/protected obligation reserves year when not tradeable | ✅ |
| 6 | Test: worst_of swap does not reserve year | ✅ |
| 7 | Master Doc updated with exact final behavior and field names | ✅ |
| 8 | No changes to worlds/seasons/season advance flows | ✅ |

---

## Stop Conditions — None Triggered

| Condition | Status | Notes |
|-----------|--------|-------|
| Schema/validation layer prevents field loading | ✅ Clear | Fields flow through without strict validation |
| Competing Stepien implementations | ✅ Clear | `validateStepien.js` is canonical; others are dead code |
| Unexpected call graph | ✅ Clear | Call chain verified: `tradeValidator.js` → `validateStepien()` |

---

## Summary

Present-day Trade Machine Stepien validation now considers existing obligations from `team.draftPicksObligations`. A team that owes a first-round pick in year N cannot trade their year N+1 first without triggering a Stepien violation (unless one of the picks has meaningful protection).

The implementation:

1. Adds schema fields for the three ledger views
2. Returns those fields from the base team loader with safe defaults
3. Merges obligations with current trade picks in `validateStepien()`
4. Includes 15 tests proving the fix works correctly
5. Updates the Master Doc with the exact final behavior

**This is a non-breaking, additive change.** Teams without `draftPicksObligations` data will continue to work exactly as before (empty obligations = no additional blocking).
