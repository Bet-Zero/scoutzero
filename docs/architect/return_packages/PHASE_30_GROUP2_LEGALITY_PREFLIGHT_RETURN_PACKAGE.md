# Phase 30 Group 2: Legality / CBA Compliance Coverage Map (Cap Sheet in a Vacuum)

**DATE:** 2026-01-21  
**MODE:** PREFLIGHT (review-only; NO code changes)  
**SSOT:** `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md`

---

## Executive Summary

1. **Signing Validation is Comprehensive**: `validateSigning()` enforces 20+ CBA rules including min salary, exception eligibility, roster limits, cap holds, Bird rights, RFA workflows, rookie scale, contract schema, and apron-based restrictions. This is the most mature validator.

2. **Extension Validation is Complete**: `validateExtension()` enforces 1-4 year limits, 120% first-year max (engine-overridable), 8% raise caps, and two-way ineligibility. Salary Engine integration provides type-specific terms.

3. **Option Decision Validation is Strong**: `validateOptionDecision()` enforces timing constraints, cap hold creation/removal invariants, roster presence, and freeAgency state consistency. Phase 7.3 invariants are fully implemented.

4. **Waive/Stretch Has Timing Warnings Only**: `validateWaive()` enforces roster minimum warnings and stretch timing warnings (Phase 21). **No hard blocks on stretch timing** - this is intentional given retroactive data entry scenarios.

5. **Sign-and-Trade Has KEY GAPS**: `validateSignAndTrade()` in trade rules enforces offseason-only, 3-4 year minimum, first-year guaranteed, TPMLE restriction, and hard cap at first apron. **GAPS: Aggregation prohibition not enforced; BYC for S&T players uses standard rules (correct but not S&T-specific)**.

6. **Offer Sheet Workflow is Functional**: RFA offer sheet store/match/decline/finalize is implemented with proper authority checks. 48-hour window is WARNING-only (Phase 21).

7. **Exception Management is Validated**: Schema validation for MLE/TPMLE/BAE/ROOM with unknown key rejection. TPE is explicitly out of Phase 27 scope.

8. **Supporting Systems are Solid**: `computeTeamCapTotals()` is SSOT for cap calculations including incomplete roster charges. Hard cap detection uses both explicit flags and apron proximity.

9. **Test Coverage is Good**: 200+ tests in `capLegalityValidation.test.js`, 20 tests for S&T, dedicated test files for exceptions, dead cap, cap totals, and world time.

10. **Top Gaps Identified**: 3 P0 gaps (aggregation prohibition for S&T, max contract salary for signings, veteran minimum calculation edge), 4 P1 gaps (designated veteran extensions, trade bonus calculation, stretch pro-ration, two-team-only S&T enforcement).

---

## Legality Coverage Matrix

### A) Sign Free Agent

