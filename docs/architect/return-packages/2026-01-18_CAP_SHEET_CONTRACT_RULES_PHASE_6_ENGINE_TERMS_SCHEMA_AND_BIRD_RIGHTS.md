# CAP SHEET CONTRACT RULES — PHASE 6 RETURN PACKAGE

**Date:** 2026-01-18  
**Topic:** Salary Engine Terms Schema (rightsType vs mechanism) + Re-Signing (Bird Rights) Enforcement  
**Owner:** architect/cap-sheet validation

---

## 1. Summary of Changes

Phase 6 addresses the critical gap where `mechanism` was being conflated with Bird rights type, causing confusion in violation messages and data interpretation.

### Key Changes

1. **Schema Clarity:** Separated `mechanism` (exception bucket) from `rightsType` (Bird rights type)
2. **Backward Compatibility Adapter:** Created `normalizeSigningTerms()` to handle legacy data
3. **Updated Validation Messaging:** Violation payloads now include both `mechanism` AND `rightsType`
4. **Pipeline-Authoritative Re-Signing:** Bird rights signings are now properly validated through the pipeline

---

## 2. Canonical SigningTerms Shape (Final)

```typescript
type SigningTerms = {
  source: 'salary_engine' | 'baseline';
  mechanism: 'FULL_MLE' | 'TPMLE' | 'ROOM_MLE' | 'BAE' | 'MINIMUM' | 'UNKNOWN' | string;
  rightsType?: 'FULL_BIRD' | 'EARLY_BIRD' | 'NON_BIRD' | 'CAP_SPACE' | 'NONE' | null;
  maxYears?: number | null;
  minYears?: number | null;
  raisePercentage?: number | null;
  maxFirstYearSalary?: number | null;
  minFirstYearSalary?: number | null;
  notes?: string;
};
```

### Field Definitions

| Field | Type | Purpose |
|-------|------|---------|
| `source` | `'salary_engine'` \| `'baseline'` | Origin of terms data |
| `mechanism` | `string` | **Exception bucket** (FULL_MLE, TPMLE, ROOM_MLE, BAE, MINIMUM, UNKNOWN) |
| `rightsType` | `string` \| `null` | **Bird rights type** (FULL_BIRD, EARLY_BIRD, NON_BIRD, CAP_SPACE, NONE) |
| `maxYears` | `number` \| `null` | Maximum contract length |
| `minYears` | `number` \| `null` | Minimum contract length |
| `raisePercentage` | `number` \| `null` | Max YoY raise percentage |
| `maxFirstYearSalary` | `number` \| `null` | Maximum first-year salary |
| `notes` | `string` | Additional context |

---

## 3. Backward Compatibility Adapter

### Function: `normalizeSigningTerms(rawTerms, options)`

**Location:** `src/features/architect/utils/capLegalityValidation.js`

### Behavior

1. **Detects Bird rights in mechanism field:** When `mechanism` contains Bird rights keywords (e.g., "Full Bird", "Early Bird", "Cap Space / Rights"), the value is moved to `rightsType`
2. **Recovers exception bucket:** When Bird rights are moved from `mechanism`, the function uses `options.fallbackMechanism` or defaults to `'UNKNOWN'`
3. **Normalizes raw strings:** Converts raw Bird rights type strings to canonical enum values

### Examples

```javascript
// Legacy (pre-Phase 6) - Bird rights in wrong field
const legacy = { 
  mechanism: 'Full Bird', 
  maxYears: 4, 
  source: 'salary_engine' 
};

// After normalization
normalizeSigningTerms(legacy) 
// => { 
//   mechanism: 'UNKNOWN', 
//   rightsType: 'FULL_BIRD', 
//   maxYears: 4, 
//   source: 'salary_engine' 
// }

// With fallback mechanism
normalizeSigningTerms(legacy, { fallbackMechanism: 'FULL_MLE' })
// => { 
//   mechanism: 'FULL_MLE', 
//   rightsType: 'FULL_BIRD', 
//   maxYears: 4, 
//   source: 'salary_engine' 
// }
```

### Keyword Detection

The following keywords trigger Bird rights detection:

- `Full Bird`
- `Early Bird`
- `Non-Bird` / `Non Bird`
- `Cap Space`
- `Bird Rights`

---

## 4. Files Changed

