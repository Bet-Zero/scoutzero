# Return Package: Contract Rules Phase 2.5 — First-Year Max + Second Apron Minimum-Only

**Date:** 2026-01-17  
**Initiative:** Cap Sheet — Contract Rules Phase 2.5  
**Status:** COMPLETE

---

## 1. Summary of Changes

Implemented pipeline validation for first-year salary maximums by signing mechanism and second apron minimum-only restrictions. Over-exception deals and above-minimum signings at second apron are now hard-blocked at persist time.

**Key additions:**

- Added `first_year_max_invalid` to `HARD_BLOCK_RULES`
- Added `second_apron_minimum_only` to `HARD_BLOCK_RULES`
- Added `getFirstYearAmounts(contract)` helper (internal)
- Added `getSigningFirstYearMax(mechanism, rules)` helper (exported)
- Updated `validateSigning` with two new enforcement blocks (sections 1.7 and 1.8)
- Two-way contracts excluded from both new validations
- Fixed UI parity: TPMLE maxYears changed from 3 to 2 in `useCapValidation.js`

---

## 2. Rule IDs Added

| Rule ID | Classification | Description |
|---------|----------------|-------------|
| `first_year_max_invalid` | **Hard Block** | First-year salary exceeds mechanism max OR MINIMUM contract above min salary |
| `second_apron_minimum_only` | **Hard Block** | Teams at/above second apron can only sign to minimum salary |

---

## 3. Mechanism Resolution Inputs

Uses existing `resolveSigningMechanism(contract, signedUsing)` from Phase 2:

**Priority:**

1. `contract.exceptionType` if present
2. `signedUsing` parameter if present
3. Returns `UNKNOWN` if neither available

**Canonical Values:** `FULL_MLE`, `TPMLE`, `ROOM_MLE`, `BAE`, `MINIMUM`, `UNKNOWN`

**Behavior for Each Rule:**

- `first_year_max_invalid`: Only enforces for known mechanisms (skip UNKNOWN)
- `second_apron_minimum_only`: Applies regardless of mechanism (even UNKNOWN)

---

## 4. First-Year Max Table

**Function:** `getSigningFirstYearMax(mechanism, rules)`

| Mechanism | Max Source Field | 2025-26 Value | Notes |
|-----------|------------------|---------------|-------|
| FULL_MLE | `rules.exceptions.fullMLE` | $14,104,000 | Non-Taxpayer MLE |
| TPMLE | `rules.exceptions.taxpayerMLE` | $5,685,000 | Taxpayer MLE |
| ROOM_MLE | `rules.exceptions.roomMLE` | $8,781,000 | Room Exception |
| BAE | `rules.exceptions.bae` | $5,135,000 | Bi-Annual Exception |
| MINIMUM | `rules.salaries.getMinimumForYOS(yos)` | Varies by YOS | Enforces exactness (not above) |
| UNKNOWN | N/A (null) | — | No max enforced |

**MINIMUM Exactness Logic:**

- For MINIMUM mechanism, salary must be **exactly equal** to the YOS-based minimum
- Salary above minimum with MINIMUM mechanism triggers `first_year_max_invalid`
- This enforces "minimum exception = minimum salary" semantics

---

## 5. Second Apron Minimum-Only Logic

**Condition:** `projectedCapHit >= rules.cap.secondApron`

Where: `projectedCapHit = team.totals.capHit + contract.salariesByYear[0].salary`

**Enforcement:**

- If team is at/above second apron after signing:
  - First-year salary must be <= minimum salary for player's YOS
  - First-year capHit must be <= minimum salary for player's YOS
- Violation triggers `second_apron_minimum_only`

**Why This Approach:**

- Second apron teams can ONLY sign minimum contracts (CBA 2023)
- This rule applies regardless of what exception is claimed
- Even if `signedUsing` is unknown, we enforce the spending cap
- Uses projected cap (current + new contract) to catch boundary cases

---

## 6. Two-Way Handling Decision

**Decision:** Two-way contracts are **excluded** from both new rules.

**Rationale:**

- Two-way contracts don't count against the standard salary cap
- They have separate salary rules not governed by exception limits
- Consistent with Phase 1 (min salary) and Phase 2 (contract years) handling

**Implementation:** Both validation blocks check `if (!isTwoWay && rules)` before enforcement.

---