| Rule Cluster            | Rule Name                            | Enforcement     | Rule IDs                                                | Where Enforced                                          | Test Coverage                      | Notes                                             |
| ----------------------- | ------------------------------------ | --------------- | ------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| Roster Limits           | Max 15 standard roster               | HARD_BLOCK      | `roster_size`                                           | `capLegalityValidation.js:validateSigning`              | ✅ `capLegalityValidation.test.js` |                                                   |
| Roster Limits           | Max 3 two-way                        | HARD_BLOCK      | `two_way_limit`                                         | `capLegalityValidation.js:validateSigning`              | ✅ `capLegalityValidation.test.js` |                                                   |
| Salary Floor            | Min salary by YOS                    | HARD_BLOCK      | `min_salary_violation`                                  | `capLegalityValidation.js:validateSigning` L2540-2595   | ✅ 8+ tests                        | Phase 1 implementation                            |
| Salary Ceiling          | First-year max by mechanism          | HARD_BLOCK      | `first_year_max_invalid`                                | `capLegalityValidation.js:validateSigning` L2698-2750   | ✅ 14+ tests                       | MLE/TPMLE/BAE caps                                |
| Salary Ceiling          | Salary Engine first-year max         | HARD_BLOCK      | `signing_first_year_engine_max_invalid`                 | `capLegalityValidation.js:validateSigning` L2780-2850   | ✅ 6+ tests                        | Bird rights max                                   |
| Contract Terms          | Contract years by mechanism          | HARD_BLOCK      | `contract_years_invalid`, `signing_terms_invalid`       | `capLegalityValidation.js:validateSigning` L2625-2690   | ✅ 9+ tests                        | 1-2yr/1-4yr limits                                |
| Contract Terms          | Raise percentage (5%/8%)             | HARD_BLOCK      | `signing_raise_invalid`                                 | `capLegalityValidation.js:validateSigningRaises`        | ✅ Phase 4 tests                   |                                                   |
| Contract Schema         | Row schema (salary/capHit/season)    | HARD_BLOCK      | `contract_row_schema_invalid`                           | `capLegalityValidation.js:validateContractRows`         | ✅ 14+ tests                       | Phase 5                                           |
| Contract Schema         | Guarantee consistency                | HARD_BLOCK      | `contract_guarantee_invalid`                            | `capLegalityValidation.js:validateGuaranteesPolicy`     | ✅ Phase 5 tests                   |                                                   |
| Contract Schema         | Option enum validity                 | HARD_BLOCK      | `contract_option_invalid`                               | `capLegalityValidation.js:validateOptionsPolicy`        | ✅ Phase 5 tests                   |                                                   |
| Free Agency State       | freeAgency object format             | HARD_BLOCK      | `free_agency_state_invalid`                             | `capLegalityValidation.js:validateFreeAgencyState`      | ✅ 10+ tests                       | Phase 7                                           |
| Exception Eligibility   | Post-apron exception blocking        | HARD_BLOCK      | `exception_blocked`                                     | `capLegalityValidation.js:validateExceptionEligibility` | ✅ `exceptionBlocking.test.js`     | Second apron = minimum only                       |
| Second Apron            | Minimum-only signings                | HARD_BLOCK      | `second_apron_minimum_only`                             | `capLegalityValidation.js:validateSigning` L2870-2930   | ✅ Phase 2.5 tests                 |                                                   |
| Hard Cap                | Ceiling enforcement                  | HARD_BLOCK      | `hard_cap`                                              | `capLegalityValidation.js:validateSigning` L2935-2970   | ✅                                 |                                                   |
| Cap Holds               | Cap space + holds < cap              | HARD_BLOCK      | `cap_hold_signing_violation`                            | `capLegalityValidation.js:validateSigning` L2450-2530   | ✅ 22+ tests                       | Phase 19                                          |
| Bird Rights             | Re-signing eligibility               | HARD_BLOCK      | `resigning_ineligible`                                  | `capLegalityValidation.js:validateSigning` L2180-2250   | ✅ Phase 8/9 tests                 |                                                   |
| Bird Rights             | Team identity verification           | HARD_BLOCK      | `rfa_team_identity_unverifiable`                        | `capLegalityValidation.js:validateSigning` L2100-2130   | ✅ Phase 10 tests                  |                                                   |
| RFA                     | QO required for RFA                  | HARD_BLOCK      | `rfa_missing_qualifying_offer`                          | `capLegalityValidation.js:validateSigning`              | ✅ Phase 8 tests                   |                                                   |
| RFA                     | Offer sheet flag required            | HARD_BLOCK      | `rfa_offer_sheet_not_supported`                         | `capLegalityValidation.js:validateSigning` L2140-2180   | ✅ Phase 10 tests                  | Non-home team                                     |
| RFA                     | Offer sheet terms (1-4yr, 8% raises) | HARD_BLOCK      | `rfa_offer_sheet_invalid_terms`                         | `capLegalityValidation.js:validateOfferSheetTerms`      | ✅ Phase 12 tests                  |                                                   |
| RFA                     | Store-only invariants                | HARD_BLOCK      | `rfa_offer_sheet_store_only_invalid`                    | `capLegalityValidation.js:validateStoreOnlyInvariants`  | ✅ 16+ tests                       | Phase 14                                          |
| RFA                     | Resolution required for finalize     | HARD_BLOCK      | `rfa_offer_sheet_resolution_required`                   | `capLegalityValidation.js:validateSigning` L2215-2240   | ✅ Phase 13 tests                  |                                                   |
| RFA                     | MATCHED = home team only             | HARD_BLOCK      | `rfa_offer_sheet_matched_offering_team_cannot_finalize` | `capLegalityValidation.js:validateOfferSheetResolution` | ✅ Phase 17 tests                  |                                                   |
| RFA                     | DECLINED = offering team only        | HARD_BLOCK      | `rfa_offer_sheet_declined_home_team_cannot_finalize`    | `capLegalityValidation.js:validateOfferSheetResolution` | ✅ Phase 18.1 tests                |                                                   |
| Rookie Scale            | 80-120% band enforcement             | HARD_BLOCK      | `rookie_scale_invalid`                                  | `capLegalityValidation.js:validateSigning` L2600-2650   | ✅ Phase 11 tests                  | Picks 1-30 only                                   |
| Apron Warnings          | First/second apron proximity         | WARNING         | `first_apron`, `second_apron`                           | `capLegalityValidation.js:validateSigning` L2980-3000   | ✅                                 |                                                   |
| Cap Hold Info           | Renounce suggestion                  | WARNING         | `cap_hold_renounce_required`                            | `capLegalityValidation.js:validateSigning` L2510-2530   | ✅ Phase 19 tests                  |                                                   |
| **MAX CONTRACT SALARY** | **Max salary by YOS/tenure**         | **NOT_MODELED** | N/A                                                     | N/A                                                     | ❌ None                            | **P0 GAP: No 25%/30%/35% max salary enforcement** |

