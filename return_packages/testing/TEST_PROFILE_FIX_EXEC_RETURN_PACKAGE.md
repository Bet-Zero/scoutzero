# TEST_PROFILE_FIX_EXEC_RETURN_PACKAGE

## What Changed

### Problem

`npm run test:profile` failed with **"Could not parse test timing data"** because `scripts/analyze-test-performance.mjs` was parsing raw console output from `vitest run --reporter=verbose` using a regex that didn't reliably match Vitest's verbose output format.

### Fix

Rewrote `scripts/analyze-test-performance.mjs` to use **Vitest's JSON reporter** (`--reporter=json`):

- Vitest writes structured JSON to stdout; the script captures and `JSON.parse()`s it.
- Per-file duration is computed from `testResults[].endTime - testResults[].startTime` — no regex parsing required.
- Test count per file is derived from `testResults[].assertionResults.length`.
- File paths are converted to project-relative paths for readability.

### Files Modified

| File | Change |
|------|--------|
| `scripts/analyze-test-performance.mjs` | Replaced verbose-reporter regex parsing with JSON reporter parsing |
| `.gitignore` | Added `test-performance-results.json` to prevent committing generated artifacts |
| `docs/testing/VALIDATION_TIERS_MASTER.md` | Updated "Profiling & Speed" section to document JSON approach and `top20` output |

## Validation Output — Top 10 Slowest Files

```
=== TEST PERFORMANCE ANALYSIS ===

Total test files: 226
Total tests: 2979
Total duration: 8.86s
Average per file: 39ms
Median per file: 13ms

=== TOP 20 SLOWEST TEST FILES ===

 1.   0.68s (  7.6%) - tests/architect/seasonManager.test.js (26 tests)
 2.   0.66s (  7.5%) - tests/architect/EditContractModal.rules.test.jsx (11 tests)
 3.   0.61s (  6.9%) - src/tests/architect/entitlementEditorModal.test.tsx (5 tests)
 4.   0.57s (  6.5%) - src/tests/architect/pickRightWizard.test.tsx (25 tests)
 5.   0.37s (  4.1%) - src/tests/architect/pickRightWizard.vacuumApply.test.tsx (11 tests)
 6.   0.30s (  3.4%) - src/tests/architect/GMDashboard.smoke.test.tsx (5 tests)
 7.   0.25s (  2.8%) - src/tests/trade/TradeValidationGating.guardrail.test.jsx (27 tests)
 8.   0.23s (  2.6%) - tests/architect/capLegalityValidation.test.js (204 tests)
 9.   0.21s (  2.4%) - tests/architect/integration.test.js (14 tests)
10.   0.19s (  2.2%) - src/tests/architect/pickSelector.test.tsx (10 tests)
```

## JSON Artifact Confirmation

`test-performance-results.json` exists and is populated. First 30 lines:

```json
{
  "summary": {
    "totalFiles": 226,
    "totalTests": 2979,
    "totalDurationMs": 8863,
    "totalDurationSec": "8.86",
    "avgDurationMs": 39,
    "medianDurationMs": 13
  },
  "top20": [
    {
      "file": "tests/architect/seasonManager.test.js",
      "testCount": 26,
      "durationMs": 675
    },
    {
      "file": "tests/architect/EditContractModal.rules.test.jsx",
      "testCount": 11,
      "durationMs": 662
    },
    {
      "file": "src/tests/architect/entitlementEditorModal.test.tsx",
      "testCount": 5,
      "durationMs": 614
    },
    {
      "file": "src/tests/architect/pickRightWizard.test.tsx",
      "testCount": 25,
      "durationMs": 575
    },
```
