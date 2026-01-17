# Return Package: Contract Rules Phase 3 — Extensions (Eligibility, Term, First-Year Max, Raises)

**Date:** 2026-01-17  
**Initiative:** Cap Sheet — Contract Rules Phase 3 (Extensions) + Phase 2.5 Apron Projection Fix  
**Status:** COMPLETE

---

## 1. Summary of Changes

Implemented pipeline validation for contract extensions and patched the Phase 2.5 second apron projection calculation. Illegal extensions are now hard-blocked at persist time.

**Key additions:**

### Phase 2.5 Patch

- Fixed `validateSigning` second apron projection to use `capHit` (not `salary`) when the two differ
- Ensures incentive-laden or deferred contracts are correctly evaluated against second apron threshold

### Phase 3 Extension Validation

- Added 4 new rule IDs to `HARD_BLOCK_RULES`
- Added `EXTENSION_YEARS_LIMITS`, `EXTENSION_FIRST_YEAR_MAX_PERCENT`, `EXTENSION_MAX_RAISE_PERCENT` constants
- Added `getContractLastYearSalary(contract)` helper (exported)
- Added `getExtensionFirstYearSalary(extension)` helper (exported)
- Added `getExtensionYears(extension)` helper (exported)
- Added `validateExtensionTermsAndRaises({ player, extension, extensionTerms })` helper (exported)
- Updated `validateExtension` with Phase 3 enforcement blocks
- Two-way contracts hard-blocked from extension attempts

---

## 2. Phase 2.5 Patch Details

### Issue

In `validateSigning`, the second apron projected cap hit calculation used `salary` instead of `capHit`:

```javascript
// BEFORE (incorrect):
const contractValue = contract?.salariesByYear?.[0]?.salary || 0;
const projectedCapHit = currentCapHit + contractValue;
```

### Fix

Changed to use `capHit` with fallback to `salary`:

```javascript
// AFTER (correct):
const contractCapImpact = contract?.salariesByYear?.[0]?.capHit ?? contract?.salariesByYear?.[0]?.salary ?? 0;
const projectedCapHit = currentCapHit + contractCapImpact;
```

### Evidence

When `capHit` differs from `salary` (e.g., incentive-laden contracts), the old code would incorrectly evaluate team apron status based on salary alone. The new code ensures cap impact is correctly assessed.

**Test:** `uses capHit (not salary) for second apron projection when capHit differs (Phase 2.5 patch)`

---

## 3. Rule IDs Added

| Rule ID | Classification | Description |
|---------|----------------|-------------|
| `extension_ineligible` | **Hard Block** | Two-way contracts cannot be extended (must convert first) |
| `extension_years_invalid` | **Hard Block** | Extension length outside 1-4 years baseline |
| `extension_first_year_max_invalid` | **Hard Block** | Extension first-year salary exceeds 140% of current contract last-year salary |
| `extension_raise_invalid` | **Hard Block** | Extension year-over-year raises exceed 8% |

---

## 4. Extension Computation Methods

### Last-Year Salary (`getContractLastYearSalary`)

**Method:** Returns the last entry in `player.contract.salariesByYear` where `guaranteed !== false`.

**Fallback:** If no guaranteed years found, uses the last entry regardless of guarantee status.

**Returns:** `{ salary: number, season: string }` or `null`

```javascript
export function getContractLastYearSalary(contract) {
  if (!contract?.salariesByYear || !Array.isArray(contract.salariesByYear)) {
    return null;
  }
  
  const guaranteedYears = contract.salariesByYear.filter(y => y.guaranteed !== false);
  
  if (guaranteedYears.length === 0) {
    const lastYear = contract.salariesByYear[contract.salariesByYear.length - 1];
    if (!lastYear) return null;
    return {
      salary: lastYear.salary ?? lastYear.capHit ?? 0,
      season: lastYear.season,
    };
  }
  
  const lastGuaranteed = guaranteedYears[guaranteedYears.length - 1];
  return {
    salary: lastGuaranteed.salary ?? lastGuaranteed.capHit ?? 0,
    season: lastGuaranteed.season,
  };
}
```

### Extension First-Year Salary (`getExtensionFirstYearSalary`)

**Method:** Returns the first entry in `extension.salariesByYear`. Checks for `isExtensionSeason` flag first.

**Returns:** `{ salary: number, capHit: number, season: string }` or `null`

