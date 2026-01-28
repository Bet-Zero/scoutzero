# Phase 14 Return Package: Offer Sheet Store-Only Invariants

**Date:** 2026-01-19  
**Phase:** 14  
**Status:** ✅ COMPLETE

---

## 1) Direct Answer

**What changed:** Phase 14 hardens the "store-only" offer sheet mode (`rfaOfferSheetOnly === true`) by enforcing strict invariants at the validator level.

**Why it prevents misuse:**

- Store-only mode now requires `rfaOfferSheet === true` (explicit offer sheet flag)
- MATCHED status is blocked in store-only mode (MATCHED = finalization path)
- These checks happen BEFORE the offer sheet validation block, catching misconfigurations early

---

## 2) Rule IDs

| Rule ID | Severity | Trigger |
|---------|----------|---------|
| `rfa_offer_sheet_store_only_invalid` | HARD_BLOCK | `rfaOfferSheetOnly=true` with missing `rfaOfferSheet` flag OR with MATCHED status |
| `rfa_offer_sheet_store_only_flag_in_use` | SOFT_WARNING | Store-only mode is active and valid (informational) |

---

## 3) Invariant Table

When `rfaOfferSheetOnly === true`, the following invariants are enforced:

| Condition | `rfaOfferSheet` | Status | Result |
|-----------|-----------------|--------|--------|
| Store-only + valid | `true` | `PENDING_MATCH` | ✅ Allowed (+ warning) |
| Store-only + missing flag | missing/`false` | any | ❌ `rfa_offer_sheet_store_only_invalid` |
| Store-only + MATCHED | `true` | `MATCHED` | ❌ `rfa_offer_sheet_store_only_invalid` |
| Store-only + DECLINED | `true` | `DECLINED` | ❌ `rfa_offer_sheet_declined` |
| Finalize + PENDING | missing/`false` | `PENDING_MATCH` | ❌ `rfa_offer_sheet_resolution_required` |
| Finalize + MATCHED | any | `MATCHED` | ✅ Allowed |

---

## 4) Call-Site Audit

| Call-Site | Location | Sets `rfaOfferSheetOnly`? | Notes |
|-----------|----------|---------------------------|-------|
| `handleSign` | `useArchitectActions.ts:673` | ❌ No | Flags come from UI |
| N/A (No offer sheet UI exists) | — | — | Future offer sheet UI must set flags |

**Conclusion:** No call-site wiring changes needed. The contract object passed from UI determines the mode. Offer sheet UI (future feature) must set both `rfaOfferSheet: true` and `rfaOfferSheetOnly: true` for store-only mode.

---

## 5) Files Changed

| File | Purpose |
|------|---------|
| `src/features/architect/utils/capLegalityValidation.js` | Added `validateStoreOnlyInvariants()`, new rule IDs, wired into offer sheet validation |
| `tests/architect/capLegalityValidation.test.js` | Added 16 new Phase 14 tests |
| `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` | Added Phase 14 rules, invariants table, changelog |

---

## 6) Tests Added

**New test count:** 16 tests

**Test suites:**

- `Phase 14: validateStoreOnlyInvariants helper` (8 tests)
- `Phase 14: Store-Only Integration - validateSigning` (6 tests)
- `Phase 14 Rule ID Confirmation` (2 tests)

**Test command:**

```bash
npm test -- --run tests/architect/capLegalityValidation.test.js
```

**Output:**

```
✓ tests/architect/capLegalityValidation.test.js  (204 tests) 179ms

 Test Files  1 passed (1)
      Tests  204 passed (204)
   Start at  14:07:56
   Duration  3.85s
```

---

## 7) Build Output

```bash
npm run build
```

```
vite v4.5.14 building for production...
✓ 2929 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-e8545604.css            73.25 kB │ gzip:  12.89 kB
dist/assets/index.esm-49dc1598.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-a375c372.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-549f62a9.js     15.22 kB │ gzip:   5.13 kB
dist/assets/index-8e2096d9.js          1,895.66 kB │ gzip: 553.93 kB
✓ built in 23.32s
Exit code: 0
```

---

## 8) Master Doc Updates

**Sections changed:**

- **5.3 Hard Block vs Override Rules:** Added `rfa_offer_sheet_store_only_invalid`
- **5.3 Soft Warning Rules:** Added `rfa_offer_sheet_store_only_flag_in_use`
- **10. Change Log:** Added Phase 14 changelog entry
- **9.12 RFA Offer Sheet Schema:** Added Phase 14 Store-Only Invariants section with table

**Changelog line:**

```
| 2026-01-19 | **Contract Rules Phase 14:** Offer Sheet Store-Only Invariants. (1) Added `rfa_offer_sheet_store_only_invalid` hard-block for invalid store-only configurations (missing `rfaOfferSheet` or MATCHED status). (2) Added `rfa_offer_sheet_store_only_flag_in_use` warning when store-only mode is active. (3) Created `validateStoreOnlyInvariants()` helper. (4) Store-only invariants checked before offer sheet validation to catch misuse. 16 new tests added. |
```

---

## Stop Conditions

None triggered. All work items completed successfully:

- ✅ Store-only invariants implemented at validator level
- ✅ No call-site wiring needed (flags come from UI)
- ✅ Evidence-based finalization audit complete (validator does not receive operation context)
- ✅ All tests pass, build succeeds
