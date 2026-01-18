# CAP SHEET CONTRACT RULES PHASE 4.5 — Bird Rights / First-Year Max

**Date:** 2026-01-18  
**Status:** ✅ Complete

---

## 1. Summary of Changes

- Added `signing_first_year_engine_max_invalid` to `HARD_BLOCK_RULES`
- Updated engine first-year max enforcement in `validateSigning()` to use new rule ID
- Enhanced violation messages with rights type info from engine terms
- Added 6 new Phase 4.5 tests
- Updated master doc with new rule in Validation Map, Hard Block Rules, and Changelog

---

## 2. New Rule ID

| Rule ID | Location | Description |
|---------|----------|-------------|
| `signing_first_year_engine_max_invalid` | `capLegalityValidation.js:validateSigning` | Blocks signing when first-year salary or capHit exceeds Salary Engine `maxFirstYearSalary` |

**Co-existence:** This rule operates alongside `first_year_max_invalid` (Phase 2.5 fallback exception caps). Engine max wins when lower than fallback.

---

## 3. Engine Term Shape Used

```javascript
{
  maxFirstYearSalary: number | null,  // Used for enforcement
  mechanism: string,                  // Bird rights type / exception
  source: 'salary_engine' | 'baseline', // Must be 'salary_engine' to enforce
  notes?: string                       // Included in violation message
}
```

**Enforcement triggers when:**

- `source === 'salary_engine'`
- `maxFirstYearSalary` is a valid number
- Contract is NOT two-way
- Mechanism is NOT MINIMUM (MINIMUM has exactness check via `first_year_max_invalid`)

---

## 4. Enforcement Logic

```
If engineSigningTerms.source === 'salary_engine' AND maxFirstYearSalary exists:
  If salary > maxFirstYearSalary → violation
  If capHit exists AND capHit ≠ salary AND capHit > maxFirstYearSalary → violation
```

**Interaction with Phase 2.5:**

- Phase 2.5 `first_year_max_invalid` uses fallback exception caps (FULL_MLE, TPMLE, etc.)
- Phase 4.5 `signing_first_year_engine_max_invalid` uses Salary Engine max
- Both can produce violations independently
- Engine max can be lower than fallback (e.g., Bird rights constraints)

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/features/architect/utils/capLegalityValidation.js` | Added rule to HARD_BLOCK_RULES, updated enforcement to use new rule ID |
| `tests/architect/capLegalityValidation.test.js` | Added 6 Phase 4.5 tests |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added to Validation Map, Hard Block Rules, Changelog |

---

## 6. Tests

### New Tests (6)

1. `blocks when engine max is lower than fallback exception cap`
2. `allows signing at exact engine boundary`
3. `uses capHit when capHit differs from salary`
4. `skips engine enforcement when engine terms are unavailable`
5. `confirms signing_first_year_engine_max_invalid is a HARD_BLOCK rule`
6. `excludes two-way contracts from engine first-year max enforcement`

### Test Command + Output

```bash
npm test -- --run tests/architect/capLegalityValidation.test.js

 ✓ tests/architect/capLegalityValidation.test.js (68)
   ✓ validateSigning - Phase 4.5 Engine First-Year Max (Bird Rights/Cap Space) (6)
 Test Files  1 passed (1)
      Tests  68 passed (68)
   Duration  8.04s
```

---

## 7. Build

```bash
npm run build

vite v4.5.14 building for production...
✓ 2926 modules transformed.
✓ built in 32.12s
Exit code: 0
```

---

## 8. Master Doc Update

**Yes** — Updated the following sections:

| Section | Change |
|---------|--------|
| 5.2 Validation Map | Added `Signing First Year Engine Max Invalid` row |
| 5.3 Hard Block Rules | Added `signing_first_year_engine_max_invalid` bullet |
| 10 Change Log | Added Phase 4.5 entry dated 2026-01-18 |
