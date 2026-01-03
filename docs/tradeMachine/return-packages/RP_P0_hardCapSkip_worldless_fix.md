# Return Package: P0 HARD_CAP_SKIP Bug Fix

**Date**: 2026-01-03  
**Mode**: EXECUTION  
**Master Doc**: docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md

---

## 1. Root Cause Analysis

### Why Both Teams Were Flagged Hard-Capped

The bug occurred because of three interrelated issues:

#### Issue 1: Loose Boolean Check in `normalizeTradeInput.js`
```javascript
// BEFORE (buggy)
hardCapped: !!team.hardCapped,  // Would return true for truthy strings like "FirstApron"

// AFTER (fixed)
hardCapped: team.hardCapped === true,  // Only true for boolean true
```

#### Issue 2: Hard Cap Detection Using Truthy Checks
In `validateSalaryMatching.js`, the hard cap detection used simple truthy checks:
```javascript
// BEFORE (buggy)
const isHardCapped = hardCappedRaw === true;  // This was correct
const isHardCapTriggered = hardCapTriggeredRaw === true;  // This was correct

// But the data coming in was already corrupted by normalizeTradeInput
```

The fix was to create a canonical `getHardCapStatus()` function that:
- Only accepts `boolean true` values as hard cap triggers
- Ignores string values like "FirstApron" in worldless mode
- Provides a single source of truth for hard cap detection

#### Issue 3: Skip Output Shape Was Misleading
When salary matching was skipped, the output was:
```javascript
// BEFORE (misleading)
{
  ruleApplied: 'HARD_CAP_SKIP',  // Should be null!
  passed: true,                   // Should be null (validation didn't run)!
  allowableIncoming: null,        // Correct
}
```

This caused the trade receipt to show `ruleApplied: "HARD_CAP_SKIP"` and `passed: true` which mislead the UI.

---

## 2. Exact Fixes Applied

### A. New `getHardCapStatus()` Function
**File**: `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js`

Provides canonical hard cap detection with strict boolean checks:
```javascript
function getHardCapStatus(team, options = {}) {
  // Only boolean true triggers hard cap
  if (team.hardCapped === true) {
    return { isHardCapped: true, source: 'team.hardCapped === true' };
  }
  if (team.team?.hardCapTriggered === true) {
    return { isHardCapped: true, source: 'team.team.hardCapTriggered === true' };
  }
  // String values like "FirstApron" are ignored in worldless mode
  return { isHardCapped: false, source: 'NO_HARD_CAP_TRIGGER' };
}
```

### B. Fixed Skip Semantics in `validateSalaryMatching.js`
**File**: `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`

```javascript
// AFTER (correct)
if (hardCapStatus.isHardCapped) {
  return {
    passed: null,           // Null - validation didn't run
    ruleApplied: null,      // Null - no rule was applied
    allowableIncoming: null, // Null - not applicable
    margin: null,           // Null - not applicable
    skipReason: 'HARD_CAP_SKIP',
    // ...
  };
}
```

### C. Fixed Trade Receipt Null Semantics
**File**: `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`

```javascript
// AFTER (correct)
const isSkipped = salaryMatchingResult.skipReason != null;
const salaryMatchingEvaluation = {
  ruleApplied: isSkipped ? null : (salaryMatchingDetails.ruleApplied || null),
  allowableIncoming: isSkipped ? null : (salaryMatchingResult.allowableIncoming ?? null),
  passed: isSkipped ? null : (salaryMatchingResult.passed ?? null),
  margin: isSkipped ? null : (salaryMatchingDetails.margin ?? null),
  skipReason: salaryMatchingResult.skipReason ?? null,
  capSettings: context.capSettings,  // Global settings always available
};
```

### D. Fixed `normalizeTradeInput.js`
**File**: `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js`

```javascript
// AFTER (strict boolean)
hardCapped: team.hardCapped === true,  // Only boolean true triggers
```

---

## 3. Before/After Example Validator JSON

### BEFORE (Buggy - Both Teams Show HARD_CAP_SKIP)

```json
{
  "teams": [
    {
      "teamCode": "BOS",
      "salaryMatchingEvaluation": {
        "ruleApplied": "HARD_CAP_SKIP",
        "allowableIncoming": 0,
        "passed": true,
        "margin": 0,
        "capSettings": {},
        "capSettingsSource": "team.hardCapped === true || team.team?.hardCapTriggered === true"
      }
    },
    {
      "teamCode": "LAL",
      "salaryMatchingEvaluation": {
        "ruleApplied": "HARD_CAP_SKIP",
        "allowableIncoming": 0,
        "passed": true,
        "margin": 0,
        "capSettings": {},
        "capSettingsSource": "team.hardCapped === true || team.team?.hardCapTriggered === true"
      }
    }
  ]
}
```

### AFTER (Correct - Normal Salary Matching for Non-Hard-Capped Teams)

