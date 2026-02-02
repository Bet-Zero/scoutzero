# PHASE 77 — Season Advance Totals SSOT + Persist→Reload Parity — EXECUTION RETURN PACKAGE

**Date:** 2026-02-01  
**Phase:** 77  
**Mode:** EXECUTION  
**Master Doc (SSOT):** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## SUMMARY

Phase 77 eliminated the final legacy totals computation path in the season advance workflow. The `seasonManager.js` module now uses the canonical SSOT function `computeTeamCapTotals()` from `@/features/architect/utils/capTotals` instead of the deprecated `updateTeamCapTotals()` from `tradeManager.js`.

### Key Changes

1. **Import added:** `computeTeamCapTotals` imported from capTotals barrel
2. **Legacy removed:** Dynamic imports of `updateTeamCapTotals` from `tradeManager` eliminated
3. **SSOT wired:** Both `processTeamSeasonTransition()` and `processTeamSeasonTransitionWithOptions()` now call `computeTeamCapTotals(updatedTeam, toYear)`
4. **Ordering preserved:** Totals recompute runs AFTER TPE expiry (Phase 53) and non-TPE reset (Phase 76)
5. **yearKey correct:** Uses `toYear` (target season end year) for accurate cap rules lookup

---

## FILES CHANGED

### Modified

| File                                            | Change                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/features/architect/utils/seasonManager.js` | Added `computeTeamCapTotals` import from capTotals; replaced 2 `updateTeamCapTotals` calls with SSOT; updated HISTORY comment |

### Created

| File                                                                                                                   | Purpose                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.js`                      | 21 guardrail tests for source scan, behavioral, parity, edge cases, and ordering invariants |
| `docs/architect/return_packages/PHASE_77_SEASON_ADVANCE_TOTALS_SSOT_PERSIST_RELOAD_PARITY_EXECUTION_RETURN_PACKAGE.md` | This return package                                                                         |

### Updated Docs

| File                                                          | Change                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added Phase 77 HISTORY entry                                                    |
| `docs/architect/contracts/PERSISTENCE_CONTRACTS.md`           | Added Phase 77 section describing season advance totals SSOT + parity invariant |

---

## WHAT WAS REMOVED/REPLACED

### Legacy Code Removed

1. **Dynamic import pattern (2 locations):**

   ```javascript
   // BEFORE (legacy)
   const { updateTeamCapTotals } = await import('./tradeManager');
   updatedTeam.totals = await updateTeamCapTotals(updatedTeam);

   // AFTER (SSOT)
   updatedTeam.totals = computeTeamCapTotals(updatedTeam, toYear);
   ```

2. **Locations fixed:**
   - `processTeamSeasonTransition()` (line ~229)
   - `processTeamSeasonTransitionWithOptions()` (line ~1000)

### Why This Matters

- `updateTeamCapTotals()` was a simplified totals calculation that lacked several SSOT fields
- SSOT `computeTeamCapTotals()` includes: `incompleteChargesTotal`, `totalCapAllocations`, `deltas`, `_meta`
- Consistent totals across all mutation pathways (trade, signing, season advance)

---

## TEST OUTPUTS

### Phase 77 Tests (21 tests)

```
✓ Phase 77: Source Scan Guardrails (4)
  ✓ TEST 1: seasonManager.js imports computeTeamCapTotals from capTotals
  ✓ TEST 2: seasonManager.js calls computeTeamCapTotals during season transition
  ✓ TEST 3: seasonManager.js does NOT call updateTeamCapTotals (except in comments)
  ✓ TEST 3b: seasonManager.js does NOT import from tradeManager for totals

✓ Phase 77: Season Advance Totals Behavioral Tests (5)
  ✓ TEST 4: Season advance recomputes totals for the new year (correct yearKey)
  ✓ TEST 5: incompleteChargesTotal is present with <14 standard players
  ✓ TEST 5b: incompleteChargesTotal is 0 with >=14 standard players
  ✓ TEST 6: Totals match computeTeamCapTotals(team, toYearKey) output
  ✓ TEST 6b: SSOT totals include all canonical fields

✓ Phase 77: Persist→Reload Parity Tests (5)
  ✓ TEST 7: Persist → reload yields identical team.totals object (deep equality)
  ✓ TEST 7b: Persist → reload preserves _meta if present
  ✓ TEST 8: Persist → reload yields identical non-TPE exceptions state (Phase 76 parity)
  ✓ TEST 9: TPE array unchanged by totals recompute (regression)
  ✓ TEST 9b: Non-TPE reset does not affect TPE array (Phase 76 regression)

✓ Phase 77: Edge Cases (4)
  ✓ TEST 10: Handles team with empty roster
  ✓ TEST 11: Handles team with no existing totals
  ✓ TEST 12: Handles team with dead cap entries
  ✓ TEST 13: Handles team with cap holds

✓ Phase 77: Ordering Invariants (3)
  ✓ TEST 14: Source confirms totals recompute runs AFTER TPE expiry processing
  ✓ TEST 15: Source confirms totals recompute runs AFTER non-TPE reset
  ✓ TEST 16: Source confirms totals recompute comment references Phase 77

Test Files: 1 passed (1)
Tests: 21 passed (21)
Duration: 5.58s
```

