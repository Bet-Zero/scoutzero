# Phase 39 Return Package: Second Apron Drift Fix (Execution)

## Summary

Executed Phase 39 fixes to eliminate `>=` vs `>` drift in Architect's non-TradeMachine logic. All identified call sites now use strict `>` comparisons for "Second Apron Team" classification, aligning with the CBA and TradeMachine SSOT.

## Changes Applied

### 1. `src/features/architect/utils/capLegalityValidation.js`

- **Fixed Drift**: `validateExceptionEligibility` now uses `currentCapHit > rules.cap.secondApron` (Strict).
- **Exported**: Verify capability added via named export.

### 2. `src/features/architect/utils/tradeHelpers.js`

- **Fixed Drift**: `getIncomingCeiling` now uses strict `>` for both first and second apron checks.
- **Fixed Drift**: `calculateAllowableIncoming` legacy wrapper now uses strict `>` for classification.

## Verification

### Automated Guardrails

- **New Test Suite**: `src/tests/architect/phase39_drift_guardrails.test.js`
  - **Scenario A**: Team at 190M (Exact) -> Not Blocked (PASS)
  - **Scenario B**: Team at 190M + $1 -> Blocked (PASS)

### Regression Status

- `capLegalityValidation.test.js`: **PASS** (All tests)
