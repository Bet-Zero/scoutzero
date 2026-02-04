# PST Phase 17.3 — Ladders and Conversion Execution Return Package

**Date:** 2026-02-04  
**Phase:** 17.3 (Multi-Year Ladders + Conversion (Entitlement Writes) + Legacy DARE Test Repair)  
**Master Doc:** `docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md`  
**Owner:** architect/entitlements

---

## Executive Result

**VERIFIED + FIXED**

Phase 17.3 acceptance criteria are fully met:

1. ✅ **Legacy failing tests repaired** — `conveyanceResolutionAdapter.test.js` rewritten to use correct API
2. ✅ **Phase 17.3 guardrail tests created and passing** — 12 new tests
3. ✅ **Existing Phase 17.1 + 17.2 tests still pass** — 20 + 24 tests
4. ✅ **Build passes** — Production build successful
5. ✅ **Rolled/converted entitlement writes are correct + deterministic**
6. ✅ **No 17.4/17.5 features added**

---

## What Was Already Correct vs What Changed

### Already Correct (No Changes Needed)

| Aspect                                | Implementation                                                                                                                                               | File                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| **Ladder construction**               | `buildProtectionLadder()` correctly builds year-by-year tiers from pickRules                                                                                 | `protectionLadderFactory.ts`                |
| **Roll forward logic**                | `resolveConveyanceForEntitlement()` detects triggered protection and returns `outcome: 'rolled'` with correct `newYear` and `newProtection`                  | `conveyanceResolutionAdapter.ts`            |
| **Conversion logic**                  | Same function detects `ifTriggered: 'convert'` and returns `outcome: 'converted'` with `convertedToRound: 2`                                                 | `conveyanceResolutionAdapter.ts`            |
| **Final tier expiry**                 | `isFinalProtectionYear()` + `ifTriggered: 'cancel'` produce `outcome: 'expired'`                                                                             | `conveyanceResolutionAdapter.ts`            |
| **Rolled entitlement doc builder**    | `buildRolledEntitlementDoc()` correctly increments `seasonYear`, updates `underlyingPickId`, and sets `rolledFromEntitlementId`/`rolledFromYear`             | `entitlementMutator.ts`                     |
| **Converted entitlement doc builder** | `buildConvertedEntitlementDoc()` correctly sets `round: 2`, updates `underlyingPickId` to `_2nd`, and sets `convertedFromEntitlementId`/`convertedFromRound` | `entitlementMutator.ts`                     |
| **Write builder**                     | `buildEntitlementWritesFromResolution()` produces 1 write for conveyed/expired, 2 writes for rolled/converted                                                | `entitlementMutator.ts`                     |
| **Team update builder**               | `buildTeamUpdatesFromResolutions()` correctly adds new entitlement IDs and removes resolved ones                                                             | `entitlementMutator.ts`                     |
| **Season advance integration**        | `applyDAREResultsToBatch()` applies writes to Firestore batch in `seasonManager.js`                                                                          | `entitlementMutator.ts`, `seasonManager.js` |
| **dareResolver.test.js**              | Already fixed in prior work (16 tests passing)                                                                                                               | `dareResolver.test.js`                      |

### What Changed

