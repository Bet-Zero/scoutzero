# PHASE 36 PREFLIGHT RETURN PACKAGE: SECOND APRON SSOT GUARDRAILS

**DATE:** 2026-01-26
**STATUS:** PREFLIGHT COMPLETE - READY FOR EXECUTION

## 1. Executive Summary

The preflight audit confirms that the strict `>` semantics for Second Apron classification are generally respected across the codebase, but are implemented via **inline comparisons** rather than the preferred `isSecondApronTeam` SSOT helper. This creates a risk of future drift.

- **SSOT Status:** ⚠️ Semantically correct (`>`) but architecturally inconsistent (7+ inline duplications).
- **Emitter Status:** ✅ Clean. The canonical salary mismatch message is emitted from a single source (`validateSalaryMatching.js`).
- **Docs Status:** ⚠️ `TRADE_MACHINE_AUDIT.md` contains references to 3 deleted/zombie files (`salaryMatching.js`, `validateSecondApronRules.js`, `aggregationValidator.js`).
- **Guardrails:** A new test file is recommended to lock in the strictly `>` boundary.

## 2. SSOT Classification Audit Table

| File Path | Function / Context | Condition Used | Classification | Main Flow? |
| :--- | :--- | :--- | :--- | :--- |
| `rules/basicRules.js` | `enforceSecondApronHandcuffs` | `teamTotalSalary > secondApron` | ⚠️ Inline Comparison | Yes |
| `rules/hardCapValidation.js` | `isSecondApronHardCap` | `teamTotalSalary > secondApron` | ⚠️ Inline Comparison | Yes |
| `rules/validateAggregation.js` | `validateAggregation` | `teamTotalSalary > secondApron` | ⚠️ Inline Comparison | Yes |
| `rules/validateSalaryMatching.js` | `validateSalaryMatching` | `totalSalary > startSecondApron` | ⚠️ Inline Comparison | Yes |
| `rules/validateStepien.js` | `validateStepien` | `teamTotalSalary > secondApron` | ⚠️ Inline Comparison | Yes |
| `rules/validateTradeExceptions.js` | `validateTradeExceptions` | `teamTotalSalary > secondApron` | ⚠️ Inline Comparison | Yes |
| `utils/salaryMargin.js` | `getDetailedApronStatus` | `payroll > secondApron` | ⚠️ Inline Comparison | Yes |
| `utils/capUtils.js` | `isSecondApronTeam` | `teamSalary > secondApron` | ✅ SSOT Definition | N/A |

**Conclusion:** No dangerous `>=` (greater than or equal) usage found for classification. However, all inline checks must be refactored to use `isSecondApronTeam` to prevent future regression.

## 3. Emitter Consolidation Audit Table

| Check String | Location | Type | Notes |
| :--- | :--- | :--- | :--- |
| `"Second apron team cannot..."` | `constants/secondApronMessages.js` | Definition | `SECOND_APRON_SALARY_MISMATCH` |
| `SECOND_APRON_SALARY_MISMATCH` | `rules/validateSalaryMatching.js` | Primary Emitter | Only explicit usage found. |

**Conclusion:** The emitter is strictly controlled. No duplication found in main execution paths.

## 4. Doc Zombie References Fix List

| Doc Path | Outdated Reference | Fix Action |
| :--- | :--- | :--- |
| `docs/TRADE_MACHINE_AUDIT.md` | `salaryMatching.js` (Line 65) | DELETE line |
| `docs/TRADE_MACHINE_AUDIT.md` | `validateSecondApronRules.js` (Line 60) | DELETE line |
| `docs/TRADE_MACHINE_AUDIT.md` | `aggregationValidator.js` (Line 52) | DELETE line |

## 5. Guardrail Recommendation

**New Test File:** `src/tests/trade/secondApron_SSOT_guardrail.test.js`

**Strategy:**

1. **Unit Test of SSOT:** Assert `isSecondApronTeam` returns `false` when `salary === secondApron`.
2. **Boundary Integration Test:**
    - Construct a mock trade context with a team exactly AT the second apron ($190M vs $190M).
    - Validation: Assert `violations` does NOT contain `SECOND_APRON_SALARY_MISMATCH` or aggregation errors.
    - Construct a mock trade context with a team $1 OVER the second apron.
    - Validation: Assert second apron restrictions trigger.

## 6. Phase 36 Execution Plan

1. **Refactor Classification Logic:**
    - Modify `basicRules.js`, `hardCapValidation.js`, `validateAggregation.js`, `validateSalaryMatching.js`, `validateStepien.js`, `validateTradeExceptions.js`, and `salaryMargin.js`.
    - Replace inline comparisons with `isSecondApronTeam(team, capSettings)`.
2. **Clean Documentation:**
    - Remove identified lines from `docs/TRADE_MACHINE_AUDIT.md`.
3. **Implement Guardrail:**
    - Create `src/tests/trade/secondApron_SSOT_guardrail.test.js` implementing the strategy above.

## 7. Stop Conditions Report

- **Ambiguity:** None. `validateTrade` flow is clear.
- **Canonical Folders:** Single `tradeMachine` folder confirmed.
- **Safety:** Deletions are strictly documentation lines. Code changes are refactors to existing safe logic.

**Ready to Proceed.**