### Full Architect Suite (715 tests)

```
Test Files: 48 passed (48)
Tests: 715 passed (715)
Duration: 61.74s
```

### Build Output

```
✓ built in 28.91s
dist/index.html                   0.60 kB
dist/assets/index-aa05dc64.css   76.62 kB
dist/assets/seasonManager-*.js   19.52 kB
dist/assets/index-*.js        2,031.76 kB
```

---

## ACCEPTANCE CRITERIA CHECKLIST

| AC  | Description                              | Status                                                                            |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| AC1 | No legacy totals in season advance       | ✅ PASS - `updateTeamCapTotals()` calls removed; only in comments                 |
| AC2 | SSOT-correct totals after season advance | ✅ PASS - Tests verify `yearKey`, `incompleteChargesTotal`, `totalCapAllocations` |
| AC3 | Persist→Reload parity                    | ✅ PASS - JSON serialize/deserialize produces identical totals                    |
| AC4 | Guardrail tests exist and pass           | ✅ PASS - 21 tests in Phase 77 file, all green                                    |
| AC5 | Full architect suite passes              | ✅ PASS - 715/715 tests passing                                                   |
| AC6 | Build passes                             | ✅ PASS - `npm run build` completes successfully                                  |
| AC7 | Docs updated + return package written    | ✅ PASS - Master Doc, Persistence Contracts, and this package                     |

---

## INVARIANTS ESTABLISHED

### Season Advance Totals SSOT Invariant

> **After season advance, `team.totals` MUST equal `computeTeamCapTotals(team, toYear)` output.**

This invariant ensures:

- Consistent totals computation across all mutation pathways
- Correct yearKey (target season end year)
- All SSOT fields present: `incompleteChargesTotal`, `totalCapAllocations`, `deltas`, `_meta`

### Persist→Reload Parity Invariant

> **Persisted teams reload with identical `team.totals` object (JSON deep equality).**

This invariant ensures:

- No hidden normalization steps rewrite totals on reload
- What you persist is what you get back
- Exception state unchanged by totals recompute

### Ordering Invariant (Season Transition)

> **In `processTeamSeasonTransitionWithOptions()`, the order is:**
>
> 1. TPE expiry (Phase 53)
> 2. Non-TPE exception reset (Phase 76)
> 3. **Totals recompute (Phase 77)**
> 4. Persist

This ordering ensures totals reflect post-transition state including exception changes.

---

## STOP CONDITIONS

None triggered. All implementation proceeded cleanly.

- ✅ STOP-1 NOT TRIGGERED: No circular dependency from `computeTeamCapTotals` import
- ✅ STOP-2 NOT TRIGGERED: Totals are persisted to team docs (mutation pipeline behavior)
- ✅ STOP-3 NOT TRIGGERED: No normalization step rewrites totals on reload

---

## CAVEATS / FOLLOW-UPS

### Caveats

1. **`updateTeamCapTotals()` still exists in `tradeManager.js`**: It has a deprecation comment but is not deleted. Other code paths may still use it. Phase 72 added the deprecation comment.

2. **`processTeamSeasonTransition()` is a simpler legacy function**: It's used by `processSeasonTransition()` which is a lower-level API. The main user-facing function is `advanceSeasonInWorld()` which calls `processTeamSeasonTransitionWithOptions()`.

### Potential Follow-Ups

1. **Delete `updateTeamCapTotals()` entirely**: Once confirmed no other callers exist, remove the function from `tradeManager.js`.

2. **Audit other `updateTeamCapTotals` callers**: grep_search showed it's still used in 4 places within `tradeManager.js` itself. These may need Phase 78+ work.

---

## VALIDATION COMMANDS USED

```bash
# Phase 77 tests
npm run test -- --run src/tests/architect/phase77_season_advance_totals_ssot_persist_reload_parity_guardrails.test.js

# Full architect suite
npm run test -- --run src/tests/architect/

# Build
npm run build
```

---

**End of Phase 77 Return Package**
