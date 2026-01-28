# CAP SHEET CONTRACT RULES PHASE 12 — RETURN PACKAGE

## RFA Offer Sheet Matching (Stub) + Phase 11 Hygiene Fixes

**Date:** 2026-01-19  
**Mode:** EXECUTION → VERIFICATION  
**Status:** ✅ COMPLETE

---

## 1) Direct Answer

### What Changed for RFA Offer Sheets

**Before (Phase 10):**

- ALL non-home team RFA signings were blanket hard-blocked with `rfa_offer_sheet_not_supported`
- No path existed for offer sheet attempts

**After (Phase 12):**

- Non-home team RFA signings are allowed IF:
  1. `contract.rfaOfferSheet === true` (explicit offer sheet flag)
  2. `contract.rfaOfferSheetStatus === 'MATCHED'` (resolution complete)
  3. Years between 1-4 and raises ≤ 8%
- Without the flag, legacy `rfa_offer_sheet_not_supported` block still applies

### What is Still NOT Supported

- **No automatic offer sheet creation** — consumers must set `rfaOfferSheet = true` explicitly
- **No match/decline workflow** — only `MATCHED` status allows signing; `PENDING_MATCH` hard-blocks
- **No home team matching logic** — the home team matching the offer is not implemented
- **No compensation calculation** — draft pick compensation for declined matches not implemented

---

## 2) Rule IDs

| Rule ID | Type | Trigger |
|---------|------|---------|
| `rfa_offer_sheet_not_supported` | HARD_BLOCK | Non-home team RFA without `rfaOfferSheet === true` |
| `rfa_offer_sheet_resolution_required` | **NEW** HARD_BLOCK | Offer sheet in `PENDING_MATCH` state |
| `rfa_offer_sheet_invalid_terms` | **NEW** HARD_BLOCK | Years < 1 or > 4, OR raises > 8% |
| `rfa_offer_sheet_stub_active` | **NEW** WARNING | Any processed offer sheet (UI informational) |

---

## 3) Data Shape

### Contract Fields Added

```typescript
interface Contract {
  // ... existing fields ...
  
  // Phase 12: RFA Offer Sheet
  rfaOfferSheet?: boolean;  // true = this is an offer sheet attempt
  rfaOfferSheetStatus?: 'PENDING_MATCH' | 'MATCHED' | 'DECLINED';
}
```

### Location

Fields are on the **contract** object (not player) — colocated with the signing attempt.

---

## 4) Enforcement Logic

### Pseudocode

```javascript
if (player.freeAgency.type === 'RFA') {
  if (signingTeam !== playerHomeTeam) {
    // Non-home team signing
    if (contract.rfaOfferSheet !== true) {
      // BLOCK: Missing offer sheet flag
      return violation('rfa_offer_sheet_not_supported');
    }
    
    // Validate offer sheet terms
    if (years < 1 || years > 4) {
      return violation('rfa_offer_sheet_invalid_terms', 'years');
    }
    if (raises > 8%) {
      return violation('rfa_offer_sheet_invalid_terms', 'raises');
    }
    
    // Check resolution state
    if (status !== 'MATCHED') {
      return violation('rfa_offer_sheet_resolution_required');
    }
    
    // Add stub warning
    warn('rfa_offer_sheet_stub_active');
  }
  // else: Home team signing — proceed through normal validation
}
```

### Location

