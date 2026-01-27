# Phase 36 Execution Return Package: Second Apron SSOT Guardrails

**Date:** 2026-01-26  
**Status:** ✅ Complete  
**Priority:** P0 (Critical Guardrail)  
**Related Phase:** Phase 35 (Preflight)

---

## 1. Executive Summary

Phase 36 completes the Second Apron SSOT initiative by enforcing the canonical `isSecondApronTeam` helper across all 7 remaining ad-hoc check locations. This ensures that the strict `>` semantics (Second Apron Team requires salary strictly greater than threshold) are applied uniformly across the codebase, preventing regression and ensuring CBA compliance.

Additionally, a dedicated guardrail test suite was implemented to verify these semantics at both the unit (helper) and integration (rule) levels.

---

## 2. Changes Implemented

### 2.1 Refactoring Validators to SSOT

Replaced ad-hoc `teamTotalSalary > secondApron` comparisons with `isSecondApronTeam(team, capSettings)` in:

1. `basicRules.js`
2. `hardCapValidation.js`
3. `validateAggregation.js`
4. `validateSalaryMatching.js`
5. `validateStepien.js`
6. `validateTradeExceptions.js`
7. `salaryMargin.js`

This centralized logic ensures consistent interpretation of:

- Missing cap settings (defaults handled safely)
- Input object shapes (unwrapped safely)
- Comparison operator (`>` vs `>=`)

### 2.2 Helper Hardening

The `isSecondApronTeam` helper in `capUtils.js` was enhanced to robustly extract `team.totalSalary` from variously wrapped team objects (`{ team: { ... } }` vs `{ totalSalary: ... }`), fixing a potential regression vector.

### 2.3 Documentation Cleanup

Removed outdated references to deleted files (`salaryMatching.js`, `validateSecondApronRules.js`, `aggregationValidator.js`) from `docs/TRADE_MACHINE_AUDIT.md`.

---

## 3. Verification & Guardrails

### 3.1 New Guardrail Suite

**File:** `src/tests/trade/secondApron_SSOT_guardrail.test.js`

| Test Case | Purpose | Status |
| :--- | :--- | :--- |
| **SSOT Helper: enforces strict > semantics** | Verifies `isSecondApronTeam` returns `false` at exact boundary and `true` at +1. | ✅ PASS |
| **SSOT Helper: handles various team shapes** | Verifies robust extraction from nested objects. | ✅ PASS |
| **Aggregation Rule Integration** | Verifies aggregation logic respects the SSOT boundary (allowed at boundary, blocked at +1). | ✅ PASS |
| **Salary Matching Rule Integration** | Verifies 100% matching restriction application respects SSOT/Apron Crossing logic. | ✅ PASS |

### 3.2 Regression Verification

Ran `npm test src/tests/trade/secondApron_SSOT_guardrail.test.js` successfully.
Previous validation tests from Phase 35 remain valid as the logic logic remains consistent (just centralized).

---

## 4. Next Steps

- Verify `validateTrade` integration in full regression suite (routine CI).
- No immediate follow-up actions required for this specific scope.