```json
{
  "teams": [
    {
      "teamCode": "BOS",
      "salaryMatchingEvaluation": {
        "ruleApplied": "UNDER_CAP",
        "allowableIncoming": 15000000,
        "passed": true,
        "margin": 5000000,
        "skipReason": null,
        "capSettings": {
          "salaryCap": 141000000,
          "firstApron": 178000000,
          "secondApron": 188000000
        },
        "capSettingsSource": "capSettingsProvider"
      }
    },
    {
      "teamCode": "LAL",
      "salaryMatchingEvaluation": {
        "ruleApplied": "OVER_CAP_BAND_2",
        "allowableIncoming": 12500000,
        "passed": true,
        "margin": 2500000,
        "skipReason": null,
        "capSettings": {
          "salaryCap": 141000000,
          "firstApron": 178000000,
          "secondApron": 188000000
        },
        "capSettingsSource": "capSettingsProvider"
      }
    }
  ]
}
```

### AFTER (Correct Skip Case - When Team IS Actually Hard-Capped)

```json
{
  "teams": [
    {
      "teamCode": "BOS",
      "salaryMatchingEvaluation": {
        "ruleApplied": null,
        "allowableIncoming": null,
        "passed": null,
        "margin": null,
        "skipReason": "HARD_CAP_SKIP",
        "capSettings": {
          "salaryCap": 141000000,
          "firstApron": 178000000,
          "secondApron": 188000000
        },
        "capSettingsSource": "N/A (skipped)"
      }
    }
  ]
}
```

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/features/architect/utils/tradeMachine/utils/hardCapStatus.js` | **NEW** - Canonical hard cap status detection |
| `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js` | Fixed skip output shape (null semantics) |
| `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Fixed trade receipt to preserve null semantics |
| `src/features/architect/utils/tradeMachine/utils/normalizeTradeInput.js` | Fixed strict boolean check for hardCapped |
| `src/tests/trade/hardCapSkip_strict_boolean.guardrail.test.js` | Updated tests for correct null semantics |
| `src/tests/trade/P0_hardCapSkip_worldless.guardrail.test.js` | **NEW** - 14 regression tests |

---

## 5. Tests Added

### New Test File: `P0_hardCapSkip_worldless.guardrail.test.js` (14 tests)

| Test | Assertion |
|------|-----------|
| `team with hardCapped=undefined does NOT trigger HARD_CAP_SKIP` | Worldless teams without triggers pass through |
| `team with hardCapped=false does NOT trigger HARD_CAP_SKIP` | Explicit false is respected |
| `team with hardCapped="FirstApron" (string) does NOT trigger skip` | String values ignored in worldless |
| `HARD_CAP_SKIP has allowableIncoming=null (not 0)` | Null semantics preserved |
| `HARD_CAP_SKIP has passed=null (not true)` | Null semantics preserved |
| `TPE_ABSORPTION skip has allowableIncoming=null (not 0)` | Other skip reasons also correct |
| `HARD_CAP_SKIP has ruleApplied=null (not "HARD_CAP_SKIP")` | ruleApplied is null for skips |
| `skip state has margin=null (not 0)` | Margin is null for skips |
| `trade receipt salaryMatchingEvaluation has null values when skipped` | Receipt preserves null semantics |
| `trade receipt uses global cap settings for skipped teams` | Cap settings still available |
| `getHardCapStatus returns isHardCapped=false for team with no triggers` | Function works correctly |
| `getHardCapStatus returns isHardCapped=true only for boolean true` | Strict boolean check |
| `getHardCapStatus ignores string values in worldless mode` | Worldless mode protection |
| `isTeamHardCapped helper returns boolean` | Helper works correctly |

---

## 6. Command Outputs

```bash
# Tests pass
$ npm run test -- src/tests/trade/hardCapSkip_strict_boolean.guardrail.test.js --run
✓ 10 tests passed

$ npm run test -- src/tests/trade/P0_hardCapSkip_worldless.guardrail.test.js --run
✓ 14 tests passed

# Build passes
$ npm run build
✓ built in 9.54s

# All trade tests pass (except pre-existing UI failures)
$ npm run test -- src/tests/trade/ --run
Test Files: 10 passed, 1 failed (pre-existing)
Tests: 181 passed, 10 failed (pre-existing)
```

---

## Summary

The P0 HARD_CAP_SKIP bug was caused by loose boolean checks allowing truthy strings to trigger hard cap skipping, combined with incorrect skip output shape that showed `ruleApplied: "HARD_CAP_SKIP"` and `passed: true` instead of proper null semantics.

The fix ensures:
1. **Worldless mode works correctly** - Teams are NOT hard-capped unless explicit boolean `true` triggers exist
2. **Skip semantics are correct** - When skipped, `ruleApplied`, `passed`, `allowableIncoming`, and `margin` are all `null`
3. **UI can distinguish skip from normal** - `skipReason` is populated, `ruleApplied` is `null`
