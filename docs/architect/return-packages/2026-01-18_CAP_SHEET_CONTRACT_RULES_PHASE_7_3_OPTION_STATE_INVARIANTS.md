/**

* FILE: docs/architect/return-packages/2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_3_OPTION_STATE_INVARIANTS.md
* PURPOSE: Phase 7.3 return package for option state invariants + canonical cap hold multipliers.
* OWNERSHIP: Feature: architect/cap-sheet validation
*
* HISTORY:
* * 2026-01-18: Created by plan `plans/cap-sheet-contract-rules-phase-7-3/plan.md`, chunk_n/a
*
* LINKS:
* * Plan: plans/cap-sheet-contract-rules-phase-7-3/plan.md
* * Latest Chunk: n/a (no chunks used)
 */

# Phase 7.3: Option State Invariants + Canonical Cap Hold Multiplier Source

**Date:** 2026-01-18
**Owner:** architect/cap-sheet validation
**Status:** Complete

---

## 1) Summary of Changes

* Enforced option accept/decline invariants in pipeline validation, including roster presence, option row coherence, and declined-season removal.
* Hard-blocked freeAgency.year mismatches on option decline (now deterministic).
* Declared `capHolds.ts` as the single canonical multiplier source and wired remaining references to import it.
* Added tests for option invariants and canonical multiplier usage.
* Stop conditions: none triggered.

## 2) Audit Results (Multiplier Sources + Resolution)

**Search targets:** `CAP_HOLD_MULTIPLIERS`, `1.75`, `1.30`, `1.9`, `1.2`, “Early Bird” + “cap hold”, `computeExpectedCapHoldAmount` / `calculateCapHold`.

**Findings:**

* Canonical multiplier table lives in `src/features/architect/utils/capHolds.ts` (`CAP_HOLD_MULTIPLIERS`).
* `capHoldTransitionHelpers.js` already imports `CAP_HOLD_MULTIPLIERS` for option decline expectations.
* `birdRightsRules.js` contained hard-coded `capHoldMultiplier` values (Early/Non-Bird). These now import `CAP_HOLD_MULTIPLIERS` to avoid a second table.

**Resolution:**

* `CAP_HOLD_MULTIPLIERS` is now the single authoritative table; all other references import it.

## 3) Option Transition Invariants

**Option Accept (Pipeline-Authoritative):**

* No cap hold created for the player.
* `optionUsed === true` on the option year row.
* Player remains on team roster (no roster removal).
* `salariesByYear` remains coherent (option row present for target year).

**Option Decline (Pipeline-Authoritative):**

* Cap hold created when expected, and amount matches canonical multipliers (Phase 7.2).
* Player is not rostered as a signed player for the declined option year.
* `freeAgency` is canonical object and year matches derived option year.
* Option year row removed (no contract entry for declined season).

## 4) Enforcement Details (Rules + Triggers)

**Hard blocks (new in Phase 7.3):**

* `option_accept_player_not_rostered`
* `option_accept_option_row_invalid`
* `option_decline_player_still_rostered`
* `option_decline_contract_row_still_present_for_declined_season`
* `option_decline_free_agency_year_mismatch`

**Existing hard block (Phase 7.x):**

* `cap_hold_transition_invalid` (accept creates cap hold, decline missing/invalid hold)

**Notes:**

* `validateOptionDecision` now accepts `originalTeam`, `updatedTeam`, `originalPlayer`, `updatedPlayer` for invariant checks.
* Free agency year mismatches are now hard-blocked (deterministic derivation from option season).
* If `updatedTeam.roster` is missing or non-array, roster-based invariants are skipped (documented limitation).

## 5) Files Changed

* `src/features/architect/utils/capLegalityValidation.js`
* `src/features/architect/utils/capHoldTransitionHelpers.js`
* `src/features/architect/utils/mutationPipeline.js`
* `src/features/architect/utils/playerRulesProfile/birdRightsRules.js`
* `tests/architect/capLegalityValidation.test.js`
* `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`
* `docs/architect/return-packages/2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_7_3_OPTION_STATE_INVARIANTS.md`
* `plans/cap-sheet-contract-rules-phase-7-3/plan.md`

## 6) Tests + Output

Command:

```bash
npm test -- --run tests/architect/capLegalityValidation.test.js
```

Output:

```text
> scoutzero-final2@0.0.1 test
> vitest --run tests/architect/capLegalityValidation.test.js


 RUN  v1.6.1 /Users/brenthibbitts/Desktop/ScoutZero

 ✓ tests/architect/capLegalityValidation.test.js  (116 tests) 190ms

 Test Files  1 passed (1)
      Tests  116 passed (116)
   Start at  06:21:27
   Duration  9.89s (transform 1.51s, setup 778ms, collect 1.56s, tests 190ms, environment 2.42s, prepare 412ms)
```

## 7) Build + Output

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
dist/assets/index.esm-30d3c437.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-050ce8ee.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-cb01d024.js     15.22 kB │ gzip:   5.13 kB
dist/assets/index-68e5c5bb.js          1,885.38 kB │ gzip: 551.02 kB

(!) Some chunks are larger than 500 kBs after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 44.84s
```

## 8) Master Doc Updates + Changelog Entry

* Documented canonical multiplier owner (`capHolds.ts`) and option invariants in `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`.
* Added new rule IDs to validation map + hard-block list.
* Added Phase 7.3 changelog entry.
