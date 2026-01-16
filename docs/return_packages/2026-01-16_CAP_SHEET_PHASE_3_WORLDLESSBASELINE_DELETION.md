# CAP SHEET PHASE 3 — WORLDLESS BASELINE SALARY DELETION

## Return Package

**Date:** 2026-01-16  
**Phase:** 3 (worldlessBaselineSalary Disposition)  
**Status:** ✅ Complete

---

## Summary

Deleted the redundant `worldlessBaselineSalary.js` module and its associated guardrail tests. This module was identified as a "parallel SSOT" risk in Phase 0 and confirmed as unused in production in Phase 0.5.

---

## A) Import Scan Results

### Search Term: `worldlessBaselineSalary`

| File | Line | Classification |
|------|------|----------------|
| `src/features/architect/utils/worldlessBaselineSalary.js` | 2 | **Definition file (DELETED)** |
| `src/tests/trade/worldless_no_teamplan_leak.guardrail.test.js` | 19, 82, 85, 86, 167 | **Test-only (DELETED)** |
| `src/tests/trade/worldless_baseline_salary.guardrail.test.js` | 20 | **Test-only (DELETED)** |

### Search Term: `getWorldlessTeamBaselineTotal`

| File | Line | Classification |
|------|------|----------------|
| `src/features/architect/utils/worldlessBaselineSalary.js` | 133, 140, 157, 197 | **Definition file (DELETED)** |
| `src/tests/trade/worldless_baseline_salary.guardrail.test.js` | 17, 49, 51, 61, 74, 86, 97, 110, 137, 207-209, 219, 237, 247, 259, 271 | **Test-only (DELETED)** |
| `src/tests/trade/worldless_no_teamplan_leak.guardrail.test.js` | 89, 161, 166, 167, 170, 182, 183 | **Test-only (DELETED)** |

### Conclusion

**NO production imports found.** All references were either:

- The module definition itself
- Guardrail tests that existed solely to cover the module
- Documentation (handled separately)

---

## B) Files Deleted

| File Path | Type |
|-----------|------|
| `src/features/architect/utils/worldlessBaselineSalary.js` | Module (203 lines) |
| `src/tests/trade/worldless_baseline_salary.guardrail.test.js` | Test |
| `src/tests/trade/worldless_no_teamplan_leak.guardrail.test.js` | Test |

**Total: 3 files deleted**

---

## C) Documentation Edits

| File | Change |
|------|--------|
| `docs/COMPONENT_INDEX.md` | Removed line 187: `utils/worldlessBaselineSalary.js` |
| `docs/architect/CAP_SHEET_MASTER_DOC.md` | Updated "Duplicate Computation Risks" table to mark as **DELETED in Phase 3** |
| `docs/architect/CAP_SHEET_MASTER_DOC.md` | Updated disposition note to confirm deletion |

### Note: Documentation not modified (retained as historical record)

The following docs reference the file but were NOT modified since they are:

- Return packages from previous phases (historical)
- Other historical documentation

| File | Reason for retention |
|------|---------------------|
| `docs/tradeMachine/MASTER_TRADE_MACHINE_ALIGNMENT.md` | Historical file map |
| `docs/tradeMachine/return-packages/RP_P0_worldless_baseline_salary_*.md` | Historical return package |
| `docs/return_packages/2026-01-16_CAP_SHEET_PHASE_*.md` | Prior phase return packages |
| `docs/architect/return-packages/RP_CAP_SHEET_DATA_DOCTRINE_PREFLIGHT.md` | Historical preflight doc |
| `docs/components/ArchitectHierarchy.md` | Auto-generated hierarchy |

---

## D) Validation Results

| Check | Result |
|-------|--------|
| `grep "worldlessBaselineSalary" src/` | ✅ **0 matches** |
| Build (`npm run build`) | ✅ Passed (53.62s) |
| Dead Money Tests (7 tests) | ✅ All passed |

### Build Output

```
vite v4.5.14 building for production...
✓ 2922 modules transformed.
✓ built in 53.62s
```

### Test Output

```
✓ src/tests/architect/capTotals/deadMoney.test.js (7)
  ✓ computeTeamCapTotals - Dead Money Schema Compatibility (7)
    ✓ Case A: Supports NEW schema (deadCap array with amountByYear array)
    ✓ Case B: Supports LEGACY schema (waivedContracts with amountByYear object)
    ✓ Case C: PRECEDENCE - deadCap overrides legacy sources if present for year
    ✓ Case D: FALLBACK - Uses legacy when deadCap is missing or has no entries for year
    ✓ Case E: EXPLICIT ZERO - deadCap 0 entry overrides legacy non-zero
    ✓ Handles missing or empty dead money fields gracefully
    ✓ Handles no-match year correctly

Test Files  1 passed (1)
Tests       7 passed (7)
```

---

## E) Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| 0 grep matches for `worldlessBaselineSalary` in src/ | ✅ |
| 0 grep matches for `getWorldlessTeamBaselineTotal` in src/ | ✅ |
| Deleted files are gone | ✅ |
| Tests pass | ✅ |
| Build passes | ✅ |

---

## F) Unexpected Findings

**None.** The deletion was clean with no production dependencies.

---

## G) Phase Summary

**Before Phase 3:**

- 5+ duplicate implementations of cap math existed
- `worldlessBaselineSalary.js` was a "parallel SSOT" risk

**After Phase 3:**

- `computeTeamCapTotals.js` is the sole SSOT for cap totals
- All duplicate computation paths have been eliminated or neutralized:
  - `salaryUtils.js` → SSOT wrappers (Phase 2)
  - `useTradeMachine.js` → Uses SSOT (Phase 2)
  - `worldlessBaselineSalary.js` → **DELETED (Phase 3)**
  - `CapSheet.jsx` → Uses SSOT (Phase 1)
  - `CapImpactTiles.jsx` → Uses SSOT (verified Phase 0.5)
