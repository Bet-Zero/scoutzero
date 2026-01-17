# Return Package: Contract Rules Phase 2 — Contract Years Min/Max Enforcement

**Date:** 2026-01-17  
**Initiative:** Cap Sheet — Contract Rules Phase 2  
**Status:** COMPLETE

---

## 1. Summary of Changes

Implemented pipeline validation for contract length (years) min/max limits based on signing mechanism. Illegal-length deals are now hard-blocked at persist time even if UI validation is bypassed.

**Key additions:**

- Added `contract_years_invalid` to `HARD_BLOCK_RULES`
- Added `SIGNING_YEARS_LIMITS` canonical table
- Added `resolveSigningMechanism(contract, signedUsing)` helper
- Added `getSigningYearsLimits(mechanism)` helper
- Updated `validateSigning` to check contract years against mechanism limits
- Two-way contracts excluded from years validation

---

## 2. Rule IDs Added

| Rule ID | Classification | Description |
|---------|----------------|-------------|
| `contract_years_invalid` | **Hard Block** | Contract length outside allowed min/max for signing mechanism |

---

## 3. How Mechanism is Resolved

**Function:** `resolveSigningMechanism(contract, signedUsing)`

**Priority:**

1. `contract.exceptionType` if present
2. `signedUsing` parameter if present
3. Returns `UNKNOWN` if neither available

**Normalization:**

- Input strings are lowercased and non-alpha characters stripped
- Maps to canonical values: `FULL_MLE`, `TPMLE`, `ROOM_MLE`, `BAE`, `MINIMUM`, `UNKNOWN`

**Examples:**

- `"MLE"` → `FULL_MLE`
- `"Taxpayer MLE"` → `TPMLE`
- `"Room MLE"` → `ROOM_MLE`
- `"BAE"` → `BAE`
- `"Minimum"` → `MINIMUM`
- `null` → `UNKNOWN`

**Fallback Behavior:**

- `UNKNOWN` mechanism → no years validation (other rules like min salary still apply)
- This ensures we don't block valid signings when mechanism can't be determined

---

## 4. Year Limits Table

**Location:** `SIGNING_YEARS_LIMITS` in `capLegalityValidation.js`

| Mechanism | minYears | maxYears | Notes |
|-----------|----------|----------|-------|
| MINIMUM | 1 | 2 | Veteran minimum contracts |
| FULL_MLE | 1 | 4 | Non-Taxpayer MLE |
| TPMLE | 1 | 2 | Taxpayer MLE (corrected from UI's 3) |
| ROOM_MLE | 1 | 2 | Room Exception MLE |
| BAE | 1 | 2 | Bi-Annual Exception |

**Note:** The UI validation (`useCapValidation.js` line 91) had Taxpayer MLE maxYears=3, but CBA rules specify 2 years max. The pipeline now uses the correct CBA value (2).

---

## 5. Two-Way Handling Decision

**Decision:** Two-way contracts are **excluded** from contract years validation.

**Rationale:**

- Two-way contracts follow separate term rules not governed by standard exception limits
- They are already excluded from minimum salary enforcement (Phase 1)
- Consistency with existing pattern in `validateSigning`

**Implementation:** Check `isTwoWay` before years validation block.

---

## 6. Files Changed/Created

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/utils/capLegalityValidation.js` | Modified | Added `contract_years_invalid` to HARD_BLOCK_RULES, added `SIGNING_YEARS_LIMITS`, `resolveSigningMechanism()`, `getSigningYearsLimits()`, updated `validateSigning` |
| `tests/architect/capLegalityValidation.test.js` | Modified | Added 9 tests for contract years validation |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Modified | Added rule to validation map, updated HARD_BLOCK_RULES list, marked G2-4 as resolved, added changelog entry |
| `docs/architect/return-packages/2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_2_CONTRACT_YEARS.md` | Created | This document |

---

## 7. Tests Added/Updated

**File:** `tests/architect/capLegalityValidation.test.js`

**New Test Suite:** `validateSigning - Contract Years Validation` (9 tests)

| Test | Description |
|------|-------------|
| `blocks MLE signing when contract exceeds max years (5-year MLE)` | 5-year MLE rejected (max 4) |
| `blocks MINIMUM signing when contract exceeds max years (3-year minimum)` | 3-year minimum rejected (max 2) |
| `blocks BAE signing when contract exceeds max years (3-year BAE)` | 3-year BAE rejected (max 2) |
| `allows MLE signing at max years (4-year MLE)` | 4-year MLE passes |
| `allows minimum signing at boundary (1-year and 2-year)` | 1yr and 2yr minimum pass |
| `excludes two-way contracts from years validation` | Two-way 3yr not blocked |
| `does not enforce years limits for unknown signing mechanism` | No mechanism → no block |
| `uses contractLength field when present` | Explicit contractLength respected |
| `confirms contract_years_invalid is a HARD_BLOCK rule` | Rule in HARD_BLOCK_RULES |

**Commands Run:**

```bash
npm test -- --run tests/architect/capLegalityValidation.test.js
```

**Results:**

```
✓ tests/architect/capLegalityValidation.test.js (31 tests) 148ms
Test Files  1 passed (1)
     Tests  31 passed (31)
```

---

## 8. Stop-Condition Issues Encountered

**None.** All stop conditions were clear:

1. ✅ Mechanism resolution: `signedUsing` and `contract.exceptionType` available in pipeline
2. ✅ Contract length: Derivable from `contract.contractLength` or `salariesByYear.length`
3. ✅ No conflicting tables: UI guardrails were reference-only; pipeline now has authoritative table

**Note:** One discrepancy found and resolved:

- UI (`useCapValidation.js`) had Taxpayer MLE maxYears=3
- CBA rules specify maxYears=2
- Pipeline uses correct CBA value (2)

---

## 9. Master Doc Updates

**File:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

| Section | Update |
|---------|--------|
| 5.2 Validation Map | Added `Contract Years Invalid` row |
| 5.3 Hard Block Rules | Added `contract_years_invalid` to list |
| 7.3 P2 Gaps | Updated G2-4 to ✅ RESOLVED (Phase 2) |
| 10 Change Log | Added Phase 2 entry |

---

## 10. Implementation Details

### Contract Years Determination

```javascript
function getContractYears(contract) {
  // Priority 1: explicit contractLength
  if (typeof contract?.contractLength === 'number' && contract.contractLength > 0) {
    return contract.contractLength;
  }
  // Priority 2: salariesByYear array length
  if (Array.isArray(contract?.salariesByYear)) {
    return contract.salariesByYear.length;
  }
  return 0;
}
```

### Validation Logic in validateSigning

```javascript
// 1.6. Contract years validation (PHASE 2 - CBA Contract Rules)
if (!isTwoWay) {
  const contractYears = getContractYears(contract);
  
  if (contractYears > 0) {
    const mechanism = resolveSigningMechanism(contract, signedUsing);
    const limits = getSigningYearsLimits(mechanism);
    
    if (limits) {
      if (contractYears < limits.minYears) {
        violations.push({ rule: 'contract_years_invalid', ... });
      } else if (contractYears > limits.maxYears) {
        violations.push({ rule: 'contract_years_invalid', ... });
      }
    }
  }
}
```

---

## 11. Future Work (Out of Scope)

- Raise limits (supermax, designated player extensions)
- Max first-year salary by Bird rights / exception
- Extension rules (Phase 3)
- Trade-specific contract rules
