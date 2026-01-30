# PST Phase 12.1 — Stepien Entitlements Execution Return Package

**MODE**: EXECUTION RETURN PACKAGE  
**DATE**: 2026-01-30  
**PHASE**: 12.1 — Stepien Rule: Entitlements-Aware Validation

---

## 1. Summary of Changes

Implemented entitlement-aware Stepien validation while maintaining full backward compatibility with legacy pick-based validation. The Trade Machine now passes `entitlementsOut` through the validation pipeline, and `validateStepien()` considers entitlement-derived picks alongside legacy picksOut and obligations.

### Conservative Policy Implemented

| Entitlement Kind   | Round 1 + Non-Pooled | Reserves Year? |
| ------------------ | -------------------- | -------------- |
| `pick_ownership`   | ✅                   | ✅ Yes         |
| `swap_right`       | ✅                   | ✅ Yes         |
| `conveyance_right` | ✅                   | ✅ Yes         |
| Any (pooled)       | ❌                   | ❌ No          |
| Any (round 2)      | ❌                   | ❌ No          |

---

## 2. File-by-File Changes

### 2.1 Created Files

#### `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js`

**Purpose**: Convert entitlement objects to Stepien-compatible pick-like objects.

**Exports**:

- `isPooledEntitlement(ent)` — returns true if `ent.underlyingStatus === 'pooled'`
- `isStepienRelevantKind(kind)` — returns true for `pick_ownership`, `swap_right`, `conveyance_right`
- `buildStepienOutgoingPicksFromEntitlements(entitlementsOut)` — filters and maps entitlements to pick-like objects

**Logic**:

- Filters to round 1 only
- Excludes pooled entitlements
- Maps `swap_right` to `isSwap: true, swapType: 'best_of'`
- Maps `pick_ownership` and `conveyance_right` to outright picks (`isSwap: false`)

#### `tests/validators/stepienEntitlements.test.js`

**Purpose**: Comprehensive test suite for entitlement-aware Stepien validation.

**Test Coverage (28 tests)**:

- `stepienEntitlementUtils` helper tests (15 tests)
- `validateStepien` entitlements integration (13 tests)
  - `pick_ownership` reserves year
  - `swap_right` reserves year
  - `conveyance_right` reserves year
  - Pooled entitlements do NOT reserve year
  - Entitlements + legacy picks interop
  - Backward compatibility with legacy picksOut

---

### 2.2 Modified Files

#### `src/features/architect/hooks/useTradeMachine.js`

**Change**: Added `entitlementsOut` to the validateTrade call.

```javascript
// Before (line ~728)
.map((t) => ({
  team: t.team,
  sends: t.sends,
  picksOut: t.picksOut,
  hardCapped: t.team.hardCapped,
}))

// After
.map((t) => ({
  team: t.team,
  sends: t.sends,
  picksOut: t.picksOut,
  hardCapped: t.team.hardCapped,
  // Phase 12.1: Pass entitlements for Stepien validation
  entitlementsOut: t.entitlementsOut || [],
}))
```

#### `src/features/architect/utils/tradeMachine/rules/validateStepien.js`

**Changes**:

1. Added import for `buildStepienOutgoingPicksFromEntitlements`
2. Added entitlement processing after obligation processing
3. Updated early return condition to also check `entitlementDerivedPicks.length === 0`
4. Merged entitlement-derived picks into `allStepienRelevant` array
5. Updated `_debug` object to include `entitlementsConsidered` count

**Key logic addition**:

```javascript
// Phase 12.1: Build Stepien-relevant picks from entitlements (if available)
const entitlementsOut = team.entitlementsOut || [];
const entitlementDerivedPicks =
  buildStepienOutgoingPicksFromEntitlements(entitlementsOut);

// Merge current trade picks with existing obligations AND entitlements
const allStepienRelevant = [
  ...stepienRelevantPicks,
  ...obligationYears,
  ...entitlementDerivedPicks,
];
```

#### `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`

**No code changes required** — the `teamsWithAssets` construction uses spread operator (`...team`) which automatically preserves `entitlementsOut` passed from useTradeMachine.

---

## 3. Test Command Outputs

### 3.1 `npm run build`

```
✓ 2959 modules transformed.
dist/index.html                  0.60 kB │ gzip:   0.37 kB
dist/assets/index-af62a8fc.js    2,000.16 kB │ gzip: 581.34 kB
✓ built in 28.56s
```

**Result**: ✅ PASS

### 3.2 `npm run test tests/validators/stepien.test.js -- --run`

