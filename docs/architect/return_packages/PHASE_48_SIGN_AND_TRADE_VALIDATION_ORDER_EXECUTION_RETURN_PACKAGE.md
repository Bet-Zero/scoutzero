# PHASE 48 — Sign-and-Trade Validation Order Hard Fix — EXECUTION RETURN PACKAGE

**Date:** 2026-01-28  
**Mode:** EXECUTION  
**Scope:** `src/features/architect/utils/mutationPipeline.js`  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. Executive Summary

### What was broken

Sign-and-Trade (S&T) mutations were calling the trade validator (`validateTrade`) even when signing validation should have blocked the transaction. This occurred because:

1. The pipeline flow is: `computeWorldMutation` → `validateMutation` → `persistWorldMutation`
2. `computeSignAndTradeResult` internally calls `computeTradeResult`
3. `computeTradeResult` calls `validateTrade` as part of Phase 47 TPE persistence logic
4. By the time `validateMutation` runs and checks signing validity, the trade validator had already been invoked

This caused two SAT14 tests to fail:

- "should call signing validator before trade validator" (call order was wrong)
- "should not call trade validator if signing fails" (trade validator was still called)

### What is fixed

Added `validateSigning()` call in `computeSignAndTradeResult()` BEFORE calling `computeTradeResult()`. This ensures:

- Signing validation runs first in the compute phase
- If signing validation fails, the function returns early with error
- `computeTradeResult` (and thus `validateTrade`) is never invoked for invalid signings

---

## 2. Files Changed

| File                                                          | Change Type | Description                                                                              |
| ------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `src/features/architect/utils/mutationPipeline.js`            | Modified    | Added `validateSigning()` call in `computeSignAndTradeResult()` before trade computation |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Modified    | Added Phase 48 changelog entry                                                           |

---

## 3. Before/After Behavior

### Before (broken)

```
computeSignAndTradeResult():
  1. computeSigningResult() → compute signing (no validation)
  2. computeTradeResult() → computes trade AND calls validateTrade() internally
  3. Return result

validateMutation() for signAndTrade:
  1. validateSigning() → check if signing is legal
  2. validateTradeForPipeline() → check if trade is legal

PROBLEM: validateTrade() was called in step 2 of compute, BEFORE validateSigning() in validation phase
```

### After (fixed)

```
computeSignAndTradeResult():
  1. computeSigningResult() → compute signing (no validation)
  2. validateSigning() → check if signing is legal ← NEW STEP
  3. If signing invalid, return error early (short-circuit)
  4. computeTradeResult() → only called if signing is valid
  5. Return result

validateMutation() for signAndTrade:
  1. validateSigning() → redundant but harmless (already passed in compute)
  2. validateTradeForPipeline() → check if trade is legal

CORRECT: validateSigning() now runs BEFORE validateTrade() in all cases
```

### Call Order Guarantee

The fix ensures:

1. `validateSigning` is always called first
2. If `validateSigning` returns `valid: false`, the function returns immediately
3. `computeTradeResult` (which calls `validateTrade`) is only invoked if signing is valid
4. No trade validation occurs for invalid signings

---

## 4. Test Results

### Sign-and-Trade Tests

```
npm run test -- --run src/tests/architect/signAndTrade.test.js

 ✓ src/tests/architect/signAndTrade.test.js  (20 tests) 79ms

 Test Files  1 passed (1)
      Tests  20 passed (20)

```

**Previously failing tests now pass:**

- ✅ SAT14: "should call signing validator before trade validator"
- ✅ SAT14: "should not call trade validator if signing fails"

### Full Architect Test Suite

```
npm run test -- --run src/tests/architect/

 Test Files  20 passed (20)
      Tests  225 passed (225)
   Duration  52.14s
```

**Result:** 225/225 tests passing (100% pass rate)

### Build

```
npm run build

✓ built in 1m 10s
```

Build succeeds with no errors.

---

## 5. Master Doc Changelog Entry

```markdown
- - 2026-01-28: Phase 48 Sign-and-Trade Validation Order Fix (EXECUTION) - Fixed S&T validation order: added `validateSigning()` call in `computeSignAndTradeResult()` before `computeTradeResult()` is invoked, ensuring signing validation failure short-circuits before trade validator runs; fixed 2 failing SAT14 tests; 225/225 architect tests now passing. Return package: `docs/architect/return_packages/PHASE_48_SIGN_AND_TRADE_VALIDATION_ORDER_EXECUTION_RETURN_PACKAGE.md`.
```

---

## 6. Code Change

**Location:** `src/features/architect/utils/mutationPipeline.js`, function `computeSignAndTradeResult()`

```javascript
if (!signingResult.success) {
  return {
    success: false,
    error: signingResult.error || 'Signing step failed',
  };
}

// Phase 48: Validate signing BEFORE proceeding to trade computation
// This ensures signing validation failure short-circuits before validateTrade is called
const currentYear = toEndYear(seasonId);
const signingValidation = validateSigning({
  team,
  player,
  contract: payload.contract,
  signedUsing: payload.signedUsing,
  year: currentYear,
});

if (!signingValidation.valid) {
  return {
    success: false,
    error:
      signingValidation.violations?.[0]?.message || 'Signing validation failed',
    violations: signingValidation.violations,
    warnings: signingValidation.warnings,
  };
}

// Extract updated source team and player (now signed) from signing result
```

---

## 7. Notes / Follow-ups

### Redundant Validation

The `validateMutation()` function for `signAndTrade` still calls `validateSigning()` after the compute phase. This is now redundant (signing was already validated in compute), but is harmless and provides defense-in-depth.

**Future consideration:** Could remove the signing validation from `validateMutation` for S&T since it's guaranteed to pass by the time we get there. However, keeping it maintains the pattern of all validations happening in `validateMutation` and provides an extra safety check.

### No Stop Conditions Triggered

- ✅ S&T execution path clearly located in `computeSignAndTradeResult()`
- ✅ Signing and trade validators identified
- ✅ Single change location, no branching issues
- ✅ Test expectations matched intended behavior

---

**Phase 48 Complete.** Sign-and-Trade validation order is now correct: signing validation runs first and short-circuits before trade validation if invalid.fix
