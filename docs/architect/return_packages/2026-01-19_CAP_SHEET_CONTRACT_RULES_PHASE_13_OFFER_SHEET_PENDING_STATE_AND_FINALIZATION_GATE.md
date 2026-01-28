# CAP SHEET CONTRACT RULES PHASE 13 — RETURN PACKAGE

## Offer Sheet Pending State + Finalization Gate (MATCHED-only)

**Date:** 2026-01-19  
**Mode:** EXECUTION → VERIFICATION  
**Status:** ✅ COMPLETE

---

## 1) Direct Answer

### What Changed from Phase 12 to Phase 13

**Phase 12 Behavior:**

- ANY signing attempt with `status !== 'MATCHED'` was hard-blocked
- No way to store a pending offer sheet without resolution

**Phase 13 Behavior:**

- `PENDING_MATCH` is allowed **when not finalizing** (`rfaOfferSheetOnly: true`)
- `PENDING_MATCH` + finalizing → hard-blocked with `rfa_offer_sheet_resolution_required`
- `DECLINED` → hard-blocked with new `rfa_offer_sheet_declined` rule
- `MATCHED` → allowed for finalization (unchanged)

---

## 2) Finalization Definition

**Definition:** A signing action is "finalizing" if it would place the player on the roster.

**Detection Method:** Explicit opt-out flag on contract object.

```javascript
// Location: capLegalityValidation.js (lines 1164-1193)
export function isFinalizingSigning({ contract }) {
  // If rfaOfferSheetOnly is explicitly true, this is NOT a finalization
  if (contract?.rfaOfferSheetOnly === true) {
    return false;
  }
  // Default: signFreeAgent is a finalizing action (adds player to roster)
  return true;
}
```

**Why This Approach:**

- `validateSigning` runs BEFORE `computeSigningResult`
- Cannot access `updatedTeam.roster` during validation
- Explicit flag is minimal wiring (no pipeline changes needed)

---

## 3) Rule IDs

| Rule ID | Type | Trigger |
|---------|------|---------|
| `rfa_offer_sheet_resolution_required` | HARD_BLOCK | `status === PENDING_MATCH` AND `isFinalizingSigning() === true` |
| `rfa_offer_sheet_declined` | **NEW** HARD_BLOCK | `status === 'DECLINED'` (always) |
| `rfa_offer_sheet_invalid_terms` | HARD_BLOCK | Years < 1 or > 4, OR raises > 8% |
| `rfa_offer_sheet_stub_active` | WARNING | Any processed offer sheet (UI informational) |

---

## 4) Enforcement Pseudocode

```javascript
if (player.freeAgency.type === 'RFA' && signingTeam !== homeTeam) {
  if (contract.rfaOfferSheet !== true) {
    return violation('rfa_offer_sheet_not_supported');
  }
  
  validateOfferSheetTerms(contract);  // years/raises check
  
  const status = contract.rfaOfferSheetStatus || 'PENDING_MATCH';
  const finalizing = isFinalizingSigning({ contract });
  
  // Case A: DECLINED - always dead
  if (status === 'DECLINED') {
    return violation('rfa_offer_sheet_declined');
  }
  
  // Case B: PENDING_MATCH - blocks ONLY if finalizing
  if (status === 'PENDING_MATCH' && finalizing) {
    return violation('rfa_offer_sheet_resolution_required');
  }
  
  // Case C: MATCHED - allowed
  // Case D: PENDING_MATCH + not finalizing - allowed (storing)
  
  warn('rfa_offer_sheet_stub_active');
}
```

---

## 5) Files Changed

| File | Purpose |
|------|---------|
| [capLegalityValidation.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capLegalityValidation.js) | Added `isFinalizingSigning()`, `rfa_offer_sheet_declined` rule, modified validation logic |
| [capLegalityValidation.test.js](file:///Users/brenthibbitts/Desktop/ScoutZero/tests/architect/capLegalityValidation.test.js) | Added 13 Phase 13 tests |
| [CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md) | Updated changelog, HARD_BLOCK list, section 9.12 finalization gate |

---

## 6) Tests

### New Tests Added (13)

| Suite | Test Count |
|-------|------------|
| `isFinalizingSigning helper` | 4 |
| `PENDING_MATCH Finalization Gate - validateSigning` | 3 |
| `DECLINED Status - validateSigning` | 2 |
| `MATCHED Status - validateSigning` | 1 |
| `Phase 13 Rule ID Confirmation` | 3 |

### Command Output

```
 ✓ Phase 13: Offer Sheet Pending State + Finalization Gate (13)
   ✓ isFinalizingSigning helper (4)
   ✓ PENDING_MATCH Finalization Gate - validateSigning (3)
   ✓ DECLINED Status - validateSigning (2)
   ✓ MATCHED Status - validateSigning (1)
   ✓ Phase 13 Rule ID Confirmation (3)

 Test Files  1 passed (1)
      Tests  188 passed (188)
   Duration  4.74s
```

---

## 7) Build

```
> scoutzero-final2@0.0.1 build
> vite build

vite v4.5.14 building for production...
✓ 2929 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-e8545604.css            73.25 kB │ gzip:  12.89 kB
dist/assets/index.esm-277f36ba.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-73b9a313.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-cc104c2e.js     15.22 kB │ gzip:   5.13 kB
dist/assets/index-8dcd49f1.js          1,894.18 kB │ gzip: 553.60 kB

✓ built in 28.41s
Exit code: 0
```

---

## 8) Master Doc Updates

### Sections Changed

| Section | Change |
|---------|--------|
| 5.3 Hard Block Rules | Added `rfa_offer_sheet_resolution_required`, `rfa_offer_sheet_invalid_terms`, `rfa_offer_sheet_declined` |
| 9.12 RFA Offer Sheet Schema | Added Phase 13 Finalization Gate subsection with decision table |
| 10. Change Log | Added Phase 13 entry |

### Changelog Entry

```markdown
| 2026-01-19 | **Contract Rules Phase 13:** Offer Sheet Pending State + Finalization Gate. (1) Added `isFinalizingSigning()` helper for finalization detection via `contract.rfaOfferSheetOnly` flag. (2) Modified `rfa_offer_sheet_resolution_required` to only block when finalizing AND status !== MATCHED. (3) PENDING_MATCH now allowed when `rfaOfferSheetOnly === true` (storing only). (4) Added `rfa_offer_sheet_declined` hard-block for DECLINED status. (5) Updated stub warning with status/finalizing info. 13 new tests added. |
```

---

## Stop Conditions

**None encountered.**

- `rfaOfferSheetOnly` flag approach works cleanly
- No pipeline changes required
- Existing Phase 12 tests still pass (behavior preserved for finalizing cases)
