# Return Package: Cap Sheet Contract Rules Phase 11

**Phase 11: Year Coverage & Rookie Scale Enforcement**

**Status:** ✅ Complete
**Date:** 2026-01-18

---

## 1. Executive Summary

This phase eliminates silent failure modes for year-based cap lookups and implements authoritative Rookie Scale enforcement.

1. **Explict Year Coverage:** No more silent fallback to 2024-25 data. Years are now strictly `REAL` (authoritative) or `PROJECTED` (with explicit warning).
2. **Rookie Scale Enforcement:** New hard-block rule ensuring first-round picks signed to contracts are within the CBA-mandated **80%-120%** band of the 100% scale amount.
3. **Canonical Data:** Created `src/features/architect/data/rookieScale.ts` and `capYearData.ts` as Single Sources of Truth.

## 2. Key Changes

### 2.1 Year Coverage Policy

| Input Year | Old Behavior | New Behavior (Phase 11) |
|------------|--------------|-------------------------|
| **2024-25** | Returns 2024 data | Returns 2024 data (`source: 'REAL'`) |
| **2030-31** | **Silently** returned 2024 data | Returns projected data (`source: 'PROJECTED'`) with **WARNING** |
| **Invalid** | **Silently** returned 2024 data | Returns emergency fallback with **CRITICAL** warning (`source: 'invalid_year_input_fallback'`) |

### 2.2 Rookie Scale Rule (`rookie_scale_invalid`)

* **Logic:** `min = floor(scale * 0.8)`, `max = ceil(scale * 1.2)`
* **Enforcement:** Hard Block in `validateSigning`
* **Scope:** Picks 1-30 where authoritative scale data exists (currently 2024-25).
* **Tolerance:** $1 allowed deviation for rounding differences.

## 3. Files Modified

* `src/features/architect/utils/tradeMachine/utils/capSettingsProvider.js` (Explicit year logic)
* `src/features/architect/utils/capLegalityValidation.js` (Added `rookie_scale_invalid` rule)
* `src/features/architect/data/capYearData.ts` (NEW: Year classification)
* `src/features/architect/data/rookieScale.ts` (NEW: Canonical 100% Scale amounts)
* `tests/architect/capLegalityValidation.test.js` (Added 10+ new tests)
* `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` (Updated master reference)

## 4. Verification

`npm test -- --run tests/architect/capLegalityValidation.test.js`

**Result:**

* ✅ `Year Coverage Policy - getCapSettings` (3 tests passed)
* ✅ `Rookie Scale Enforcement - validateSigning` (6 tests passed)
* ✅ All regression tests passed (161 total)

## 5. Next Steps

* **Phase 12:** Implement Offer Sheet matching logic for RFA signings (currently hard-blocked for non-home teams).
* **Data Entry:** Add 2025-26+ Rookie Scale projections to `rookieScale.ts` when available or implement algorithmic projection.