### B) Extend Player

| Rule Cluster           | Rule Name                        | Enforcement | Rule IDs                           | Where Enforced                                                        | Test Coverage       | Notes                                                                 |
| ---------------------- | -------------------------------- | ----------- | ---------------------------------- | --------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| Eligibility            | Two-way cannot extend            | HARD_BLOCK  | `extension_ineligible`             | `capLegalityValidation.js:validateExtension` L3115-3130               | ✅ Phase 3 tests    | Must convert first                                                    |
| Eligibility            | Must have active contract        | HARD_BLOCK  | `no_contract`                      | `capLegalityValidation.js:validateExtension` L3135-3150               | ✅                  |                                                                       |
| Extension Terms        | 1-4 year limit                   | HARD_BLOCK  | `extension_years_invalid`          | `capLegalityValidation.js:validateExtensionTermsAndRaises` L1930-1950 | ✅ 8+ tests         | Baseline; engine may allow 5                                          |
| Extension Terms        | First-year max (120% baseline)   | HARD_BLOCK  | `extension_first_year_max_invalid` | `capLegalityValidation.js:validateExtensionTermsAndRaises` L1955-1975 | ✅ Phase 3.25 tests | Engine overrides                                                      |
| Extension Terms        | Raise max (8%)                   | HARD_BLOCK  | `extension_raise_invalid`          | `capLegalityValidation.js:validateExtensionTermsAndRaises` L1980-2010 | ✅ Phase 3 tests    |                                                                       |
| Hard Cap Projection    | Future hard cap warning          | WARNING     | `extension_hard_cap`               | `capLegalityValidation.js:validateExtension` L3185-3200               | ✅                  |                                                                       |
| **Designated Veteran** | **5-year extension eligibility** | **PARTIAL** | N/A                                | Salary Engine `extensionTerms`                                        | Needs testing       | **P1 GAP: Engine has terms but validation may not surface correctly** |

### C) Option Decision