```javascript
export function getExtensionFirstYearSalary(extension) {
  if (!extension?.salariesByYear || !Array.isArray(extension.salariesByYear)) {
    return null;
  }
  
  const extensionYear = extension.salariesByYear.find(y => y.isExtensionSeason) 
    || extension.salariesByYear[0];
  
  if (!extensionYear) return null;
  
  const salary = extensionYear.salary ?? extensionYear.capHit ?? 0;
  return {
    salary,
    capHit: extensionYear.capHit ?? salary,
    season: extensionYear.season,
  };
}
```

### Extension Years (`getExtensionYears`)

**Method:** Uses `extension.contractLength` if present, otherwise `extension.salariesByYear.length`.

**Returns:** `number` (0 if cannot determine)

```javascript
export function getExtensionYears(extension) {
  if (typeof extension?.contractLength === 'number' && extension.contractLength > 0) {
    return extension.contractLength;
  }
  
  if (Array.isArray(extension?.salariesByYear)) {
    return extension.salariesByYear.length;
  }
  
  return 0;
}
```

---

## 5. Limits Enforced

### Extension Years

| Limit | Value | Source |
|-------|-------|--------|
| Minimum | 1 year | `EXTENSION_YEARS_LIMITS.min` |
| Maximum | 4 years | `EXTENSION_YEARS_LIMITS.max` (baseline) |

**Note:** Designated veteran extensions can be 5 years, but baseline enforcement uses 4 years as a conservative limit. When Salary Engine `extensionTerms.maxYears` is available, it takes precedence.

### First-Year Max

| Limit | Value | Source |
|-------|-------|--------|
| Maximum | 140% of last-year salary | `EXTENSION_FIRST_YEAR_MAX_PERCENT` = 1.40 |

**Formula:** `maxFirstYearSalary = lastYearSalary * 1.40`

**Note:** When Salary Engine `extensionTerms.maxFirstYearSalary` is available, it takes precedence.

### Raises

| Limit | Value | Source |
|-------|-------|--------|
| Maximum | 8% year-over-year | `EXTENSION_MAX_RAISE_PERCENT` = 0.08 |

**Formula:** `maxAllowed = prevYearSalary * 1.08`

**Note:** When Salary Engine `extensionTerms.raisePercentage` is available, it takes precedence.

---

## 6. Two-Way Handling Decision

**Decision:** Two-way contracts are **hard-blocked** from extension attempts with `extension_ineligible`.

**Rationale:**

- Two-way contracts cannot be extended per CBA rules
- Players must first convert to a standard contract before signing an extension
- This is a blocking condition, not a validation skip

**Implementation:** `validateExtension` checks `contract.contractType.toLowerCase() === 'two-way'` and returns immediately with violation.

---

## 7. Files Changed/Created

| File | Action | Description |
|------|--------|-------------|
| `src/features/architect/utils/capLegalityValidation.js` | Modified | Phase 2.5 patch (capHit projection), added 4 HARD_BLOCK_RULES, 3 constants, 4 helper functions, updated validateExtension |
| `src/features/architect/hooks/useCapValidation.js` | Unchanged | UI validation already had extension rules |
| `tests/architect/capLegalityValidation.test.js` | Modified | Added 9 new tests (1 Phase 2.5, 8 Phase 3) |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Modified | Added rules to validation map, hard block list, gap G0-7, changelog |
| `docs/architect/return-packages/2026-01-17_CAP_SHEET_CONTRACT_RULES_PHASE_3_EXTENSIONS.md` | Created | This document |

---

## 8. Tests Added/Updated

**File:** `tests/architect/capLegalityValidation.test.js`

### Phase 2.5 Test (1 test)

| Test | Description |
|------|-------------|
| `uses capHit (not salary) for second apron projection when capHit differs (Phase 2.5 patch)` | Proves capHit projection catches boundary cases that salary alone would miss |

### Phase 3 Test Suite: `validateExtension - Phase 3 Extension Validation` (8 tests)

| Test | Description |
|------|-------------|
| `blocks extension for two-way contracts` | Two-way triggers `extension_ineligible` |
| `blocks extension when years exceed max (5-year extension)` | 5 years rejected (max 4) |
| `blocks extension when first year exceeds 140% of last year salary` | 150% rejected |
| `blocks extension when raises exceed 8%` | 15% raise rejected |
| `allows extension at boundary values (4 years, 140%, 8% raises)` | Exact limits pass |
| `blocks extension when player has no contract (existing behavior)` | `no_contract` still works |
| `confirms extension rule IDs are in HARD_BLOCK_RULES` | All 4 rules in list |
| `exports extension constants correctly` | Constants exported with correct values |