| File                                                 | Change           | Rationale                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conveyanceResolutionAdapter.test.js`                | Complete rewrite | Legacy tests imported non-existent `resolveConveyance` function. Updated to use actual API `resolveConveyanceForEntitlement`, pass protection ladder directly, use correct entitlement shape (`kind`, `holderTeam`, `underlyingPickId`) |
| `phase17_3_ladders_and_conversion_guardrail.test.ts` | Created new file | Added 12 mandatory tests covering all Phase 17.3 scenarios                                                                                                                                                                              |

---

## Test Fix Summary

### conveyanceResolutionAdapter.test.js (10 tests)

**Problem:**

- Imported `resolveConveyance` which doesn't exist (actual function: `resolveConveyanceForEntitlement`)
- Mocked `buildProtectionLadder` internally but current API expects ladder passed as argument
- Used legacy entitlement shape (`pickType`, `originTeam`, `ownerTeam`) instead of current shape

**Fix:**

- Updated import to `resolveConveyanceForEntitlement`
- Removed mock for `buildProtectionLadder`, now pass ladder directly to function
- Updated entitlement fixtures to use current schema: `kind`, `holderTeam`, `underlyingPickId`, `seasonYear`
- Added required `opts: { draftYear }` parameter

**Result:** All 10 tests now pass

### dareResolver.test.js (16 tests)

**Status:** Already fixed in prior work (Phase A header noted in file)  
**Changes made previously:**

- Updated mocks to use `resolveSwapForEntitlement` instead of `resolveSwap`
- Updated mocks to use `resolveConveyanceForEntitlement` instead of `resolveConveyance`
- Updated mocks to use `buildEntitlementWritesFromResolution` instead of `buildMutationBatch`
- Removed tests for non-exported `buildDAREInput` and `classifyEntitlements` (inline logic in resolver)

**Result:** All 16 tests pass

---

## Behavior Matrix

| Scenario           | Expected                                                                                                                   | Actual    | Status   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------- | -------- |
| **Roll Year 1**    | outcome=rolled, newYear=N+1, new entitlement created with rolledFromEntitlementId/rolledFromYear, underlyingPickId updated | ✓ Correct | **PASS** |
| **Final Tier**     | outcome=expired, no new entitlement created                                                                                | ✓ Correct | **PASS** |
| **Convert to 2RP** | outcome=converted, new entitlement with round=2, underlyingPickId ends in `_2nd`, convertedFromEntitlementId set           | ✓ Correct | **PASS** |
| **Conveys**        | outcome=conveyed, no new entitlement created                                                                               | ✓ Correct | **PASS** |
| **Determinism**    | Same inputs → same team updates regardless of resolution order                                                             | ✓ Correct | **PASS** |

---

## Files Changed

| File                                                                          | Change Type   | Rationale                                     |
| ----------------------------------------------------------------------------- | ------------- | --------------------------------------------- |
| `src/tests/architect/dare/conveyanceResolutionAdapter.test.js`                | **Rewritten** | Fixed broken legacy tests to use correct API  |
| `src/tests/architect/dare/phase17_3_ladders_and_conversion_guardrail.test.ts` | **Created**   | Added 12 mandatory Phase 17.3 guardrail tests |

---

## Test Output

### Full DARE Test Suite

```
 RUN  v1.6.1 /Users/brenthibbitts/Desktop/ScoutZero
 ✓ src/tests/architect/dare/phase17_2_swap_guardrail.test.ts (24)
 ✓ src/tests/architect/dare/phase17_1_protections_guardrail.test.ts (20)
 ✓ src/tests/architect/dare/phase17_3_ladders_and_conversion_guardrail.test.ts (12)
 ✓ src/tests/architect/dare/conveyanceResolutionAdapter.test.js (10)
 ✓ src/tests/architect/dare/dareResolver.test.js (16)
 ✓ src/tests/architect/dare/protectionLadderFactory.test.js (27)
 ✓ src/tests/architect/dare/swapResolutionAdapter.test.js (8)

 Test Files  7 passed (7)
      Tests  117 passed (117)
   Duration  12.11s
```

### Build Output

```
vite v4.5.14 building for production...
✓ 3004 modules transformed.
✓ built in 40.64s
```

---

## Regression Risk

**LOW**

- No changes to production DARE engine code
- Only test files modified
- All 117 tests pass
- Build succeeds
- Changes are additive (new guardrail tests) and corrective (fixing broken tests)

---

## Master Doc Update

Mark **Phase 17.3** as **COMPLETE** in:  
`docs/team-scrape/PST_PHASE_17_ENTITLEMENT_RESOLUTION_ENGINE_MASTER.md`

### Phase 17.3 Summary

- **Legacy test repair:** 10 tests in `conveyanceResolutionAdapter.test.js` fixed
- **New guardrail tests:** 12 tests in `phase17_3_ladders_and_conversion_guardrail.test.ts`
- **Total DARE tests:** 117 (all passing)
- **Implementation:** VERIFIED - no code changes needed, existing behavior is correct

---

## Next Steps

Phase 17.4/17.5 remain for future work:

- Multi-team pools
- Chained swaps
- Circular detection
- Ranked conveyance

These features were NOT touched per execution rules.