| Rule Cluster       | Rule Name                      | Enforcement | Rule IDs                                                        | Where Enforced                                               | Test Coverage      | Notes                |
| ------------------ | ------------------------------ | ----------- | --------------------------------------------------------------- | ------------------------------------------------------------ | ------------------ | -------------------- |
| Timing             | Only upcoming season           | HARD_BLOCK  | `option_timing`                                                 | `capLegalityValidation.js:validateOptionDecision` L3240-3260 | ✅                 |                      |
| Accept Invariants  | No cap hold created            | HARD_BLOCK  | `cap_hold_transition_invalid`                                   | `capLegalityValidation.js:validateOptionDecision` L3290-3310 | ✅ Phase 7.1 tests |                      |
| Accept Invariants  | Player remains on roster       | HARD_BLOCK  | `option_accept_player_not_rostered`                             | `capLegalityValidation.js:validateOptionDecision` L3320-3330 | ✅ Phase 7.3 tests |                      |
| Accept Invariants  | Option row marked used         | HARD_BLOCK  | `option_accept_option_row_invalid`                              | `capLegalityValidation.js:validateOptionDecision` L3340-3380 | ✅ Phase 7.3 tests |                      |
| Decline Invariants | Cap hold created when expected | HARD_BLOCK  | `cap_hold_transition_invalid`                                   | `capLegalityValidation.js:validateOptionDecision` L3420-3460 | ✅ Phase 7.2 tests | Rights-based amounts |
| Decline Invariants | Player off roster              | HARD_BLOCK  | `option_decline_player_still_rostered`                          | `capLegalityValidation.js:validateOptionDecision` L3560-3570 | ✅ Phase 7.3 tests |                      |
| Decline Invariants | Option row removed             | HARD_BLOCK  | `option_decline_contract_row_still_present_for_declined_season` | `capLegalityValidation.js:validateOptionDecision` L3575-3590 | ✅ Phase 7.3 tests |                      |
| Decline Invariants | freeAgency year matches        | HARD_BLOCK  | `option_decline_free_agency_year_mismatch`                      | `capLegalityValidation.js:validateDeclineFreeAgency`         | ✅ Phase 7.3 tests |                      |
| Hard Cap           | Future hard cap warning        | WARNING     | `option_hard_cap`                                               | `capLegalityValidation.js:validateOptionDecision` L3270-3285 | ✅                 |                      |

### D) Renounce Rights / Cap Holds

| Rule Cluster             | Rule Name                  | Enforcement     | Rule IDs         | Where Enforced                                               | Test Coverage      | Notes          |
| ------------------------ | -------------------------- | --------------- | ---------------- | ------------------------------------------------------------ | ------------------ | -------------- |
| Rights Check             | No rights = info           | INFO            | `no_rights`      | `capLegalityValidation.js:validateRenounceRights` L3620-3635 | ✅                 | Always valid   |
| Cap Space Info           | Cap freed amount           | INFO            | `cap_space_gain` | `capLegalityValidation.js:validateRenounceRights` L3640-3650 | ✅                 |                |
| **Cap Hold Calculation** | **Multiplier correctness** | **IMPLEMENTED** | N/A              | `capHolds.ts:CAP_HOLD_MULTIPLIERS`                           | ✅ Phase 7.2 tests | 190%/130%/120% |

### E) Waive Player / Waive & Stretch

| Rule Cluster       | Rule Name                           | Enforcement     | Rule IDs                    | Where Enforced                                      | Test Coverage     | Notes                                  |
| ------------------ | ----------------------------------- | --------------- | --------------------------- | --------------------------------------------------- | ----------------- | -------------------------------------- |
| Roster Minimum     | <14 players warning                 | WARNING         | `roster_minimum`            | `capLegalityValidation.js:validateWaive` L3040-3055 | ✅                | Grace period supported                 |
| Dead Cap Info      | Guaranteed salary impact            | INFO            | `dead_cap`                  | `capLegalityValidation.js:validateWaive` L3060-3085 | ✅                |                                        |
| Stretch Timing     | After season start warning          | WARNING         | `stretch_timing_suspicious` | `capLegalityValidation.js:validateWaive` L3090-3105 | ✅ Phase 21 tests |                                        |
| **Stretch Math**   | **Stretch calculation correctness** | **IMPLEMENTED** | N/A                         | `computeWaiveResult` in pipeline                    | Needs audit       | Math is (remaining / (years \* 2 + 1)) |
| **Roster Minimum** | **14-man floor hard block**         | **NOT_MODELED** | N/A                         | N/A                                                 | ❌ None           | **Only warning, not hard block**       |