- [validateSigning](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capLegalityValidation.js#L1647-L1730) — Lines 1647-1730
- [validateOfferSheetTerms](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capLegalityValidation.js#L1163-L1206) — Lines 1163-1206

### Team Identity Normalization

Uses existing Phase 9 helpers:

- `normalizeTeamRef(team)` — extracts canonical team code
- `normalizePlayerTeamRef(player)` — extracts player's home team

---

## 5) Phase 11 Hygiene Fixes

| Issue | Before | After |
|-------|--------|-------|
| "doc-only" claim (line 341) | "No code changes were made (doc-only phase)" | "Code changes were made to capLegalityValidation.js and capSettingsProvider.js. New files created: capYearData.ts, rookieScale.ts." |
| Rule ID consistency | ✓ Confirmed `unverified_cap_inputs` is in HARD_BLOCK_RULES only | No change needed |
| Examples labeling | Proof examples at lines 350-393 are code-based output | Already clear |
| Rookie scale provenance | Already audit-grade at line 26-27 | No change needed |

---

## 6) Files Changed

| File | Purpose |
|------|---------|
| [capLegalityValidation.js](file:///Users/brenthibbitts/Desktop/ScoutZero/src/features/architect/utils/capLegalityValidation.js) | Added offer sheet logic, new rule IDs, constants, `validateOfferSheetTerms()` |
| [capLegalityValidation.test.js](file:///Users/brenthibbitts/Desktop/ScoutZero/tests/architect/capLegalityValidation.test.js) | Added 14 Phase 12 tests |
| [CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md) | Updated changelog, added section 9.12 |
| [Phase 11 return package](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/architect/return_packages/2026-01-18_CAP_SHEET_CONTRACT_RULES_PHASE_11_EXECUTION_YEAR_COVERAGE_AND_ROOKIE_SCALE.md) | Fixed "doc-only" claim |

---

## 7) Tests

### New Tests Added (14)

| Suite | Test Name |
|-------|-----------|
| Offer Sheet Detection | blocks non-home team RFA signing without rfaOfferSheet flag |
| Offer Sheet Detection | allows offer sheet attempt when rfaOfferSheet === true and terms valid (with MATCHED status) |
| Offer Sheet Detection | hard-blocks offer sheet with invalid years (>4) |
| Offer Sheet Detection | hard-blocks offer sheet with raises exceeding 8% |
| Resolution State | hard-blocks offer sheet with PENDING_MATCH status (no resolution) |
| Resolution State | hard-blocks offer sheet with missing status (defaults to PENDING_MATCH) |
| Resolution State | allows offer sheet with MATCHED status |
| Resolution State | emits stub_active warning for all processed offer sheets |
| Rule ID Confirmation | confirms rfa_offer_sheet_resolution_required is HARD_BLOCK |
| Rule ID Confirmation | confirms rfa_offer_sheet_invalid_terms is HARD_BLOCK |
| Rule ID Confirmation | confirms rfa_offer_sheet_stub_active is SOFT_WARNING |
| validateOfferSheetTerms | allows 1-4 year contracts |
| validateOfferSheetTerms | blocks 0-year contract |
| validateOfferSheetTerms | blocks 5+ year contracts |

### Command Output

```
 ✓ Phase 12: RFA Offer Sheet Matching Stub (14)
   ✓ Offer Sheet Detection - validateSigning (4)
   ✓ Resolution State - validateSigning (4)
   ✓ Phase 12 Rule ID Confirmation (3)
   ✓ validateOfferSheetTerms helper (3)

 Test Files  1 passed (1)
      Tests  175 passed (175)
   Duration  3.84s
```

---

## 8) Build

```
> scoutzero-final2@0.0.1 build
> vite build

vite v4.5.14 building for production...
✓ 2929 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-e8545604.css            73.25 kB │ gzip:  12.89 kB
dist/assets/index.esm-e2a9b90b.js          3.62 kB │ gzip:   1.56 kB
dist/assets/tradeManager-fce08808.js       5.24 kB │ gzip:   2.05 kB
dist/assets/seasonManager-955e83e8.js     15.22 kB │ gzip:   5.13 kB
dist/assets/index-f952951c.js          1,893.49 kB │ gzip: 553.45 kB

✓ built in 24.25s
Exit code: 0
```

---

## 9) Master Doc Updates

### Sections Changed

| Section | Change |
|---------|--------|
| 10. Change Log | Added Phase 12 entry |
| 9.12 RFA Offer Sheet Schema (NEW) | Added complete schema documentation |

### Changelog Entry

```markdown
| 2026-01-19 | **Contract Rules Phase 12:** RFA Offer Sheet Matching (Stub). (1) Replaced blanket `rfa_offer_sheet_not_supported` block with differentiated logic: offer sheets allowed if `contract.rfaOfferSheet === true`. (2) Added `rfa_offer_sheet_resolution_required` hard-block for PENDING_MATCH attempts (no resolution). (3) Added `rfa_offer_sheet_invalid_terms` hard-block for years/raises outside bounds (1-4 years, ≤8% raises). (4) Added `rfa_offer_sheet_stub_active` warning for UI awareness. (5) Created `validateOfferSheetTerms()` helper. (6) Phase 11 hygiene fixes applied. 14 new tests added. |
```

---

## Stop Conditions

**None encountered.**

- Offer sheet status represented cleanly on contract object
- Team identity normalization uses existing Phase 9 helpers
- No existing RFA subsystem conflicts discovered