**Commands Run:**

```bash
npm test -- tests/architect/capLegalityValidation.test.js --run
```

**Results:**

```
✓ tests/architect/capLegalityValidation.test.js (54 tests) 177ms
Test Files  1 passed (1)
     Tests  54 passed (54)
```

---

## 9. Master Doc Updates

**File:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

| Section | Update |
|---------|--------|
| 5.2 Validation Map | Added `Extension Ineligible`, `Extension Years Invalid`, `Extension First Year Max Invalid`, `Extension Raise Invalid` rows |
| 5.3 Hard Block Rules | Added 4 extension rule IDs with descriptions |
| 7.1 P0 Gaps | Added G0-7 as ✅ RESOLVED (Phase 3) |
| 10 Change Log | Added Phase 2.5 Patch and Phase 3 entries |

---

## 10. Stop Conditions Encountered

**None.** All required data fields were available:

- `player.contract.salariesByYear` — Last-year salary extraction ✓
- `extension.salariesByYear` — First-year salary and raise calculation ✓
- `extension.contractLength` / `salariesByYear.length` — Extension years ✓
- `year` parameter — Cap rules lookup ✓
- `contract.contractType` — Two-way detection ✓

---

## 11. Implementation Details

### validateExtension Flow (Phase 3)

```javascript
export function validateExtension({ team, player, extension, year }) {
  const violations = [];
  const warnings = [];
  const contract = player.contract;
  
  // 0. Two-way check (hard block)
  if (contract?.contractType?.toLowerCase() === 'two-way') {
    violations.push({ rule: 'extension_ineligible', ... });
    return { valid: false, violations, warnings };
  }
  
  // 1. No contract check (existing)
  if (!contract?.salariesByYear || contract.salariesByYear.length === 0) {
    violations.push({ rule: 'no_contract', ... });
    return { valid: false, violations, warnings };
  }
  
  // 2. Data confidence check (existing)
  // ...
  
  // 3. Phase 3: Terms, first-year max, and raises validation
  if (extension?.salariesByYear?.length > 0) {
    const termsValidation = validateExtensionTermsAndRaises({
      player,
      extension,
      extensionTerms: null, // Baseline rules
    });
    violations.push(...termsValidation.violations);
    warnings.push(...termsValidation.warnings);
  }
  
  // 4. Hard cap projection (existing)
  // ...
  
  return { valid: violations.length === 0, violations, warnings };
}
```

### validateExtensionTermsAndRaises Logic

```javascript
export function validateExtensionTermsAndRaises({ player, extension, extensionTerms }) {
  const violations = [];
  const warnings = [];
  
  // Extract data
  const lastYearData = getContractLastYearSalary(player.contract);
  const firstYearData = getExtensionFirstYearSalary(extension);
  const extensionYears = getExtensionYears(extension);
  
  // Determine limits (Salary Engine or baseline)
  const maxYears = extensionTerms?.maxYears ?? EXTENSION_YEARS_LIMITS.max;
  const minYears = EXTENSION_YEARS_LIMITS.min;
  const maxRaisePct = extensionTerms?.raisePercentage ?? EXTENSION_MAX_RAISE_PERCENT;
  const maxFirstYearSalary = extensionTerms?.maxFirstYearSalary 
    ?? (lastYearData?.salary ? Math.round(lastYearData.salary * EXTENSION_FIRST_YEAR_MAX_PERCENT) : null);
  
  // 1. Validate years
  if (extensionYears < minYears || extensionYears > maxYears) {
    violations.push({ rule: 'extension_years_invalid', ... });
  }
  
  // 2. Validate first-year max
  if (firstYearData?.salary > maxFirstYearSalary) {
    violations.push({ rule: 'extension_first_year_max_invalid', ... });
  }
  
  // 3. Validate raises
  for each consecutive year pair:
    if (currSalary > prevSalary * (1 + maxRaisePct)) {
      violations.push({ rule: 'extension_raise_invalid', ... });
      break; // Only first violation
    }
  
  return { violations, warnings };
}
```

---

## 12. Future Work (Out of Scope)

- Salary Engine integration for type-specific extension limits (rookie: 5 years, designated vet: 5 years)
- Supermax/All-NBA award detection for designated veteran extensions
- Extend-and-trade special cases
- Trade-restricted player extension limits (2 years, 105%)