### F) Offer Sheets (RFA)

| Rule Cluster    | Rule Name                       | Enforcement     | Rule IDs                                                | Where Enforced                                                     | Test Coverage     | Notes                             |
| --------------- | ------------------------------- | --------------- | ------------------------------------------------------- | ------------------------------------------------------------------ | ----------------- | --------------------------------- |
| Store           | Terms validation                | HARD_BLOCK      | `rfa_offer_sheet_invalid_terms`                         | `capLegalityValidation.js:validateOfferSheetTerms`                 | ✅                | 1-4yr, 8% raises                  |
| Store           | Store-only invariants           | HARD_BLOCK      | `rfa_offer_sheet_store_only_invalid`                    | `capLegalityValidation.js:validateStoreOnlyInvariants`             | ✅                |                                   |
| Match/Decline   | Authority check                 | HARD_BLOCK      | In `validateOfferSheetResolution`                       | `capLegalityValidation.js:validateOfferSheetResolution`            | ✅ Phase 17 tests | Home team only                    |
| Match           | 48-hour window                  | WARNING         | `offer_sheet_window_expired`                            | `capLegalityValidation.js:validateOfferSheetResolution` L3690-3710 | ✅ Phase 21 tests |                                   |
| Finalize        | Resolution required             | HARD_BLOCK      | `rfa_offer_sheet_resolution_required`                   | `capLegalityValidation.js:validateOfferSheetResolution`            | ✅                |                                   |
| Finalize        | MATCHED = home only             | HARD_BLOCK      | `rfa_offer_sheet_matched_offering_team_cannot_finalize` | `capLegalityValidation.js:validateOfferSheetResolution`            | ✅                |                                   |
| Finalize        | DECLINED = offering only        | HARD_BLOCK      | `rfa_offer_sheet_declined_home_team_cannot_finalize`    | `capLegalityValidation.js:validateOfferSheetResolution`            | ✅ Phase 18.1     |                                   |
| **Poison Pill** | **Year 3-4 salary > 2x year 1** | **NOT_MODELED** | N/A                                                     | N/A                                                                | ❌ None           | **P2 GAP: Poison pill detection** |

### G) Sign-and-Trade (2-Team)

| Rule Cluster      | Rule Name                              | Enforcement       | Rule IDs | Where Enforced                                          | Test Coverage             | Notes                                                      |
| ----------------- | -------------------------------------- | ----------------- | -------- | ------------------------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| Timing            | Offseason only                         | HARD_BLOCK        | N/A      | `validateSignAndTrade.js` L33-35                        | ✅ `signAndTrade.test.js` | Checks `tradeCtx.offseason`                                |
| Contract Terms    | 3-4 years required                     | HARD_BLOCK        | N/A      | `validateSignAndTrade.js` L49-52, L64-67                | ✅ SAT tests              | Rejects 2-year contracts                                   |
| Contract Terms    | First year guaranteed                  | HARD_BLOCK        | N/A      | `validateSignAndTrade.js` L55-58, L70-73                | ✅ SAT tests              |                                                            |
| TPMLE Restriction | Cannot receive if used TPMLE           | HARD_BLOCK        | N/A      | `validateSignAndTrade.js` L43-46                        | ✅                        |                                                            |
| Hard Cap          | Receiving team capped at first apron   | HARD_BLOCK        | N/A      | `validateSignAndTrade.js` L80-103, `validateHardCap.ts` | ✅ SAT15                  | `hardCapped: true` returned                                |
| Player Origin     | Must be traded by origin team          | HARD_BLOCK        | N/A      | `validateSignAndTrade.js` L76-79                        | ✅                        |                                                            |
| Alone Rule        | S&T player traded alone                | HARD_BLOCK        | N/A      | `validateSignAndTrade.js` L38-40                        | ✅                        |                                                            |
| **Aggregation**   | **Cannot combine with other outgoing** | **PARTIAL**       | N/A      | L38-40 checks `.length > 1`                             | ⚠️                        | **P0 GAP: Only checks outgoing, not incoming aggregation** |
| **BYC Treatment** | **Base Year Compensation for S&T**     | **USES_STANDARD** | N/A      | Trade validator `computeMatchingValues`                 | ✅                        | Standard BYC logic; S&T-specific rules may differ          |
| **Max Contract**  | **S&T-specific max salary**            | **NOT_MODELED**   | N/A      | N/A                                                     | ❌ None                   | **P1 GAP: S&T max may differ from direct signing max**     |