## 7. Files Changed/Created

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/utils/capLegalityValidation.js` | Modified | Added 2 new HARD_BLOCK_RULES, `getFirstYearAmounts()`, `getSigningFirstYearMax()`, sections 1.7 and 1.8 in validateSigning |
| `src/features/architect/hooks/useCapValidation.js` | Modified | Fixed TPMLE maxYears: 3 → 2 |
| `tests/architect/capLegalityValidation.test.js` | Modified | Added 14 new tests (2 test suites) |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Modified | Added rules to validation map, hard block list, gaps G0-5/G0-6, changelog |
| `docs/architect/return_packages/2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_2_5_FIRST_YEAR_MAX.md` | Created | This document |

---

## 8. Tests Added/Updated

**File:** `tests/architect/capLegalityValidation.test.js`

### Test Suite 1: `validateSigning - First Year Max Enforcement` (8 tests)

| Test | Description |
|------|-------------|
| `blocks FULL_MLE signing when first-year salary exceeds fullMLE amount` | $15M rejected (max $14.104M) |
| `blocks TPMLE signing when first-year salary exceeds taxpayerMLE amount` | $6M rejected (max $5.685M) |
| `blocks BAE signing when first-year salary exceeds bae amount` | $5.5M rejected (max $5.135M) |
| `blocks ROOM_MLE signing when first-year salary exceeds roomMLE amount` | $9M rejected (max $8.781M) |
| `blocks MINIMUM signing when first-year salary exceeds minimum (exactness check)` | $2M rejected for rookie using MINIMUM |
| `allows signing at exactly the exception max` | $14.104M MLE passes |
| `excludes two-way contracts from first-year max enforcement` | Two-way not checked |
| `confirms first_year_max_invalid is a HARD_BLOCK rule` | Rule in list |

### Test Suite 2: `validateSigning - Second Apron Minimum Only` (6 tests)

| Test | Description |
|------|-------------|
| `blocks above-second-apron signing when salary exceeds minimum (even UNKNOWN mechanism)` | $2M blocked at second apron |
| `allows above-second-apron signing when salary exactly equals minimum` | $1.164M passes at second apron |
| `allows below-second-apron signing at any valid salary` | $10M passes below second apron |
| `excludes two-way contracts from second apron minimum-only rule` | Two-way not checked |
| `uses projected cap hit (current + contract) for apron check` | Boundary case caught |
| `confirms second_apron_minimum_only is a HARD_BLOCK rule` | Rule in list |

**Commands Run:**

```bash
npm test -- tests/architect/capLegalityValidation.test.js
```

**Results:**

```
✓ tests/architect/capLegalityValidation.test.js (45 tests) 242ms
Test Files  1 passed (1)
     Tests  45 passed (45)
```

---

## 9. UI Parity Fix

**File:** `src/features/architect/hooks/useCapValidation.js`

**Change:** Line 91, `exceptionGuardrails['Taxpayer MLE'].maxYears`

| Before | After |
|--------|-------|
| `maxYears: 3` | `maxYears: 2` |

**Reason:** CBA rules specify Taxpayer MLE max is 2 years, not 3. The pipeline `SIGNING_YEARS_LIMITS.TPMLE` was already correct at 2. This change aligns UI hints with the authoritative pipeline validation.

**Tests:** UI validation is a convenience hint; no separate tests required. Pipeline tests cover the canonical behavior.

---

## 10. Master Doc Updates

**File:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

| Section | Update |
|---------|--------|
| 5.2 Validation Map | Added `First Year Max Invalid` and `Second Apron Minimum Only` rows |
| 5.3 Hard Block Rules | Added `first_year_max_invalid` and `second_apron_minimum_only` to list |
| 7.1 P0 Gaps | Added G0-5 and G0-6 as ✅ RESOLVED (Phase 2.5) |
| 10 Change Log | Added Phase 2.5 entry |

---

## 11. Implementation Details

### First-Year Amounts Extraction

```javascript
function getFirstYearAmounts(contract) {
  const firstYear = contract?.salariesByYear?.[0];
  const salary = firstYear?.salary ?? null;
  const capHit = firstYear?.capHit ?? salary; // fallback to salary
  return { salary, capHit };
}
```

### First-Year Max Lookup

```javascript
export function getSigningFirstYearMax(mechanism, rules) {
  if (!rules?.exceptions) return null;
  switch (mechanism) {
    case 'FULL_MLE': return rules.exceptions.fullMLE;
    case 'TPMLE': return rules.exceptions.taxpayerMLE;
    case 'ROOM_MLE': return rules.exceptions.roomMLE;
    case 'BAE': return rules.exceptions.bae;
    default: return null; // MINIMUM and UNKNOWN
  }
}
```

### Validation Logic (Section 1.7)

```javascript
// 1.7. First-year max enforcement (PHASE 2.5)
if (!isTwoWay && rules) {
  const { salary, capHit } = getFirstYearAmounts(contract);
  if (salary !== null) {
    const mechanism = resolveSigningMechanism(contract, signedUsing);
    if (mechanism === 'MINIMUM') {
      const minSalary = rules.salaries.getMinimumForYOS(yos);
      if (salary > minSalary) {
        violations.push({ rule: 'first_year_max_invalid', ... });
      }
    } else {
      const max = getSigningFirstYearMax(mechanism, rules);
      if (max !== null && salary > max) {
        violations.push({ rule: 'first_year_max_invalid', ... });
      }
    }
  }
}
```

### Validation Logic (Section 1.8)

```javascript
// 1.8. Second apron minimum-only enforcement (PHASE 2.5)
if (!isTwoWay && rules) {
  const projectedCapHit = currentCapHit + contractValue;
  const isAboveSecondApron = projectedCapHit >= rules.cap.secondApron;
  
  if (isAboveSecondApron) {
    const minSalary = rules.salaries.getMinimumForYOS(yos);
    if (salary > minSalary) {
      violations.push({ rule: 'second_apron_minimum_only', ... });
    }
  }
}
```

---

## 12. Future Work (Out of Scope)

- Raise limits enforcement (5% cap space, 8% bird rights raises)
- Max salary by Bird rights type
- Extension max salary rules (Phase 3)
- Trade-specific contract rules
