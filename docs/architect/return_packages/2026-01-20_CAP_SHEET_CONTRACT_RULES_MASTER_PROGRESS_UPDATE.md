# CAP SHEET CONTRACT RULES — MASTER PROGRESS UPDATE

**DATE:** 2026-01-20  
**MODE:** PREFLIGHT (review-only; no code changes)  
**MASTER DOC (SOURCE OF TRUTH):** [CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md](file:///Users/brenthibbitts/Desktop/ScoutZero/docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md)

---

## 1. Executive Summary

The Cap Sheet Contract Rules feature has undergone **28 discrete phases** from 2026-01-16 through 2026-01-20, transforming from a basic mutation pipeline into a comprehensive, audit-grade CBA enforcement system.

**Key Accomplishments:**

- All P0 gaps (G0-1 through G0-7) have been resolved, including incomplete roster charge, exception blocking, TPE expiration, minimum salary enforcement, contract years validation, first-year max limits, second apron minimum-only signings, and extension terms enforcement.
- Complete contract schema normalization (`optionUsed` boolean, `freeAgency` object, `signingDate` canonical field).
- Rights-based cap hold validation with multipliers (190/130/120%) from canonical source (`capHolds.ts`).
- Full RFA offer sheet workflow: store → match/decline → finalize with atomic persistence, idempotent dedupKey, and audit-grade cleanup.
- **204 tests** in `capLegalityValidation.test.js`, plus 32+ offer sheet tests (persistence + resolution).
- Build succeeds consistently; all tests pass.

**Current System Status:** ✅ **Audit-Grade Complete** for MVP scope (RFA offer sheet workflow, all signing/extension/option validations).

**What Remains:** P1/P2 polish items (stretch timing, Bird rights UI hints, cap hold + FA interaction, manual dead money UI, TPE usage UI).

---

## 2. Phase Timeline Table

| Phase | Date | Name | What Was Implemented | Rules Added/Changed | Mutations | UI Surfaces | Tests | Status |
|-------|------|------|----------------------|---------------------|-----------|-------------|-------|--------|
| A | 2026-01-16 | Initial Master Doc | Created master doc with mutations inventory, validation map | — | Inventory documented | — | — | ✅ |
| A-P0 | 2026-01-17 | G0-1/G0-2 Fixes | Incomplete roster charge (G0-1), post-apron exception blocking (G0-2) | `exception_blocked` | — | — | `incompleteRosterCharge.test.js` (9) | ✅ |
| 1-P0 | 2026-01-17 | TPE Expiration Phase 1 | Core TPE expiration logic (`processTradeExceptions`) | — | — | — | `seasonManager.tpe.test.js` | ✅ |
| 2-P0 | 2026-01-17 | TPE Expiration Phase 2 | Canonicalized `expiresOn`, backfill logic, UI drift eliminated | — | — | `SeasonAdvanceModal` | `seasonManager.tpe.test.js` | ✅ |
| 0 | 2026-01-17 | Contract Schema Phase 0 | Standardized schema: `signingDate`, `isExtension`, boolean `optionUsed` | — | Sign/Extend/Option writers | — | `contractNormalization.test.js` (52) | ✅ |
| 1 | 2026-01-17 | Min Salary Enforcement | G0-4: First-year salary/capHit ≥ CBA minimum by YOS | `min_salary_violation` | — | — | +8 tests | ✅ |
| 2 | 2026-01-17 | Contract Years | G2-4: Contract length validated by mechanism (MIN 1-2, MLE 1-4, TPMLE/ROOM/BAE 1-2) | `contract_years_invalid` | — | — | +9 tests | ✅ |
| 2.5 | 2026-01-17 | First-Year Max + Second Apron | G0-5/G0-6: Exception amount caps, MINIMUM exactness, second apron minimum-only | `first_year_max_invalid`, `second_apron_minimum_only` | — | — | +14 tests | ✅ |
| 2.5-patch | 2026-01-17 | Second Apron capHit Fix | Fixed projected cap hit calculation to use `capHit` (not `salary`) | — | — | — | +1 test | ✅ |
| 3 | 2026-01-17 | Extension Terms | G0-7: Two-way blocked, max 4 years, first-year ≤120% baseline, raises ≤8% | `extension_ineligible`, `extension_years_invalid`, `extension_first_year_max_invalid`, `extension_raise_invalid` | `extendPlayer` | — | +8 tests | ✅ |
| 3.25 | 2026-01-17 | Extension Wiring Fix | Fixed baseline (140%→120%), wired Salary Engine `extensionTerms` | — | — | — | Updated tests | ✅ |
| 4 | 2026-01-17 | Signing Terms & Raises | Wired Salary Engine signing terms into validation | `signing_terms_invalid`, `signing_raise_invalid` | — | — | Updated tests | ✅ |
| 4.5 | 2026-01-18 | Bird Rights First-Year Max | Distinct `signing_first_year_engine_max_invalid` for engine-derived max | `signing_first_year_engine_max_invalid` | — | — | +6 tests | ✅ |
| 5 | 2026-01-18 | Contract Row Schema | Negative salary/capHit blocked, guarantee coherence, option enum validation | `contract_row_schema_invalid`, `contract_guarantee_invalid`, `contract_option_invalid` | — | — | +14 tests | ✅ |
| 6 | 2026-01-18 | Engine Terms Schema + Bird Rights Separation | Separated `mechanism` (exception) from `rightsType` (Bird), `normalizeSigningTerms()` | — | — | — | +13 tests | ✅ |
| 7 | 2026-01-18 | Free Agency State Validation | Blocked legacy string format, invalid year type | `free_agency_state_invalid`, `cap_hold_transition_invalid` (reserved) | — | — | +10 tests | ✅ |
| 7.1 | 2026-01-18 | Cap Hold Transitions | Enforced cap hold creation/removal on option accept/decline | `cap_hold_transition_invalid` | `optionDecision` | — | +5 tests | ✅ |
| 7.2 | 2026-01-18 | Cap Hold Amounts + FA Year | Rights-based multipliers (190/130/120%), season-derived FA year | — | — | — | New tests | ✅ |
| 7.3 | 2026-01-18 | Option State Invariants | Roster presence, option row coherence, declined season removal, FA year mismatch | `option_accept_player_not_rostered`, `option_accept_option_row_invalid`, `option_decline_player_still_rostered`, `option_decline_contract_row_still_present_for_declined_season`, `option_decline_free_agency_year_mismatch` | — | — | New tests | ✅ |
| 8 | 2026-01-18 | RFA/QO Correctness | RFA missing QO upgraded to hard-block, year plausibility, re-signing eligibility | `rfa_state_invalid`, `rfa_missing_qualifying_offer`, `rfa_signing_not_supported`, `resigning_ineligible` | — | — | +13 tests | ✅ |
| 9 | 2026-01-18 | Eligibility IDs + FA Plausibility | Team normalizers (`normalizeTeamRef`, `normalizePlayerTeamRef`), centralized plausibility policy | `resigning_eligibility_unverifiable` (warning) | — | — | +9 tests | ✅ |
| 10 | 2026-01-18 | RFA Home-Team vs Offer Sheet | Differentiated: home-team allowed, non-home blocked, identity unverifiable blocked | `rfa_offer_sheet_not_supported`, `rfa_team_identity_unverifiable`, `rfa_qualifying_offer_suspicious` (warning) | — | — | +15 tests | ✅ |
| 11 | 2026-01-18 | Year Coverage + Rookie Scale | REAL vs PROJECTED year policy, Rookie Scale enforcement (80-120% band) | `rookie_scale_invalid`, `invalid_year_input_fallback` | — | — | +10 tests | ✅ |
| 12 | 2026-01-19 | RFA Offer Sheet Stub | Offer sheet allowed with `rfaOfferSheet === true`, PENDING_MATCH blocked for finalization | `rfa_offer_sheet_resolution_required`, `rfa_offer_sheet_invalid_terms`, `rfa_offer_sheet_stub_active` (warning) | — | — | +14 tests | ✅ |
| 13 | 2026-01-19 | Offer Sheet Pending + Finalization Gate | Store-only vs finalization distinction, DECLINED hard-block added | `rfa_offer_sheet_declined` | — | — | +13 tests | ✅ |
| 14 | 2026-01-19 | Store-Only Invariants | Hardened store-only mode (must have `rfaOfferSheet`, cannot be MATCHED) | `rfa_offer_sheet_store_only_invalid`, `rfa_offer_sheet_store_only_flag_in_use` (warning) | — | — | +16 tests | ✅ |
| 15 | 2026-01-19 | Offer Sheet Persistence Preflight | Designed persistence model, canonical `OfferSheet` schema, workflow actions | — | — | — | — | ✅ |
| 16 | 2026-01-19 | Offer Sheet Persistence MVP | `storeOfferSheet` mutation, mirroring to home team `incomingOfferSheets` | `storeOfferSheet`, `matchOfferSheet`, `declineOfferSheet` | `FreeAgencySection`, `OfferSheetList` | New tests | ✅ |
| 17 | 2026-01-19 | Matched Offer Resolution | `finalizeMatchedOfferSheet` mutation, MATCHED workflow complete | `rfa_offer_sheet_matched_offering_team_cannot_finalize` | `finalizeMatchedOfferSheet` | GMDashboard | New tests | ✅ |
| 18 | 2026-01-19 | Audit-Grade Return Package | Verified atomic writes, canonical paths, mirroring logic, authority rules | — | — | — | 6/6 resolution, 204/204 validation | ✅ |
| 18.1 | 2026-01-20 | Audit-Grade Patch | Deterministic `dedupKey`, DECLINED rule scope fix, `finalizeDeclinedOfferSheet` mutation | `rfa_offer_sheet_declined_home_team_cannot_finalize` | `finalizeDeclinedOfferSheet` | — | +19 tests | ✅ |
| 18.2 | 2026-01-20 | Audit-Grade Lock | True idempotency proof tests, cleanup by dedupKey, worldId required, UI wiring complete | — | — | GMDashboard | +13 tests (32 total offer sheet) | ✅ |

**Legend:** ✅ Shipped | 🟡 Partial | ❌ Not Started

---

## 3. Current Canonical System Map

### 3.1 Data Paths

```
BASE (Read-Only)           WORLDS (Writable Overlay)                COMPUTED (Ephemeral)
─────────────────         ──────────────────────────               ────────────────────
teams/{code}          →   architect_worlds/{worldId}/teams/{code}   computeTeamCapTotals()
players/{id}          →   architect_worlds/{worldId}/players/{id}   validateSigning()
                                                                     validateExtension()
                                                                     validateOptionDecision()
```

> **Critical Invariant:** Any direct write to base collections is a doctrine violation. All mutations flow through `applyWorldMutation`.

### 3.2 World Overlay Structure

**Collection:** `architect_worlds/{worldId}/teams/{teamCode}`

| Field | Type | Purpose |
|-------|------|---------|
| `players` | `ArchitectPlayer[]` | Overlay player data |
| `roster` | `string[]` | Player IDs on roster |
| `capHolds` | `CapHold[]` | Active cap holds |
| `exceptions` | `{ mle?, bae?, tpmle? }` | Exception usage |
| `deadCap` | `DeadCapEntry[]` | Dead money (NEW schema) |
| `offerSheets` | `OfferSheet[]` | Outgoing offer sheets (Phase 16+) |
| `incomingOfferSheets` | `OfferSheet[]` | Incoming offer sheets (mirrored from offering team) |

### 3.3 Canonical Mutation Pipeline

**File:** `src/features/architect/utils/mutationPipeline.js`

```
READ → COMPUTE (PURE) → VALIDATE → PERSIST → POST-UPDATE
```

| Mutation Type | Compute Function | Validation Function | Phase |
|---------------|------------------|---------------------|-------|
| `executeTrade` | `computeTradeResult()` | `validateTrade()` | — |
| `signFreeAgent` | `computeSigningResult()` | `validateSigning()` | 1-14 |
| `waivePlayer` | `computeWaiveResult()` | `validateWaive()` | — |
| `extendPlayer` | `computeExtensionResult()` | `validateExtension()` | 3-3.25 |
| `optionDecision` | `computeOptionResult()` | `validateOptionDecision()` | 7.1-7.3 |
| `renounceRights` | `computeRenounceResult()` | `validateRenounceRights()` | — |
| `storeOfferSheet` | `computeStoreOfferSheetResult()` | `validateStoreOnlyInvariants()` | 16 |
| `matchOfferSheet` | `computeMatchOfferSheetResult()` | `validateMatchOfferSheet()` | 16 |
| `declineOfferSheet` | `computeDeclineOfferSheetResult()` | `validateDeclineOfferSheet()` | 16 |
| `finalizeMatchedOfferSheet` | `computeFinalizeMatchedOfferSheetResult()` | `validateOfferSheetResolution()` | 17 |
| `finalizeDeclinedOfferSheet` | `computeFinalizeDeclinedOfferSheetResult()` | `validateOfferSheetResolution()` | 18.1 |

### 3.4 Single Source of Truth (SSOT) Locations

| Domain | SSOT File | Function/Constant |
|--------|-----------|-------------------|
| Cap Totals | `computeTeamCapTotals.js` | `computeTeamCapTotals()` |
| Cap Settings | `capSettingsProvider.js` | `getCapSettings(year)` |
| Cap Hold Multipliers | `capHolds.ts` | `CAP_HOLD_MULTIPLIERS` |
| Rookie Scale | `rookieScale.ts` | `ROOKIE_SCALE_AMOUNTS` |
| Signing Terms | `capLegalityValidation.js` | `normalizeSigningTerms()` |

### 3.5 Validation Entry Points

| Validator File | Scope | Hard-Block Rules |
|----------------|-------|------------------|
| `capLegalityValidation.js` | Non-trade mutations | 30+ hard-block rules |
| `tradeValidator.js` | Trade validation | Trade-specific checks |
| `useCapValidation.js` | Real-time UI hints | UI-only (not enforced in pipeline) |

---

## 4. Rule & Mutation Registry Delta

### 4.1 Hard-Block Rules (30+)

| Rule ID | Added Phase | Category |
|---------|-------------|----------|
| `roster_size` | Baseline | Roster |
| `two_way_limit` | Baseline | Roster |
| `hard_cap` | Baseline | Cap |
| `exception_blocked` | A-P0 | Exception |
| `min_salary_violation` | 1 | Signing |
| `contract_years_invalid` | 2 | Signing |
| `first_year_max_invalid` | 2.5 | Signing |
| `second_apron_minimum_only` | 2.5 | Signing |
| `signing_terms_invalid` | 4 | Signing |
| `signing_raise_invalid` | 4 | Signing |
| `signing_first_year_engine_max_invalid` | 4.5 | Signing |
| `extension_ineligible` | 3 | Extension |
| `extension_years_invalid` | 3 | Extension |
| `extension_first_year_max_invalid` | 3 | Extension |
| `extension_raise_invalid` | 3 | Extension |
| `contract_row_schema_invalid` | 5 | Schema |
| `contract_guarantee_invalid` | 5 | Schema |
| `contract_option_invalid` | 5 | Schema |
| `free_agency_state_invalid` | 7 | FA State |
| `cap_hold_transition_invalid` | 7.1 | Option |
| `option_accept_player_not_rostered` | 7.3 | Option |
| `option_accept_option_row_invalid` | 7.3 | Option |
| `option_decline_player_still_rostered` | 7.3 | Option |
| `option_decline_contract_row_still_present_for_declined_season` | 7.3 | Option |
| `option_decline_free_agency_year_mismatch` | 7.3 | Option |
| `rfa_state_invalid` | 8 | RFA |
| `rfa_missing_qualifying_offer` | 8 | RFA |
| `resigning_ineligible` | 8 | Re-Sign |
| `rfa_offer_sheet_not_supported` | 10 | RFA Offer |
| `rfa_team_identity_unverifiable` | 10 | RFA Offer |
| `rfa_offer_sheet_resolution_required` | 12 | RFA Offer |
| `rfa_offer_sheet_invalid_terms` | 12 | RFA Offer |
| `rfa_offer_sheet_declined` | 13 | RFA Offer |
| `rfa_offer_sheet_store_only_invalid` | 14 | RFA Offer |
| `rfa_offer_sheet_matched_offering_team_cannot_finalize` | 17 | RFA Offer |
| `rfa_offer_sheet_declined_home_team_cannot_finalize` | 18.1 | RFA Offer |
| `rookie_scale_invalid` | 11 | Signing |

### 4.2 Warning Rules

| Rule ID | Added Phase | Purpose |
|---------|-------------|---------|
| `roster_minimum` | Baseline | Roster at <14 |
| `first_apron` | Baseline | Cap warning |
| `second_apron` | Baseline | Cap warning |
| `rfa_qualifying_offer_suspicious` | 10 | QO > 3x last salary |
| `resigning_eligibility_unverifiable` | 9 | Team identity unclear |
| `rfa_offer_sheet_stub_active` | 12 | UI informational |
| `rfa_offer_sheet_store_only_flag_in_use` | 14 | Store-only mode active |

### 4.3 Mutation Types Added (Phases 12-18.2)

| Mutation | Purpose | Phase |
|----------|---------|-------|
| `storeOfferSheet` | Create RFA offer sheet (store-only) | 16 |
| `matchOfferSheet` | Home team matches offer | 16 |
| `declineOfferSheet` | Home team declines offer | 16 |
| `finalizeMatchedOfferSheet` | Home team finalizes matched offer | 17 |
| `finalizeDeclinedOfferSheet` | Offering team finalizes declined offer | 18.1 |

---

## 5. Open Gaps / TODO (Prioritized)

### P1 — Allows Illegal Action but Visible/Warned

| Gap | Description | Status |
|-----|-------------|--------|
| G1-1 | Stretch provision legality not fully validated (timing rules) | ❌ Not Started |
| G1-2 | Bird rights eligibility UI hints incomplete | ❌ Not Started |
| G1-3 | No cap hold validation for FA signings (cap hold + contract > cap space) | ❌ Not Started |

### P2 — Feature Missing / Polish

| Gap | Description | Status |
|-----|-------------|--------|
| G2-1 | Manual dead money entry UI missing | ❌ Not Started |
| G2-2 | Exception create/expire UI missing | ❌ Not Started |
| G2-3 | Roster spot charges not displayed in UI | ❌ Not Started |
| G2-4 | TPE usage tracking UI | Partial |

### CBA Realism Nice-to-Haves

| Item | Description | Priority |
|------|-------------|----------|
| Designated Veteran Extension | 5-year extension support for supermax | Low |
| Trade Kicker Validation | Kicker limits in signing context | Low |
| Poison Pill Detection | Flagging poison pill offer sheet terms | Low |
| Aggregated TPE Usage | Combining TPEs for single signing | Low |

### Known Limitations / Assumed Behavior

| Item | Assumption | Risk |
|------|------------|------|
| Context Year | Defaults to 2026 if not provided | Low (acceptable) |
| Projected Cap Years | Flagged with warning, not blocked | Low |
| MATCHED Finalization | Home team only; offering team blocked | By design |

---

## 6. Recommended Next Phase (Execution-Ready)

### Phase 19: Stretch Provision Legality + Cap Hold Enforcement

**Scope (5 bullets):**

1. Add `stretch_timing_invalid` hard-block for stretches attempted mid-season (must be before season opener).
2. Add `cap_hold_signing_violation` hard-block if signing + cap hold exceeds remaining cap space.
3. Add `cap_hold_renounce_required` warning if cap hold prevents signing within cap space.
4. Wire stretch timing check into `validateWaive()`.
5. Wire cap hold space check into `validateSigning()`.

**Acceptance Criteria:**

- Stretch attempted after season opener → hard-blocked with `stretch_timing_invalid`.
- Signing where cap hold + new salary > remaining space → hard-blocked with `cap_hold_signing_violation`.
- Tests: ≥10 new tests in `capLegalityValidation.test.js`.
- Build succeeds; all existing tests pass.
- Master Doc updated with Phase 19 changelog.

**Required Tests:**

- `stretch_timing_invalid` blocks mid-season stretch.
- `stretch_timing_invalid` allows pre-season stretch.
- `cap_hold_signing_violation` blocks over-cap signing.
- `cap_hold_signing_violation` allows within-cap signing.
- Cap hold behavior with FA type variations (UFA/RFA).

**Stop Conditions:**

- If cap hold + signing interaction requires trade machine integration, stop and document the dependency.
- If stretch timing rules vary by team/date in ways not captured in current data, stop and request clarification.

---

## 7. Evidence (Tests/Build Commands + Outputs)

### Test Suite Summary

| Test File | Tests | Purpose |
|-----------|-------|---------|
| `capLegalityValidation.test.js` | 204 | Core signing/extension/option validation |
| `offerSheetPersistence.test.js` | 26 | Offer sheet store/cleanup/idempotency |
| `offerSheetResolution.test.js` | 6 | Offer sheet match/decline/finalize authority |
| `contractNormalization.test.js` | 52 | Schema normalization |
| `integration.test.js` | 20+ | End-to-end mutation flows |
| `e2e-workflows.test.js` | 17+ | Full workflow scenarios |

### Latest Build Output (Phase 18.2)

```
npm run build

vite v4.5.14 building for production...
✓ 2930 modules transformed.
dist/index.html                            0.60 kB │ gzip:   0.37 kB
dist/assets/index-4afc0256.css            73.91 kB │ gzip:  12.97 kB
dist/assets/index-ef1d76b3.js          1,910.51 kB │ gzip: 556.98 kB
✓ built in 33.96s
```

### Latest Test Output (Phase 18.2)

```
npm test -- --run tests/architect/offerSheetPersistence.test.js tests/architect/offerSheetResolution.test.js

 ✓ tests/architect/offerSheetResolution.test.js (6)
 ✓ tests/architect/offerSheetPersistence.test.js (26)
                          
 Test Files  2 passed (2) 
      Tests  32 passed (32)
```

---

## 8. Master Doc Update Suggestions

The Master Doc is **well-maintained** and comprehensive. Minor suggestions:

1. **Add Test Count Summary:** Consider adding a section listing total test counts by domain (signing: X, extension: Y, option: Z, offer sheet: W).

2. **Clarify P1 Gap Owners:** Assign tentative owners or ETA to P1 gaps for tracking.

3. **Archive Completed P0s:** Move resolved P0 gaps (G0-1 through G0-7) to an "Archived / Resolved" section to reduce visual clutter.

4. **Add Phase 18.2 Idempotency Details:** The `dedupKey` format and worldId requirement are documented in the Change Log but could be promoted to a dedicated "Offer Sheet Identity" section in the schema area.

---

## 9. Stop Conditions Encountered

| Condition | Status |
|-----------|--------|
| Master Doc missing earlier phases | ✅ NOT ENCOUNTERED — All phases documented in Change Log |
| Master Doc out of sync with repo reality | ✅ NOT ENCOUNTERED — Phase 18.2 is latest in both |
| Referenced files not accessible | ✅ NOT ENCOUNTERED — All files readable |
| Contradictions in assumed behavior | ✅ NOT ENCOUNTERED — Design is coherent |

---

## 10. Return Package Summary

This document provides:

- ✅ Executive Summary (17 lines)
- ✅ Phase Timeline Table (28 phases)
- ✅ Current Canonical System Map (data paths, mutation pipeline, SSOT)
- ✅ Rule & Mutation Registry Delta (30+ hard-blocks, 7 warnings, 5 new mutations)
- ✅ Open Gaps / TODO (prioritized P1/P2)
- ✅ Recommended Next Phase (execution-ready with acceptance criteria)
- ✅ Evidence (test/build commands + outputs)
- ✅ Master Doc Update Suggestions
- ✅ Stop Conditions Encountered

**END OF RETURN PACKAGE**