### H) Supporting Cap Systems

| Rule Cluster      | Rule Name                      | Enforcement | Rule IDs                                              | Where Enforced                                  | Test Coverage                    | Notes                       |
| ----------------- | ------------------------------ | ----------- | ----------------------------------------------------- | ----------------------------------------------- | -------------------------------- | --------------------------- |
| Cap Holds         | Included in cap space signings | HARD_BLOCK  | `cap_hold_signing_violation`                          | `capLegalityValidation.js:validateSigning`      | ✅ 22 tests                      | Phase 19                    |
| Exceptions        | MLE/TPMLE/BAE/ROOM schema      | HARD_BLOCK  | `exceptions_schema_invalid`, `exceptions_unknown_key` | `capLegalityValidation.js:validateExceptions`   | ✅ `exceptionManagement.test.js` | Phase 27                    |
| Exceptions        | Usage tracking                 | IMPLEMENTED | N/A                                                   | Exception consumption tracked                   | ✅                               | `usedAmount <= totalAmount` |
| TPE               | Expiration enforcement         | IMPLEMENTED | N/A                                                   | `seasonManager.js:processTradeExceptions`       | ✅ `seasonManager.tpe.test.js`   | Phase 1/2                   |
| Hard Cap          | First/second apron detection   | IMPLEMENTED | N/A                                                   | `capLegalityValidation.js:getHardCapStatus`     | ✅                               |                             |
| Hard Cap          | S&T/BAE/NTMLE triggers         | IMPLEMENTED | N/A                                                   | `validateSignAndTrade.js`, `validateHardCap.ts` | ✅                               |                             |
| Incomplete Roster | 14-man charge                  | IMPLEMENTED | N/A                                                   | `computeTeamCapTotals.js`                       | ✅ 9 tests                       | Phase G0-1                  |
| Two-Way           | Max 3 limit                    | HARD_BLOCK  | `two_way_limit`                                       | `capLegalityValidation.js:validateSigning`      | ✅                               |                             |
| Two-Way           | Not counted in cap             | IMPLEMENTED | N/A                                                   | `computeTeamCapTotals.js`                       | ✅                               |                             |
| Cap Totals        | SSOT computation               | IMPLEMENTED | N/A                                                   | `computeTeamCapTotals.js`                       | ✅ Phase 29                      | LeagueView uses SSOT        |

---

## Top 10 Legality Gaps (Ranked P0/P1/P2)

### P0 — Can Produce Illegal NBA States (Hard Block Recommended)

| #        | Gap                                        | Illegal Scenario Permitted                                      | Risk                                                         | Fix Location                               | Recommendation                                                                                     |
| -------- | ------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **P0-1** | **Max Contract Salary Not Enforced**       | Player signed to 40% of cap when only eligible for 25% max      | HIGH: Allows impossible contracts that break cap projections | `capLegalityValidation.js:validateSigning` | Add max salary check using Salary Engine `maxSalary.maxSalary` based on YOS/tenure                 |
| **P0-2** | **S&T Aggregation Prohibition Incomplete** | S&T player aggregated with other incoming players in same trade | MEDIUM: Violates CBA Article VIII S&T rules                  | `validateSignAndTrade.js` L38-40           | Extend check to also verify receiving team isn't combining S&T player with other incoming salaries |
| **P0-3** | **Veteran Minimum Calculation Edge**       | 10+ YOS player signed at 0-YOS minimum rate                     | LOW: Underpayment by ~$1M+                                   | `capLegalityValidation.js:validateSigning` | Verify `getYearsOfService()` has correct fallback and player.yearsOfService is populated           |

### P1 — Allows Illegal Action but Visible/Warned

