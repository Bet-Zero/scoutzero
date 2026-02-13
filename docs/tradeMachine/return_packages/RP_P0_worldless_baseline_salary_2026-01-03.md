# Return Package: P0 Worldless Baseline Salary + Cap Lines Correctness

**Date**: 2026-01-03  
**Task**: P0 Worldless Baseline Salary Correctness  
**Status**: ✅ COMPLETE

---

## 1. Source Map (Values → File/Function)

| Value | Source File | Function/Path |
|-------|-------------|---------------|
| **Team roster/contracts** | `src/features/architect/utils/worldTeamData.ts` | `loadWorldTeamData(null, teamId)` → falls back to `loadTeamCapSheet()` |
| **Baseline team total salary** | `src/features/architect/hooks/useTradeMachine.js` | `payrollForYearFromCapSheet(capSheet, yearKey)` + `deadMoneyForYear(capSheet, yearKey)` |
| **Player salary slice** | `src/features/architect/utils/contractUtils.js` | `getContractYearSlice(player, endYear)` |
| **Cap settings / thresholds** | `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js` | `getCapSettingsForYear(yearKey)` |
| **SalaryIn / SalaryOut** | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` | Uses `getSalaryForYear()` with matching adjustments |
| **Hard cap flag** | Team object property | `team.hardCapped` (boolean) |
| **Season dropdown value** | `src/features/architect/GMDashboard/GMDashboard.jsx` | `currentYear` (endYear integer, e.g., 2026) |
| **Season format conversion** | `src/features/architect/utils/seasonFormat.js` | `toSeasonKey()`, `toEndYear()` |

---

## 2. What Was Wrong / Verified

### Verified (No Changes Needed)

1. **Season Mapping is CORRECT**: GMDashboard uses endYear (e.g., `2026`) which correctly maps to season string `"2025-26"` via `toSeasonKey()`
2. **Cap Settings Mapping is CORRECT**: `capSettingsProvider.js` handles both endYear and season string formats
3. **Baseline Salary Computation is CORRECT**: `useTradeMachine.js` computes via `payrollForYearFromCapSheet() + deadMoneyForYear()`
4. **Worldless Fallback is CORRECT**: `loadWorldTeamData(null, teamId)` correctly falls back to `loadTeamCapSheet()`
5. **No teamPlans Leakage**: Legacy `teamPlans` functions were already removed in previous cleanup (confirmed via grep)

### What Was Added

1. Canonical `getWorldlessTeamBaselineTotal()` function for explicit worldless mode
2. Guard functions: `isValidWorldlessMode()`, `assertWorldlessMode()`
3. 37 new guardrail tests to lock this behavior
4. Section 8 documentation in master alignment doc

---

## 3. Files Changed List

### New Files Created

| File | Description |
|------|-------------|
| `src/features/architect/utils/worldlessBaselineSalary.js` | Canonical baseline salary function for worldless mode |
| `src/tests/trade/worldless_season_mapping.guardrail.test.js` | 9 tests for season mapping consistency |
| `src/tests/trade/worldless_baseline_salary.guardrail.test.js` | 18 tests for baseline salary correctness |
| `src/tests/trade/worldless_no_teamplan_leak.guardrail.test.js` | 10 tests for worldless mode assertions |

### Modified Files

| File | Change |
|------|--------|
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md` | Added Section 8: Worldless Baseline Salary |

---

## 4. New Canonical Baseline Salary Function

**Path**: `src/features/architect/utils/worldlessBaselineSalary.js`

**Signature**:

```javascript
getWorldlessTeamBaselineTotal(team, yearKey) → {
  playersTotal: number,    // Sum of player cap hits for yearKey
  deadMoneyTotal: number,  // Sum of dead money for yearKey
  baselineTotal: number,   // playersTotal + deadMoneyTotal
  meta: {
    source: string,        // 'getWorldlessTeamBaselineTotal'
    status: string,        // 'OK' | 'NO_TEAM'
    yearKey: number,       // The yearKey used
    seasonKey: string,     // The season string (e.g., "2025-26")
    playerCount: number,   // Number of players on team
  }
}
```