```
✓ tests/validators/stepien.test.js (14)
   ✓ validateStepien (14)
     ✓ consecutive picks rule (3)
     ✓ seven year limit (2)
     ✓ second apron restrictions (2)
     ✓ swap year reservation (Phase 2) (5)
     ✓ second apron swap restrictions (Phase 2) (2)

Test Files  1 passed (1)
Tests  14 passed (14)
```

**Result**: ✅ PASS (no regressions)

### 3.3 `npm run test src/tests/tradeMachine/stepienObligations.test.js -- --run`

```
✓ src/tests/tradeMachine/stepienObligations.test.js (15)
   ✓ validateStepien - Obligations Wiring (15)
     ✓ Test 1: Existing obligation causes Stepien failure (3)
     ✓ Test 2: Conditional/protected obligation reserves year (4)
     ✓ Test 3: Swap worst_of does not reserve year (3)
     ✓ Edge cases (5)

Test Files  1 passed (1)
Tests  15 passed (15)
```

**Result**: ✅ PASS (no regressions)

### 3.4 `npm run test tests/validators/stepienEntitlements.test.js -- --run`

```
✓ tests/validators/stepienEntitlements.test.js (28)
   ✓ stepienEntitlementUtils (15)
     ✓ isPooledEntitlement (4)
     ✓ isStepienRelevantKind (4)
     ✓ buildStepienOutgoingPicksFromEntitlements (7)
   ✓ validateStepien - Entitlements Integration (13)
     ✓ pick_ownership entitlements (2)
     ✓ swap_right entitlements (2)
     ✓ conveyance_right entitlements (2)
     ✓ pooled entitlements do NOT reserve year (2)
     ✓ entitlements + legacy picks interop (2)
     ✓ backward compatibility - legacy picksOut still works (3)

Test Files  1 passed (1)
Tests  28 passed (28)
```

**Result**: ✅ PASS

---

## 4. Behavior Notes

### 4.1 conveyance_right Mapping

`conveyance_right` is mapped as an **outright pick** (not a swap):

- `isSwap: false`
- `swapType: undefined`

This is conservative — the team MAY receive a first-round pick if the conveyance triggers. Under the conservative policy, this reserves the year for Stepien purposes.

### 4.2 Entitlement + Legacy Interop

When both `entitlementsOut` AND `outgoingPicks` are present:

- Both are processed and merged into `allStepienRelevant`
- This allows mixed trades where some assets are entitlement-based and some are legacy pick-based
- Consecutive year detection works across all sources (trade picks, obligations, entitlements)

### 4.3 Early Return Path

When a team has:

- No legacy picks (`picks.length === 0`)
- No obligations (`obligationYears.length === 0`)
- No Stepien-relevant entitlements (`entitlementDerivedPicks.length === 0`)

The validator takes an early return path with `passed: true` and `message: 'No picks in trade'`. This is correct behavior for trades with no first-round assets.

---

## 5. Acceptance Criteria Status

| AC  | Description                                                      | Status |
| --- | ---------------------------------------------------------------- | ------ |
| AC1 | `entitlementsOut` passed into validateTrade from useTradeMachine | ✅     |
| AC2 | tradeValidator passes through entitlementsOut to validateStepien | ✅     |
| AC3 | validateStepien uses entitlement-derived picks when present      | ✅     |
| AC4 | Pooled entitlements do NOT reserve year                          | ✅     |
| AC5 | swap_right + conveyance_right reserve year (conservative)        | ✅     |
| AC6 | All existing Stepien tests pass (no regressions)                 | ✅     |
| AC7 | New entitlement Stepien tests pass                               | ✅     |
| AC8 | `npm run build` passes                                           | ✅     |

---

## 6. Master Doc Update

Updated `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`:

- Added Phase 12.1 row to Phase Status table
- Added Phase 12.1 section documenting the changes

---

## 7. Files Changed

| File                                                                                               | Action   |
| -------------------------------------------------------------------------------------------------- | -------- |
| `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js`                       | CREATED  |
| `tests/validators/stepienEntitlements.test.js`                                                     | CREATED  |
| `src/features/architect/hooks/useTradeMachine.js`                                                  | MODIFIED |
| `src/features/architect/utils/tradeMachine/rules/validateStepien.js`                               | MODIFIED |
| `docs/team-scrape/PST_PICK_LEDGER_MASTER_PLAN.md`                                                  | MODIFIED |
| `docs/team-scrape/return_packages/PST_PHASE_12_1_STEPIEN_ENTITLEMENTS_EXECUTION_RETURN_PACKAGE.md` | CREATED  |
