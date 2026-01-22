/\*\*

FILE: docs/architect/return_packages/PHASE_31_MAX_SALARY_ENFORCEMENT_RETURN_PACKAGE.md
PURPOSE: Return Package for Phase 31 Max Contract Salary Enforcement
OWNERSHIP: Feature: architect/cap-sheet validation

\*TORY:

- 2026-01-23: Created Phase 31 Return Package

  *KS:
  *reflight: docs/architect/return_packages/PHASE_31_MAX_SALARY_READINESS_PREFLIGHT_RETURN_PACKAGE.md

- - Master Doc: docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md
    \*/

# Phase 31 Return Package: Max Contract Salary Enforcement

**Created:** 2026-01-23  
**Status:** ✅ COMPLETE  
**Type:** Execution

---

## 1. Objective

Add a **hard-block** validation that prevents signing contracts whose **first-year salary exceeds the player's max salary** (25% / 30% / 35% of cap based on years of service).

### CBA Rule Enforced

> - player's maximum salary is based on their years of NBA service:
> -
> - **0-6 years:** 25% of salary cap
> - **7-9 years:** 30% of salary cap
> - **10+ years:** 35% of salary cap

---

## 2. Implementation Summary

### 2.1 Files Modified

| File                                                                                                        | Change                                                                                                      |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [capLegalityValidation.js](src/features/architect/utils/capLegalityValidation.js)                           | Added `max_salary_violation` to `HARD_BLOCK_RULES` and implemented enforcement block in `validateSigning()` |
| [capLegalityValidation.test.js](src/tests/architect/capLegalityValidation.test.js)                          | Added 16 new tests covering all YOS tiers, exemptions, and edge cases                                       |
| [CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md](docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md) | Added Phase 31 changelog entry                                                                              |

### 2.2 Code Changes

#### HARD_BLOCK_RULES Addition

```javascript
export const HARD_BLOCK_RULES = [
  // ... existing rules ...
  'cap_hold_signing_violation',
  'max_salary_violation', // Phase 31: Added
];
```

#### Max Salary Check Block (Section 1.7.5)

Added ~70 lines of enforcement logic in `validateSigning()`:

-

1. **Exemption Checks:**
   - Skip for minimum signings (`signedUsing === 'minimum'`)
   - Skip for two-way contracts (`contractType === 'two-way'`)

-

1. **Max Salary Determination:**
   - Engine-first approach: Use `engineSigningTerms.maxFirstYearSalary` for Bird rights signings
   - YOS tier fallback: Calculate 25%/30%/35% of cap based on `getYearsOfService(player)`

-

1. **YOS Data Quality Safety Net:**
   - Detect unreliable YOS: `yos === 0 && !hasDraftYear && playerAge >= 25`
   - Emit warning: `max_salary_yos_unverified`
   - Use conservative 35% max (prevents false blocks for veterans with missing data)

-

1. **Violation Output:**
   - Rule: `max_salary_violation`
   - Message: Clear description of first-year salary vs max
   - Details: `{ firstYearSalary, maxSalaryAmount, maxSalarySource, yearsOfService, tierPercent }`

---

## 3. Test Results

**Command:** `npm run test -- --run src/tests/architect/capLegalityValidation.test.js`

**Result:** ✅ All 38 tests pass (22 existing + 16 new)

### Phase 31 Tests Added (16 total)

| Test ID | Description                                                        | Result  |
| ------- | ------------------------------------------------------------------ | ------- |
| MAX-1   | Allows salary exactly at 25% max for rookie (0 YOS)                | ✅ Pass |
| MAX-2   | Blocks salary exceeding 25% max for rookie (0 YOS)                 | ✅ Pass |
| MAX-3   | Allows salary at 25% max for 6-year veteran                        | ✅ Pass |
| MAX-4   | Allows salary exactly at 30% max for 7-year veteran                | ✅ Pass |
| MAX-5   | Blocks salary exceeding 30% max for 7-year veteran                 | ✅ Pass |
| MAX-6   | Allows salary at 30% max for 9-year veteran                        | ✅ Pass |
| MAX-7   | Allows salary exactly at 35% max for 10-year veteran               | ✅ Pass |
| MAX-8   | Blocks salary exceeding 35% max for 10-year veteran                | ✅ Pass |
| MAX-8b  | Allows salary at 35% max for 15-year veteran (10+ tier)            | ✅ Pass |
| MAX-9   | Minimum signing is exempt from max check                           | ✅ Pass |
| MAX-10  | Two-way signing is exempt from max check                           | ✅ Pass |
| MAX-11  | MLE signing under both exception and YOS max is valid              | ✅ Pass |
| MAX-12  | Emits warning for YOS=0 + age>=25 + no draftYear (unreliable data) | ✅ Pass |
| MAX-13  | Blocks salary over 35% even with unreliable YOS data               | ✅ Pass |
| MAX-14  | Normal enforcement when YOS=0 but draftYear exists (rookie)        | ✅ Pass |
| -       | max_salary_violation is in HARD_BLOCK_RULES list                   | ✅ Pass |