**Additional Exports**:

- `computePlayersTotal(players, endYear)` — Sum player cap hits
- `computeDeadMoney(capSheet, endYear)` — Sum dead money from all sources
- `isValidWorldlessMode(worldId)` — Check if worldId is null/undefined
- `assertWorldlessMode(worldId, caller)` — Warn if called with non-null worldId

---

## 5. New Tests Added

| Test File | Count | What It Asserts |
|-----------|-------|-----------------|
| `worldless_season_mapping.guardrail.test.js` | 9 | Season dropdown → yearKey → seasonKey mapping consistency |
| `worldless_baseline_salary.guardrail.test.js` | 18 | Baseline total = sum of `getContractYearSlice()` + dead money |
| `worldless_no_teamplan_leak.guardrail.test.js` | 10 | No teamPlans imports, worldless detection works correctly |
| **TOTAL** | **37** | |

---

## 6. Command Outputs

### Tests

```bash
npm run test src/tests/trade/ -- --run

 ✓ src/tests/trade/tradeMultiSurfaceOfficialValues.test.js (28)
 ✓ src/tests/trade/tradeSnapshotWiring.test.js (25)
 ✓ src/tests/trade/TradeSalaryCalculator.guardrail.test.jsx (19)
 ✓ src/tests/trade/worldless_baseline_salary.guardrail.test.js (18)
 ✓ src/tests/trade/TradeValidationGating.guardrail.test.jsx (27)
 ✓ src/tests/trade/goldenTrades.test.js (11)
 ✓ src/tests/trade/staleValidationFix.test.js (20)
 ✓ src/tests/trade/worldless_no_teamplan_leak.guardrail.test.js (10)
 ✓ src/tests/trade/worldless_season_mapping.guardrail.test.js (9)

 Test Files  9 passed (9)
      Tests  167 passed (167)
```

### Build

```bash
npm run build

vite v4.5.14 building for production...
✓ 2917 modules transformed.
✓ built in 37.13s
```

---

## 7. Manual Verification Checklist for Worldless Mode

Use this checklist to manually verify worldless mode correctness in the UI:

### Pre-Conditions

- [ ] No world selected in World Selector dropdown (worldId = null)
- [ ] Lakers (or any team) selected in Trade Machine

### Season Dropdown Verification

- [ ] Season dropdown shows format like "2025-26"
- [ ] Dropdown value is endYear (e.g., changing to "2025-26" uses yearKey=2026)
- [ ] Changing season updates all displayed totals

### Baseline Salary Verification

- [ ] "TOTAL CAP" in CapImpactTiles shows baseline total
- [ ] Baseline matches sum of: player cap hits + dead money for selected year
- [ ] No TPEs or cap holds are included in baseline total (these are separate)

### Cap/Apron Lines Verification

- [ ] CAP SPACE shows: salaryCap - projectedSalary
- [ ] 1ST APRON shows: firstApron - projectedSalary
- [ ] 2ND APRON shows: secondApron - projectedSalary
- [ ] Colors are correct: red = over, green = under

### Worldless Mode Assertions

- [ ] No world snapshot data is being used
- [ ] Team data comes from base team only
- [ ] Console shows no warnings about worldless mode violations

---

## Summary

The worldless baseline salary pipeline was **verified to be correct**. The existing implementation in `useTradeMachine.js` correctly computes baseline salary via `payrollForYearFromCapSheet() + deadMoneyForYear()`, and season mapping from UI dropdown to yearKey to cap settings is consistent.

This return package adds:

1. A **canonical function** (`getWorldlessTeamBaselineTotal`) for explicit worldless mode computation
2. **Guard functions** for detecting and asserting worldless mode
3. **37 guardrail tests** to prevent regressions in season mapping, baseline calculation, and worldless mode behavior
4. **Documentation** in Section 8 of MASTER_TRADE_MACHINE_ALIGNMENT.md

All 167 trade tests pass and the build succeeds.