| #        | Gap                                       | Illegal Scenario Permitted                                    | Risk                                           | Fix Location                                  | Recommendation                                                                                     |
| -------- | ----------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **P1-1** | **Designated Veteran Extension (5-year)** | Designated vet gets 4-year extension only                     | MEDIUM: User can't model supermax extensions   | `capLegalityValidation.js:validateExtension`  | Verify Salary Engine `extensionTerms.maxYears` = 5 for designated vets, and validation respects it |
| **P1-2** | **S&T Max Salary May Differ**             | S&T player signed to 35% max when S&T limits to 25%+5% raises | MEDIUM: Historical S&T rules had different max | `validateSignAndTrade.js` + `validateSigning` | Research if 2023 CBA changed S&T max rules; add specific validation if still different             |
| **P1-3** | **Trade Bonus Calculation**               | 15% trade bonus not reflected in outgoing salary              | LOW: Salary matching may be incorrect          | Trade validator                               | Verify trade bonus is included in `outgoingSalary` calculation                                     |
| **P1-4** | **Stretch Pro-ration**                    | Stretch after season start uses full-season relief            | LOW: Cap relief may be overstated              | `computeWaiveResult`                          | Add pro-ration logic for post-season-start stretches (complex; may remain warning-only)            |

### P2 — Feature Missing / Polish

| #        | Gap                                   | Impact                                                 | Fix Location              | Recommendation                                                        |
| -------- | ------------------------------------- | ------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------- |
| **P2-1** | **Poison Pill Detection**             | RFA offer sheets with year 3-4 > 2x year 1 not flagged | `validateOfferSheetTerms` | Add warning for potential poison pill structure                       |
| **P2-2** | **Roster Minimum Hard Block**         | <14 players is only warning, not hard block            | `validateWaive`           | Keep as warning (teams can temporarily be below 14)                   |
| **P2-3** | **Sign-and-Trade Exclusivity Period** | S&T player can be re-traded immediately                | Trade validator           | Add 6-month/1-year trade restriction tracking (complex; low priority) |

---

## Recommended Phase 31 Execution Scope

### Phase 31: Max Contract Salary Enforcement (P0-1)

**Goal:** Prevent illegal max contract signings by enforcing YOS-based max salary limits.

**Scope:**

1. Add `max_salary_violation` HARD_BLOCK rule to `capLegalityValidation.js:validateSigning`
2. Use Salary Engine `maxSalary.maxSalary` when available (already computed via `getSalaryProfile`)
3. Fallback to CBA table lookup (25% for 0-6 YOS, 30% for 7-9 YOS, 35% for 10+ YOS)
4. Check `firstYearSalary <= maxSalary` for non-minimum, non-exception signings
5. Add 8-10 tests covering: rookie max, 7-year vet max, 10+ year max, supermax eligibility (designated)

**Files to Modify:**

- `src/features/architect/utils/capLegalityValidation.js` (main validator)
- `src/tests/architect/capLegalityValidation.test.js` (tests)
- `docs/architect/CAP_SHEET_MUTATIONS_VALIDATION_MASTER_DOC.md` (changelog)

**Estimated Effort:** 4-6 hours

### Phase 32 (Optional Follow-up): S&T Aggregation Prohibition

**Goal:** Prevent aggregation violations in sign-and-trades.

**Scope:**

1. Enhance `validateSignAndTrade.js` to check `incomingPlayers.length <= 1` for receiving team
2. Block trades where S&T player is combined with other incoming salary
3. Add 3-5 tests

**Estimated Effort:** 2-3 hours

### Phase 33 (Optional Follow-up): Designated Veteran Extension Validation

**Goal:** Ensure designated veteran 5-year extensions are properly allowed.

**Scope:**

1. Verify Salary Engine returns `extensionTerms.maxYears = 5` for designated vets
2. Add test case for supermax extension (5 years, 35% max)
3. Document designated veteran eligibility criteria

**Estimated Effort:** 2-3 hours

---

## Evidence Appendix

### A) Key File List

