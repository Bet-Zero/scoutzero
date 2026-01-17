# Return Package: Cap Sheet Contract Rules Phase 3.25

## Extension Baseline Fix + Salary Engine Wiring

**Date:** 2026-01-17  
**Status:** COMPLETE  
**Initiative:** Cap Sheet Contract Rules Phase 3.25  
**Master Doc:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## 1. Summary of Changes

Phase 3.25 corrects the extension first-year max baseline from **140% to 120%** and wires in Salary Engine extension terms so type-specific rules (rookie scale, designated veteran, veteran) properly override the baseline when available.

### Key Changes

1. **Baseline Constant Fix**: Changed `EXTENSION_FIRST_YEAR_MAX_PERCENT` from `1.40` to `1.20`
2. **Salary Engine Wiring**: Added `getExtensionTermsForPlayer()` helper that calls `computePlayerRulesProfile`
3. **Extension Validation Update**: `validateExtension` now calls the helper and passes `extensionTerms` to `validateExtensionTermsAndRaises`
4. **Tests Updated**: 3 new tests added, existing tests updated to reflect 120% baseline

---

## 2. Exact Baseline Rule After Fix

**Constant:** `EXTENSION_FIRST_YEAR_MAX_PERCENT = 1.20` (120%)

**Location:** `src/features/architect/utils/capLegalityValidation.js` (line ~104)

**Behavior:**

- When Salary Engine returns `extensionTerms.maxFirstYearSalary`, that value is used
- When Salary Engine returns `null` (player not eligible or missing data), the 120% baseline is applied
- 120% is a conservative baseline that catches clearly invalid extensions while allowing Salary Engine to provide type-specific maxes (e.g., 140% for veteran extensions, 25-35% of cap for rookie extensions)

---

## 3. Evidence: Salary Engine Terms Now Used

### Call Site

**File:** `src/features/architect/utils/capLegalityValidation.js`  
**Function:** `validateExtension()`  
**Lines:** ~1232-1245

```javascript
// 2. PHASE 3.25: Validate extension terms, first-year max, and raises
// Now wires in Salary Engine extensionTerms when available.
// Baseline (120% first-year max, 8% raises, 4-year max) used when engine unavailable.
if (extension?.salariesByYear?.length > 0) {
  // Try to get type-specific terms from Salary Engine
  const engineResult = getExtensionTermsForPlayer({ player, team, year });
  const extensionTerms = engineResult?.extensionTerms ?? null;
  
  const termsValidation = validateExtensionTermsAndRaises({
    player,
    extension,
    extensionTerms, // Uses engine terms when available, baseline when not
  });
  
  violations.push(...termsValidation.violations);
  warnings.push(...termsValidation.warnings);
}
```

### Data Shape: extensionTerms

When Salary Engine returns terms, the shape is:

```typescript
interface ExtensionTerms {
  maxYears: number;               // e.g., 5 for designated vet
  maxFirstYearSalary: number;     // e.g., $14M for 140% of $10M
  minFirstYearSalary: number;     // e.g., $10M current salary
  raisePercentage: number;        // e.g., 0.08 for 8%
  extensionType: string;          // e.g., "Veteran Extension"
  basedOn: string;                // e.g., "140% of salary or average salary"
  notes: string;                  // Additional context
}
```

---

## 4. Files Changed

| File | Changes |
|------|---------|
| `src/features/architect/utils/capLegalityValidation.js` | Constant fix (1.40→1.20), added `getExtensionTermsForPlayer()` helper, wired extensionTerms into `validateExtension`, updated docstrings, added import for `computePlayerRulesProfile`, added export for new helper |
| `tests/architect/capLegalityValidation.test.js` | Updated constant test (1.40→1.20), added 125% blocking test, added exactly 120% test, added engine override test, updated existing tests to use 120% values, added `validateExtensionTermsAndRaises` to imports |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Updated `extension_first_year_max_invalid` description (140%→120% baseline), added Phase 3.25 changelog entry |

---

## 5. Tests

### Test Command

```bash
npm test -- tests/architect/capLegalityValidation.test.js
```

### Test Results

```
 ✓ tests/architect/capLegalityValidation.test.js  (57 tests) 247ms

 Test Files  1 passed (1)
      Tests  57 passed (57)
```

### New/Updated Phase 3.25 Tests

| Test Name | Purpose |
|-----------|---------|
| `exports extension constants correctly (Phase 3.25: baseline is now 120%)` | Verifies `EXTENSION_FIRST_YEAR_MAX_PERCENT === 1.20` |
| `blocks extension at 125% of last-year salary under 120% baseline (Phase 3.25)` | Confirms 125% is blocked (would have passed under 140%) |
| `allows extension at exactly 120% of last-year salary (Phase 3.25 baseline)` | Confirms exactly 120% is allowed |
| `validateExtensionTermsAndRaises uses engine maxFirstYearSalary when provided (Phase 3.25)` | Confirms engine terms override baseline (135% passes with 140% engine max, fails with 120% baseline) |

### Updated Existing Tests

| Test Name | Change |
|-----------|--------|
| `blocks extension when first year exceeds max` | Updated description to clarify 150% exceeds any max |
| `blocks extension when raises exceed 8%` | Changed first-year from 140% to 120% to stay within baseline |
| `allows extension at baseline boundary values` | Updated description to mention 120% baseline |

---

## 6. Documentation Updates

### CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md

**Section 5.3 Rule Code Reference:**

- Updated `extension_first_year_max_invalid` description from "140%" to "120% baseline (Salary Engine overrides when available)"

**Section 9 Changelog:**

- Added entry for Phase 3.25 documenting the baseline fix and engine wiring

---

## 7. STOP Conditions

**None encountered.**

The implementation was straightforward because:

- `computePlayerRulesProfile` is already exported from `playerRulesProfile/index.js`
- `validateExtension` receives all inputs needed (player, team, year) to call the Salary Engine
- No major refactors required - just wiring existing pure functions together

---

## 8. Verification Checklist

- [x] `EXTENSION_FIRST_YEAR_MAX_PERCENT` changed to `1.20`
- [x] Docstrings updated to mention "120% baseline"
- [x] `getExtensionTermsForPlayer()` helper added
- [x] `validateExtension` wired to use engine terms
- [x] All 57 tests pass
- [x] New tests verify 120% baseline enforcement
- [x] New test verifies engine override behavior
- [x] Master doc updated with changelog entry
- [x] No linter errors