| File | Changes |
|------|---------|
| `src/features/architect/utils/capLegalityValidation.js` | Added JSDoc for `SigningTerms` type, `BIRD_RIGHTS_KEYWORDS` constant, `RIGHTS_TYPE_MAP` mapping, `normalizeSigningTerms()` adapter (exported), updated `buildBaseSigningTerms()` to accept `exceptionMechanism` param and set `rightsType`, updated `buildExceptionSigningTerms()` JSDoc, updated `getSigningTermsForPlayer()` to preserve `rightsType`, updated `validateSigningTermsAndRaises()` to use adapter and include `mechanism`/`rightsType`/engine values in violations, updated engine first-year max enforcement to use adapter and include payload fields |
| `tests/architect/capLegalityValidation.test.js` | Added `normalizeSigningTerms` to imports, added 13 new Phase 6 tests covering adapter, violation payloads, Bird rights enforcement, and confirmation tests |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added Section 9.6 "Signing Terms Shape (Phase 6)" with canonical type, field definitions, backward compatibility docs, and example; added changelog entry |

---

## 5. Tests Added/Updated

### New Tests (13 total)

**Phase 6: normalizeSigningTerms adapter (6 tests)**

- `converts legacy "mechanism = Full Bird" to rightsType = FULL_BIRD`
- `converts legacy "mechanism = Full Bird" with fallback to proper mechanism`
- `preserves already-correct mechanism and rightsType separation`
- `handles "Cap Space / Rights" as CAP_SPACE rightsType`
- `handles null/undefined input gracefully`
- `normalizes raw rightsType strings to canonical format`

**Phase 6: Violation payloads include mechanism + rightsType (2 tests)**

- `signing_terms_invalid violation includes mechanism and rightsType`
- `signing_raise_invalid violation includes mechanism and rightsType`

**Phase 6: Re-signing (Bird Rights) enforcement (3 tests)**

- `blocks re-signing when contractYears exceed engine maxYears (Bird rights)`
- `blocks re-signing when raises exceed engine raisePercentage (Bird rights)`
- `MINIMUM path remains unchanged (engine first-year max skip)`

**Phase 6: mechanism vs rightsType confirmation (2 tests)**

- `confirms mechanism = exception bucket (hard-block rules)`
- `confirms normalizeSigningTerms is exported for consumer use`

### Test Command Output

```
npm test -- --run tests/architect/capLegalityValidation.test.js

 ✓ tests/architect/capLegalityValidation.test.js  (95 tests) 153ms

 Test Files  1 passed (1)
      Tests  95 passed (95)
   Duration  3.23s
```

---

## 6. Build Output

```
npm run build

vite v4.5.14 building for production...
✓ 2926 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-2d63ff9c.css            73.22 kB │ gzip:  12.88 kB
dist/assets/index.esm-3f9e650c.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-34bb5263.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-cf9dcc03.js     14.87 kB │ gzip:   4.98 kB
dist/assets/index-429b63ef.js          1,877.14 kB │ gzip: 548.96 kB
✓ built in 30.73s
Exit code: 0
```

---

## 7. Master Doc Updates

### Section Added

**Section 9.6: Signing Terms Shape (Phase 6)**

- Canonical `SigningTerms` type definition
- Field definitions table with clear separation of `mechanism` vs `rightsType`
- Backward compatibility documentation
- Example usage of `normalizeSigningTerms()`

### Changelog Entry

| Date | Change |
|------|--------|
| 2026-01-18 | **Contract Rules Phase 6:** Separated `mechanism` (exception bucket) from `rightsType` (Bird rights type). Added canonical `SigningTerms` shape documentation. Created `normalizeSigningTerms()` backward-compat adapter. Updated `buildBaseSigningTerms()` and `buildExceptionSigningTerms()` to use proper field separation. Violation payloads now include both `mechanism` and `rightsType`. Re-signing (Bird rights) is now pipeline-authoritative. 13 new tests added. |

---

## 8. Confirmation Statement

✅ **mechanism = exception bucket**

- Values: `FULL_MLE`, `TPMLE`, `ROOM_MLE`, `BAE`, `MINIMUM`, `UNKNOWN`
- Used for: Determining exception amount caps, contract year limits

✅ **rightsType = Bird rights type**

- Values: `FULL_BIRD`, `EARLY_BIRD`, `NON_BIRD`, `CAP_SPACE`, `NONE`
- Used for: Determining max years, raise percentages, max first-year salary for re-signings

---

## 9. Acceptance Criteria Verification

| Criteria | Status |
|----------|--------|
| No consumer treats `mechanism` as Bird rights anymore | ✅ PASS - `normalizeSigningTerms` adapter converts legacy data |
| Validator messages cleanly separate mechanism vs rightsType | ✅ PASS - Violations include both fields in payload |
| Re-signing signings are pipeline-blocked when violating engine terms | ✅ PASS - `validateSigningTermsAndRaises` enforces |
| Tests pass + build passes | ✅ PASS - 95/95 tests, clean build |
| Backward compatibility preserved via adapter | ✅ PASS - `normalizeSigningTerms` exported and tested |

---

## END RETURN PACKAGE
