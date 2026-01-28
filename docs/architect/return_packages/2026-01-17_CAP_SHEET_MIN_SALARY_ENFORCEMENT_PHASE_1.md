# Return Package: Cap Sheet Contract Rules Phase 1 — Minimum Salary Enforcement

**Date:** 2026-01-17  
**Initiative:** Cap Sheet — Contract Rules Phase 1  
**Status:** COMPLETE

---

## 1. Summary of Changes

Implemented **minimum salary enforcement** for free agent signings in the World mutation pipeline. The `validateSigning()` function now hard-blocks any signing where the first-year salary (or capHit) is below the CBA minimum for the player's years of service (YOS).

**Key outcomes:**

- Under-minimum contracts can NO LONGER be persisted into Worlds, even if UI validation is bypassed
- Two-way contracts are explicitly excluded (they follow separate salary rules)
- Missing YOS data defaults to 0 (rookie minimum applies) with deterministic behavior
- Both `salary` and `capHit` are validated when they differ (prevents cap manipulation)

---

## 2. Exact Rule Implemented

**Rule ID:** `min_salary_violation`  
**Block Type:** HARD BLOCK (never overridable)  
**Trigger Location:** `capLegalityValidation.js:validateSigning`

**Canonical Rule Logic:**

```
For a standard NBA contract signing:
  IF contract.contractType === 'two-way' THEN SKIP (excluded)
  
  LET yos = getYearsOfService(player)  // Defaults to 0 if missing
  LET minSalary = capRulesProfile.salaries.getMinimumForYOS(yos)
  
  VIOLATION IF: contract.salariesByYear[0].salary < minSalary
  
  IF capHit exists AND capHit !== salary:
    ADDITIONAL VIOLATION IF: contract.salariesByYear[0].capHit < minSalary
```

**Error Message Format:**

```
First-year salary ($X.XXM) is below CBA minimum ($Y.YYM) for Z years of service
First-year cap hit ($X.XXM) is below CBA minimum ($Y.YYM) for Z years of service
```

---

## 3. YOS Resolution (Priority Order)

The `getYearsOfService(player)` helper from `minimumSalaryRules.js` checks fields in this order:

1. `player.bio?.experience`
2. `player.bio?.yearsExperience`
3. `player.yearsOfService`
4. `player.years_of_service`
5. `player.experience`
6. `player['Years Pro']`
7. `player.bio?.['Years Pro']`
8. `player.yearsPro`
9. **Default: 0** (rookie minimum applies)

**Behavior for missing YOS:**

- Returns 0, meaning rookie minimum is used
- No warning is emitted (deterministic, expected behavior for unknown players)
- Tests confirm this behavior explicitly

---

## 4. Two-Way Handling Decision

**Decision:** Two-way contracts are **explicitly excluded** from minimum salary enforcement.

**Rationale:**

- Two-way contracts follow separate NBA salary rules not governed by the YOS minimum scale
- The `isTwoWay` flag (via `contract?.contractType?.toLowerCase() === 'two-way'`) is already computed in `validateSigning` for the two-way limit check
- Reusing this flag ensures consistent detection across all validation logic

**Implementation:**

```javascript
// 1.5. Minimum salary check (PHASE 1 - CBA Contract Rules)
// Two-way contracts are excluded - they follow separate salary rules not governed by YOS scale
if (!isTwoWay && rules) {
  // ... validation logic ...
}
```

---

## 5. Files Changed/Created

| File | Change Type | Description |
|------|-------------|-------------|
| `src/features/architect/utils/capLegalityValidation.js` | Modified | Added import for `getYearsOfService`, added `min_salary_violation` to `HARD_BLOCK_RULES`, added minimum salary validation in `validateSigning()` |
| `tests/architect/capLegalityValidation.test.js` | Modified | Added 8 new tests for minimum salary enforcement; updated 2 existing tests to use CBA-compliant salaries |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Modified | Added `min_salary_violation` to Validation Map and Hard Block Rules; added G0-4 gap resolution; updated G2-4; added changelog entry |
| `docs/architect/return_packages/2026-01-17_CAP_SHEET_MIN_SALARY_ENFORCEMENT_PHASE_1.md` | Created | This return package document |

---

## 6. Tests Added/Updated

### New Tests (8)

All in `tests/architect/capLegalityValidation.test.js`, describe block `validateSigning - Minimum Salary Enforcement`:

| Test | Purpose |
|------|---------|
| blocks signing when first-year salary is below minimum for rookie (0 YOS) | Verifies $1M < $1.164M rookie min is blocked |
| blocks signing when first-year salary is below minimum for veteran (5 YOS) | Verifies $2M < $2.912M 5-yr vet min is blocked |
| allows signing when first-year salary exactly meets minimum | Verifies exactly-min salary passes |
| allows signing when first-year salary is above minimum | Verifies above-min salary passes |
| defaults to rookie minimum (0 YOS) when player has no experience data | Verifies missing YOS → 0 YOS behavior |
| excludes two-way contracts from minimum salary enforcement | Verifies two-way with $500K is NOT blocked |
| validates capHit when different from salary | Verifies capHit below min triggers separate violation |
| confirms min_salary_violation is a HARD_BLOCK rule | Verifies rule is in HARD_BLOCK_RULES array |

### Updated Tests (2)

| Test | Change |
|------|--------|
| blocks signing when roster would exceed 15 players | Changed player to 0 YOS rookie with $2M salary (above $1.164M min) |
| allows signing when roster is under 15 players | Changed player to 0 YOS rookie with $2M salary (above $1.164M min) |

### Test Command & Results

```bash
npm test -- tests/architect/capLegalityValidation.test.js --reporter=verbose
```

**Result:** ✅ 22 tests passed (0 failed)

---

## 7. Schema Gaps Discovered

**None.** All required data was available:

- **YOS:** Resolvable via existing `getYearsOfService()` helper which checks 8+ field paths
- **Minimum salary scale:** Available via `capRulesProfile.salaries.getMinimumForYOS(yos)` which uses `MINIMUM_SALARY_SCALES` from `minimumSalaryScales.ts`
- **Season context:** `year` parameter already passed to `validateSigning()`
- **Two-way detection:** `contractType` field consistently available in contract objects

---

## 8. Master Doc Updates

### CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md

| Section | Update |
|---------|--------|
| 5.2 Validation Map | Added `Min Salary Violation` row with Hard Block type |
| 5.3 Hard Block Rules | Added `min_salary_violation` to list |
| 7.1 P0 Gap Analysis | Added G0-4 "Min salary by YOS not enforced in pipeline" marked as ✅ RESOLVED |
| 7.3 P2 Gap Analysis | Updated G2-4 to note min salary is now enforced |
| 10. Change Log | Added entry for Contract Rules Phase 1 |

### CAP_RULES_PROFILE_MASTER_DOC.md

**No updates required.** The `getMinimumForYOS` function was already documented and working correctly. This phase simply wired it into the validation pipeline.

---

## Appendix: Minimum Salary Scale Reference (2025-26)

| YOS | Minimum Salary |
|-----|----------------|
| 0 (Rookie) | $1,164,345 |
| 1 | $1,892,800 |
| 2 | $2,176,096 |
| 3 | $2,485,600 |
| 4 | $2,704,000 |
| 5 | $2,912,000 |
| 6 | $3,120,000 |
| 7 | $3,328,000 |
| 8 | $3,536,000 |
| 9 | $3,744,000 |
| 10+ | $3,952,000 |

Source: `src/features/architect/data/minimumSalaryScales.ts`