| File                                                                      | Purpose                  | Lines of Interest                        |
| ------------------------------------------------------------------------- | ------------------------ | ---------------------------------------- |
| `src/features/architect/utils/capLegalityValidation.js`                   | Main non-trade validator | 3795 lines; all validate\* functions     |
| `src/features/architect/utils/mutationPipeline.js`                        | Mutation orchestration   | `applyWorldMutation`, `validateMutation` |
| `src/features/architect/utils/tradeMachine/rules/validateSignAndTrade.js` | S&T trade rules          | 103 lines; all rules                     |
| `src/features/architect/utils/tradeMachine/rules/validateHardCap.ts`      | Hard cap enforcement     | `validateHardCap` function               |
| `src/features/architect/utils/capTotals/computeTeamCapTotals.js`          | Cap SSOT computation     | Incomplete roster charge, totals         |
| `src/features/architect/utils/capHolds.ts`                                | Cap hold multipliers     | `CAP_HOLD_MULTIPLIERS` constant          |
| `src/features/architect/utils/contractNormalization.js`                   | Schema normalization     | `validateFreeAgencyState`, normalizers   |
| `src/features/architect/GMDashboard/hooks/useArchitectActions.ts`         | UI action handlers       | All `handle*` functions                  |

### B) Key Test List

| Test File                                                      | Coverage                      | Test Count            |
| -------------------------------------------------------------- | ----------------------------- | --------------------- |
| `src/tests/architect/capLegalityValidation.test.js`            | Phase 19 cap hold enforcement | 22+ tests             |
| `src/tests/architect/capLegality/exceptionBlocking.test.js`    | Exception eligibility         | 15+ tests             |
| `src/tests/architect/signAndTrade.test.js`                     | S&T workflow                  | 20 tests (SAT1-SAT15) |
| `src/tests/architect/exceptionManagement.test.js`              | Exception schema validation   | 10+ tests             |
| `src/tests/architect/deadCapManagement.test.js`                | Dead cap schema               | 5 tests               |
| `src/tests/architect/worldTime.test.js`                        | World time SSOT               | 14+ tests             |
| `src/tests/architect/capTotals/incompleteRosterCharge.test.js` | 14-man rule                   | 9 tests               |
| `src/tests/architect/capTotals/leagueViewSsot.test.js`         | LeagueView SSOT               | 8 tests               |
| `src/tests/architect/utils/seasonManager.tpe.test.js`          | TPE expiration                | 10+ tests             |

### C) Call Path Summary

**Sign Free Agent:**

```
EditContractModal.jsx → useArchitectActions.handleSignFreeAgent()
  → applyWorldMutation('signFreeAgent')
    → loadStateForMutation()
    → computeWorldMutation() → computeSigningResult()
    → validateMutation() → validateSigning()
    → persistWorldMutation()
```

**Sign-and-Trade:**

```
EditContractModal.jsx → useArchitectActions.handleSignAndTrade()
  → applyWorldMutation('signAndTrade')
    → loadStateForMutation() (source + dest teams + player)
    → computeWorldMutation() → computeSignAndTradeResult()
    → validateMutation()
      → validateSigning() (contract legality)
      → validateTrade() → validateSignAndTrade() (S&T-specific rules)
    → persistWorldMutation() (atomic batch write)
```

**Extend Player:**

```
EditContractModal.jsx → useArchitectActions.handleExtendContract()
  → applyWorldMutation('extendPlayer')
    → computeWorldMutation() → computeExtensionResult()
    → validateMutation() → validateExtension()
    → persistWorldMutation()
```

---

## Changelog Line for Master Doc

```markdown
| 2026-01-21 | **Phase 30 Preflight:** Group 2 Legality/CBA Compliance Coverage Map. Documented all enforcement paths, identified 3 P0 gaps (max salary, S&T aggregation, vet minimum edge), 4 P1 gaps (designated vet, S&T max, trade bonus, stretch pro-ration). Recommended Phase 31 for max salary enforcement. See `docs/architect/return_packages/PHASE_30_GROUP2_LEGALITY_PREFLIGHT_RETURN_PACKAGE.md`. |
```

---

**END OF PHASE 30 RETURN PACKAGE**
