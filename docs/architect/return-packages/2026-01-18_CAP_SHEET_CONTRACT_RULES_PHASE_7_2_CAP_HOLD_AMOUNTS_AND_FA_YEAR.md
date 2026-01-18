/**

* FILE: docs/architect/return-packages/2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_2_CAP_HOLD_AMOUNTS_AND_FA_YEAR.md
* PURPOSE: Phase 7.2 return package for cap hold amounts + FA year derivation.
* OWNERSHIP: Feature: architect/cap-sheet validation
*
* HISTORY:
* * 2026-01-18: Created by plan `plans/cap-sheet-contract-rules-phase-7-2/plan.md`, chunk_n/a
*
* LINKS:
* * Plan: plans/cap-sheet-contract-rules-phase-7-2/plan.md
* * Latest Chunk: n/a (no chunks used)
 */

# Phase 7.2: Cap Hold Amounts + FA Year Derivation

**Date:** 2026-01-18
**Owner:** architect/cap-sheet validation
**Status:** Complete

---

## 1) Summary of Changes

* Added rightsType-based cap hold multipliers (FULL_BIRD 190%, EARLY_BIRD 130%, NON_BIRD 120%) with explicit fallback warnings when rightsType is missing/unsupported.
* Derive freeAgency.year from the declined option season string ("YYYY-YY" -> start year), not from targetYear arithmetic.
* Enforced expected cap hold amounts in validateOptionDecision with rounding rules and tolerance.
* Updated option decline paths (mutation pipeline, season advance, UI hooks) to use canonical amount and FA-year derivation.
* Added tests for multipliers, FA-year derivation, and missing-rights fallback.

## 2) Audit Findings (Current Logic)

**Cap hold computation locations (pre-Phase 7.2):**
* `src/features/architect/utils/mutationPipeline.js` -> `computeOptionResult` used 150% placeholder.
* `src/features/architect/utils/seasonManager.js` -> `processOptionsWithDecisions` used `calculateCapHold` from `capHolds.ts`.
* `src/features/architect/hooks/useCapSheetState.js` -> option decline used `calculateCapHold`.
* `src/features/architect/GMDashboard/hooks/useArchitectActions.ts` -> option decline used `calculateCapHold`.
* `src/features/architect/utils/capHoldTransitionHelpers.js` -> `computeExpectedCapHoldAmount` used 150% placeholder.

**RightsType availability:**
* Player objects commonly include `player.contract.birdRights.status` (e.g., "Full", "Early Bird", "Non-Bird", "None").
* Canonical rightsType strings (FULL_BIRD/EARLY_BIRD/NON_BIRD) are already normalized in `capLegalityValidation` signing terms helpers.

**Existing cap hold tables:**
* `src/features/architect/utils/capHolds.ts` -> `CAP_HOLD_MULTIPLIERS` (was FULL 1.9, EARLY 1.75, NON 1.2).
* `src/features/architect/utils/playerRulesProfile/birdRightsRules.js` -> `capHoldMultiplier` for Early Bird 1.3, Non-Bird 1.2.

**Conflict noted:** Early Bird multiplier differed (1.75 vs 1.3). Resolved by updating `CAP_HOLD_MULTIPLIERS` to 1.3 and using it in Phase 7.2 logic.

**Stop conditions:** None triggered (rights data present enough to enforce with explicit fallback warnings).

## 3) Canonical Computation Rules (Percent Table + Rounding)

**Rights-based multiplier table (Phase 7.2):**
* FULL_BIRD: 1.90
* EARLY_BIRD: 1.30
* NON_BIRD: 1.20
* CAP_SPACE / NONE / UNKNOWN: fallback 1.50 (legacy placeholder)

**Rounding:**
* Expected cap hold amount uses `Math.round(lastSalary * multiplier)`.
* Validation enforces |actual - expected| <= 1.

## 4) FA Year Derivation Method

**Method:**
* Derive end year from option season string ("YYYY-YY") using `toEndYear`, then convert to start year (endYear - 1).

**Example:**
* Option season "2025-26" -> endYear 2026 -> FA year 2025.

## 5) Enforcement Details (Hard Block + Warnings)

**Hard block (`cap_hold_transition_invalid`):**
* Declined option must create cap hold when prior salary exists.
* Cap hold amount must match computed expected value (within tolerance).
* Cap hold amount must be a non-negative finite number.

**Warnings:**
* `cap_hold_transition_inputs_missing` when rightsType is missing/unsupported (fallback multiplier used) or option season missing (FA year fallback).
* `cap_hold_transition_unexpected` when freeAgency.year does not match derived year.

## 6) Files Changed

* `src/features/architect/utils/capHoldTransitionHelpers.js`
* `src/features/architect/utils/capLegalityValidation.js`
* `src/features/architect/utils/mutationPipeline.js`
* `src/features/architect/utils/seasonManager.js`
* `src/features/architect/utils/capHolds.ts`
* `src/features/architect/utils/contractUtils.js`
* `src/features/architect/hooks/useCapSheetState.js`
* `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`
* `tests/architect/capLegalityValidation.test.js`
* `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
* `docs/architect/return-packages/2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_2_CAP_HOLD_AMOUNTS_AND_FA_YEAR.md`
* `plans/cap-sheet-contract-rules-phase-7-2/plan.md`

## 7) Tests + Output

Command:

```bash
npm test -- --run tests/architect/capLegalityValidation.test.js
```

Output:

```text
> scoutzero-final2@0.0.1 test
> vitest --run tests/architect/capLegalityValidation.test.js

 RUN  v1.6.1 /Users/brenthibbitts/Desktop/ScoutZero

 ✓ tests/architect/capLegalityValidation.test.js  (114 tests) 236ms

 Test Files  1 passed (1)
      Tests  114 passed (114)
   Start at  05:15:51
   Duration  7.78s (transform 1.48s, setup 328ms, collect 1.68s, tests 236ms, environment 1.88s, prepare 441ms)
```

## 8) Build + Output

Command:

```bash
npm run build
```

Output:

```text
> scoutzero-final2@0.0.1 build
> vite build

vite v4.5.14 building for production...
transforming...
[plugin:vite:resolve] Module "fs" has been externalized for browser compatibility, imported by "/Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/tradeMachine/engine/tradeDebug.js". See http://vitejs.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility for more details.
✓ 2927 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-2d63ff9c.css            73.22 kB │ gzip:  12.88 kB

(!) Some chunks are larger than 500 kBs after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
dist/assets/index.esm-a9316045.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-ac3942c3.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-5e223e8c.js     15.22 kB │ gzip:   5.13 kB
dist/assets/index-9890ad53.js          1,883.45 kB │ gzip: 550.55 kB
✓ built in 48.17s
```

## 9) Master Doc Updates + Changelog Entry

* Updated `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` to document rights-based multipliers, rounding/tolerance, and FA-year derivation method.
* Added Phase 7.2 change log entry; annotated Phase 7.1 placeholder 150% note.

---

**Phase 7.1 return package:**
* `docs/architect/return-packages/2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_1_CAP_HOLD_TRANSITIONS.md` already exists (no retro creation needed).
