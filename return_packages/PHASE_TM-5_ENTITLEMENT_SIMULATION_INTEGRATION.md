# PHASE TM-5 — Entitlement Terms Simulation + Trade Machine Integration

**Date:** 2026-02-05

## Summary of Changes
- Added normalized entitlement terms helper with concise formatting and draftKey generation.
- Wired terms into entitlement row projection, summaries, receipts, and export capture.
- Updated trade payloads and receipts to include `terms`, `termsShort`, and `draftKey`.
- Made Stepien validation terms-aware with conservative ladder/conveyance warnings and swapType parsing.

## Files Touched
- `src/features/architect/utils/entitlements/entitlementTerms.ts`
- `src/features/architect/utils/entitlements/entitlementPickRowProjection.js`
- `src/features/architect/hooks/useTradeMachine.js`
- `src/features/architect/tradeMachine/utils/computeTradeDraftKey.js`
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`
- `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`
- `src/features/architect/tradeMachine/TradeExportCapture.jsx`
- `src/features/architect/utils/tradeMachine/utils/stepienEntitlementUtils.js`
- `src/features/architect/utils/tradeMachine/rules/validateStepien.js`
- `tests/entitlements/entitlementTerms.test.ts`
- `tests/validators/stepienEntitlements.test.js`
- `docs/architect/ENTITLEMENT_TERMS_SIMULATION_NOTES.md`
- `docs/architect/TRADE_MACHINE_MASTER_AUDIT.md`

## Tests Added
- `tests/entitlements/entitlementTerms.test.ts`
- `tests/validators/stepienEntitlements.test.js` (extended)

## Test Results
- `npm run test -- --run tests/entitlements/entitlementTerms.test.ts tests/validators/stepienEntitlements.test.js src/tests/architect/entitlementPickRowDisplay.test.jsx`
  - Passed: 36 tests in 3 files
- `npm run build`
  - Succeeded with warnings:
    - Browserslist data out of date
    - `fs` externalized for browser compatibility in `tradeDebug.js`
    - Dynamic import warning for `firebaseConfig.js`
    - Chunk size warning (>500 kB)
- `npm run validate:project`
  - Failed (pre-existing): missing directories
    - `player-scrape/contracts/output`
    - `player-scrape/contracts/working`
    - `team-scrape/shared/firestore_staging/output/merged`

## Commands Run
- `npm run test -- --run tests/entitlements/entitlementTerms.test.ts tests/validators/stepienEntitlements.test.js src/tests/architect/entitlementPickRowDisplay.test.jsx`
- `npm run build`
- `npm run validate:project`

## Simulated vs Deferred

**Simulated Now**
- Entitlement terms normalization (ladder/swap/conveyance) with `termsShort` and `draftKey`.
- Trade Machine UI shows concise terms in rows, summaries, and export capture.
- Trade receipt contains `terms`, `termsShort`, and `draftKey` for entitlements.
- Stepien conservatively evaluates ladders and conveyance; swapType parsing respected.

**Deferred**
- Ladder-accurate Stepien exemptions (tier-by-tier protection rules).
- Conveyance pool resolution and ranked selection within validation.
- Swap pool resolution or full multi-team swap graph simulation in validation.