### Test Output

```
 ✓ src/tests/architect/capLegalityValidation.test.js (38)
   ✓ capLegalityValidation - Phase 19: Cap Hold / Cap Space Enforcement (22)
   ✓ capLegalityValidation - Phase 31: Max Salary Enforcement (16)
     ✓ 0-6 YOS: 25% Max Tier (3)
     ✓ 7-9 YOS: 30% Max Tier (3)
     ✓ 10+ YOS: 35% Max Tier (3)
     ✓ Exempt Signing Types (2)
     ✓ Exception Signings (1)
     ✓ YOS Data Quality Safety Net (3)
     ✓ max_salary_violation in HARD_BLOCK_RULES (1)

 Test Files  1 passed (1)
      Tests  38 passed (38)
   Duration  5.11s
```

---

## 4. Build Validation

**Command:** `npm run build`

**Result:** ✅ Build succeeds (28.92s)

```
vite v4.5.14 building for production...
✓ 2939 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index.esm-9a34316a.js          3.62 kB │ gzip:   1.56 kB
dist/assets/index-f770426b.js          1,949.96 kB │ gzip: 566.89 kB
✓ built in 28.92s
```

---

## 5. Architecture Notes

### 5.1 Max Salary Source Priority

1. **Engine First (Bird Rights):** If `engineSigningTerms.rightsType !== 'CAP_SPACE'`, use `engineSigningTerms.maxFirstYearSalary`
2. **YOS Tier Fallback:** Calculate from `getYearsOfService(player)` × cap percentage
3. **Conservative Fallback (Safety Net):** When YOS unreliable, use 35% max to prevent false blocks

### 5.2 YOS Reliability Detection

- \*nreliable YOS is detected when ALL of these are true:
- `yearsOfService === 0`
- `player.bio.draftYear` is missing/falsy
- `player.bio.age >= 25`

This pattern suggests a veteran with missing data, not a true rookie.

### 5.3 Max Salary Source Values

| Source                  | Meaning                                                  |
| ----------------------- | -------------------------------------------------------- |
| `engine_bird_rights`    | Used engine's maxFirstYearSalary for Bird rights signing |
| `yos_tier_fallback`     | Calculated from YOS tier (normal path)                   |
| `yos_tier_conservative` | Used 35% max due to unreliable YOS data                  |

---

## 6. Gaps Closed

From Phase 30 Preflight audit (P0 gap):

> **Max salary IS computed** by Salary Engine but **NOT enforced** in `validateSigning()`

✅ **Now enforced** with `max_salary_violation` hard block.

---

## 7. Documentation Updated

| Document                                     | Update                         |
| -------------------------------------------- | ------------------------------ |
| CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md | Added Phase 31 changelog entry |
| This Return Package                          | Created                        |

---

\*# 8. Checklist

-
- [x] Added `max_salary_violation` to `HARD_BLOCK_RULES`
- [x] Implemented max salary enforcement in `validateSigning()`
- [x] Engine-first approach for Bird rights max
- [x] YOS tier fallback for cap-space signings
- [x] Safety net for unreliable YOS data (warning + conservative 35%)
- [x] Exemptions: minimum signings, two-way contracts
- [x] 16 tests covering all YOS tiers, exemptions, edge cases
- [x] All 38 tests pass
- [x] Build succeeds
- [x] Master Doc changelog updated
- [x] Return Package created

---

## 9. Next Steps

Phase 31 is complete. Potential follow-up items:

1. **Future Enhancement:** Consider adding `max_salary_violation` check to `validateExtension()` for contract extensions
2. **Data Quality:** Consider adding YOS data enrichment for players flagged with `max_salary_yos_unverified` warning
3. **UI Integration:** Consider displaying max salary tier in signing modal for user awareness
