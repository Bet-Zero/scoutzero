# TM_CAP_AUDITABILITY_P5 — PREFLIGHT RETURN PACKAGE

**Post-State Validator Rule Coverage Map**

Date: 2026-02-28
Mode: PREFLIGHT (Discovery-only; docs-only; NO functional behavior changes)
Master Doc: `docs/architect/CAP_AUDITABILITY_MASTER.md`
Ticket: `TM_CAP_AUDITABILITY_P5`

---

## 1. Executive Summary

The `postStateCapValidator` (v0.1.0) runs after every world mutation, season advance, and base-mode cap-changing action. It is the single post-state gate between compute and persist. Today it enforces **3 rule groups**:

1. **Totals sanity** — all 9 required numeric fields must be finite; year key must be present and match.
2. **Hard cap ceiling** — if a team is hard-capped, team salary must not exceed the applicable ceiling (first or second apron).
3. **Salary floor** — if team salary is below `minimumTeamSalary`, emit a warning (non-blocking).

The full CBA has **27 identifiable cap-legality rules** already implemented across `capLegalityValidation.js` (~4000 lines), trade machine rules, offseason validation, and league invariants. Of these, **19 are expressible as post-state invariants** but are not wired into the post-state validator. The remaining **8 are mutation-specific** (e.g., signing mechanism validation, trade salary matching) and should stay in their current per-mutation validators.

**Proposed v1.0.0 ship set:** Expand the post-state validator from 3 rule groups to **13 rules** by wiring in existing implementations for roster limits, contract row validation, dead cap schema, exception schema, cap holds, and luxury tax warning. All proposed v1.0.0 rules have existing implementations — no new CBA logic required.

**No stop conditions triggered:**
- Single post-state validator found (`postStateCapValidator.ts`). No competing versions.
- No doc/code contradictions discovered.

---

## 2. Rule Matrix

### Legend

- **Applies to:** `world` = world mutation pipeline only; `base` = base-mode only; `both` = world + base-mode
- **Post-state invariant?** `Yes` = can be checked as after-teams snapshot legality; `No` = requires mutation-specific context
- **Current coverage path:** `mutationPipeline` = Phase 3 validateMutation; `postState` = Phase 3.8 postStateCapValidator; `OSTE` = offseason transition engine; `tradeValidator` = trade machine validator; `leagueInv` = Phase 3.5/3.6/3.7 league invariants
- **Ship severity:** `error` = violation (blocks persist); `warning` = advisory (does not block)

### CAP / TAX / APRON

| Rule ID | Rule Name | Category | Applies to | Post-state? | Existing Implementation | Inputs Required | Current Coverage Path | Test Strategy | Ship Severity |
|---------|-----------|----------|------------|-------------|------------------------|-----------------|----------------------|---------------|---------------|
| PSV_CAP_001 | Hard cap ceiling exceeded | cap | both | Yes | `postStateCapValidator.ts:294` (`resolveHardCapCeiling` + salary > ceiling check) | `afterTeamsByCode`, `afterTotalsByTeam`, `rulesContext.hardCapByTeam`, `capSettings.firstApron/secondApron` | postState (v0.1.0) | behavior test: `postStateCapValidator.behavior.test.ts` | error |
| PSV_CAP_002 | Second apron minimum-only signing | cap | both | No (mutation) | `capLegalityValidation.js:3046` (projects cap hit; blocks non-minimum for 2nd apron teams) | `team.totals`, `contract.salariesByYear[0].salary`, `rules.cap.secondApron`, player YOS | mutationPipeline (validateSigning) | unit: `capLegalityValidation.test.js`, `phase40_secondApron_drift_guardrails.test.js` | error |
| PSV_CAP_003 | Exception eligibility (post-apron blocking) | cap | both | No (mutation) | `capLegalityValidation.js:2029` (second apron blocks all exceptions; first apron blocks BAE; room requires under cap) | `team.totals.currentCapHit`, `rules.cap.secondApron/firstApron/salaryCap`, `signedUsing` mechanism | mutationPipeline (validateSigning) | unit: `exceptionBlocking.test.js`, `phase74/75` tests | error |
| PSV_CAP_004 | Luxury tax threshold warning | tax | both | Yes | `computeTeamCapTotals.js:259` (computes `deltas.vsLuxuryTax`); not in postStateCapValidator | `afterTotalsByTeam[team].totalCapAllocations`, `afterTotalsByTeam[team].luxuryTax` | computed in totals but not in postState | behavior test (new) | warning |
| PSV_CAP_005 | First apron proximity warning | apron | both | Yes | `capLegalityValidation.js:3132` (warns when projected cap hit approaches first apron) | `afterTotalsByTeam[team].totalCapAllocations`, `afterTotalsByTeam[team].firstApron` | mutationPipeline (validateSigning only) | unit: `apronSemantics.test.js` | warning |
| PSV_CAP_006 | Second apron proximity warning | apron | both | Yes | `capLegalityValidation.js:3145` (warns when projected cap hit approaches second apron) | `afterTotalsByTeam[team].totalCapAllocations`, `afterTotalsByTeam[team].secondApron` | mutationPipeline (validateSigning only) | unit: `apronSemantics.test.js` | warning |
| PSV_CAP_007 | Trade salary matching | cap | world | No (mutation) | `validateSalaryMatching.js:47` / `validateSalaryMatching.ts:12` (incoming vs outgoing salary parity per CBA) | trade team incoming/outgoing salary, cap status, apron status | tradeValidator | unit: `hardCap_salaryMatching.guardrail.test.js` | error |
| PSV_CAP_008 | Second apron trade restrictions | apron | world | No (mutation) | `basicRules.js:42` (prior-year TPE block, multi-player aggregation block, cash inclusion) | trade team salary, `secondApron`, TPE usage, aggregation mode | tradeValidator | unit: `secondApron_SSOT_guardrail.test.js` | error |

### SALARY FLOOR

| Rule ID | Rule Name | Category | Applies to | Post-state? | Existing Implementation | Inputs Required | Current Coverage Path | Test Strategy | Ship Severity |
|---------|-----------|----------|------------|-------------|------------------------|-----------------|----------------------|---------------|---------------|
| PSV_FLOOR_001 | Salary floor not met | salary_floor | both | Yes | `postStateCapValidator.ts:310` (teamSalary < minimumTeamSalary → warning) | `afterTotalsByTeam[team].teamSalary`, `rulesContext.minimumTeamSalary` | postState (v0.1.0) | behavior test: `postStateCapValidator.behavior.test.ts` | warning |

### TOTALS SANITY

| Rule ID | Rule Name | Category | Applies to | Post-state? | Existing Implementation | Inputs Required | Current Coverage Path | Test Strategy | Ship Severity |
|---------|-----------|----------|------------|-------------|------------------------|-----------------|----------------------|---------------|---------------|
| PSV_TOTALS_001 | Totals fields finite | totals | both | Yes | `postStateCapValidator.ts:160` (`validateTotalsSanity` — checks 9 fields: `playersTotal`, `deadMoneyTotal`, `capHoldsTotal`, `incompleteChargesTotal`, `totalCapAllocations`, `salaryCap`, `luxuryTax`, `firstApron`, `secondApron`) | `beforeTotalsByTeam`, `afterTotalsByTeam` | postState (v0.1.0) | behavior test: `postStateCapValidator.behavior.test.ts` (NaN test) | error |
| PSV_TOTALS_002 | Year key present and matching | totals | both | Yes | `postStateCapValidator.ts:160` (`validateTotalsSanity` — `yearKey` must exist and match expected year) | `beforeTotalsByTeam`, `afterTotalsByTeam`, `year` | postState (v0.1.0) | behavior test (same file) | error |
| PSV_TOTALS_003 | Totals snapshot not missing | totals | both | Yes | `postStateCapValidator.ts:160` (`validateTotalsSanity` — totals object must be present) | `beforeTotalsByTeam`, `afterTotalsByTeam` | postState (v0.1.0) | behavior test (same file) | error |

### ROSTER

| Rule ID | Rule Name | Category | Applies to | Post-state? | Existing Implementation | Inputs Required | Current Coverage Path | Test Strategy | Ship Severity |
|---------|-----------|----------|------------|-------------|------------------------|-----------------|----------------------|---------------|---------------|
| PSV_ROSTER_001 | Max standard roster exceeded (15) | roster | both | Yes | `rosterValidation.js:17` (`validateRosterWindow`); `capLegalityValidation.js:79` (`roster_size` in `HARD_BLOCK_RULES`) | `afterTeamsByCode[team].players` (standard contract count) | mutationPipeline (validateSigning/validateWaive); tradeValidator; OSTE | behavior test (new); source guardrail: `goldenTrades.test.js` | error |
| PSV_ROSTER_002 | Min standard roster not met (14) | roster | both | Yes | `rosterValidation.js:8`; `capLegalityValidation.js:215` (`roster_minimum` in `SOFT_WARNING_RULES`); `resolveOffseasonTransition.ts:438` | `afterTeamsByCode[team].players` (standard contract count), grace period flag | mutationPipeline (validateSigning); OSTE | behavior test (new) | warning |
| PSV_ROSTER_003 | Two-way contract limit exceeded (3) | roster | both | Yes | `rosterValidation.js:8`; `resolveOffseasonTransition.ts:454` (`two_way_limit` check) | `afterTeamsByCode[team].players` (two-way contract count) | mutationPipeline (validateSigning); OSTE | behavior test (new); source guardrail: `goldenTrades.test.js` | error |

### CONTRACTS

| Rule ID | Rule Name | Category | Applies to | Post-state? | Existing Implementation | Inputs Required | Current Coverage Path | Test Strategy | Ship Severity |
|---------|-----------|----------|------------|-------------|------------------------|-----------------|----------------------|---------------|---------------|
| PSV_CONTRACT_001 | Salary row schema invalid | contracts | both | Yes | `capLegalityValidation.js:639` (`validateSalaryRowSchema` — salary >= 0, capHit >= 0, season is string) | `afterTeamsByCode[team].players[].contract.salariesByYear[]` | mutationPipeline (validateSigning); OSTE | unit: embedded in `capLegalityValidation.test.js` | error |
| PSV_CONTRACT_002 | Guarantee amounts invalid | contracts | both | Yes | `capLegalityValidation.js:711` (`validateGuaranteesPolicy` — guaranteedAmount <= salary) | same as above + `guaranteedAmount`, `guaranteed` fields | mutationPipeline (validateSigning); OSTE | unit: embedded in `capLegalityValidation.test.js` | error |
| PSV_CONTRACT_003 | Contract option types invalid | contracts | both | Yes | `capLegalityValidation.js:787` (`validateOptionsPolicy` — option must be null, "Team Option", or "Player Option") | same as above + `option` field | mutationPipeline (validateSigning); OSTE | unit: embedded in `capLegalityValidation.test.js` | error |
| PSV_CONTRACT_004 | Contract rows overall invalid | contracts | both | Yes | `capLegalityValidation.js:837` (`validateContractRows` — runs schema + guarantee + option per row) | `afterTeamsByCode[team].players[].contract` | mutationPipeline (validateSigning); OSTE | unit: `capLegalityValidation.test.js` | error |

### DEAD MONEY

| Rule ID | Rule Name | Category | Applies to | Post-state? | Existing Implementation | Inputs Required | Current Coverage Path | Test Strategy | Ship Severity |
|---------|-----------|----------|------------|-------------|------------------------|-----------------|----------------------|---------------|---------------|
| PSV_DEAD_001 | Dead cap schema invalid | dead_money | both | Yes | `capLegalityValidation.js:888` (`validateDeadCap` — array check, `amountByYear` object, amounts > 0, `stretched` boolean) | `afterTeamsByCode[team].deadCap` | mutationPipeline (setDeadCap case only) | unit: `deadCapManagement.test.js` | error |

### EXCEPTIONS

| Rule ID | Rule Name | Category | Applies to | Post-state? | Existing Implementation | Inputs Required | Current Coverage Path | Test Strategy | Ship Severity |
|---------|-----------|----------|------------|-------------|------------------------|-----------------|----------------------|---------------|---------------|
| PSV_EXC_001 | Exception schema invalid | exceptions | both | Yes | `capLegalityValidation.js:963` (`validateExceptions` — object check, valid keys, enabled boolean, amounts finite) | `afterTeamsByCode[team].exceptions` (mle/tpmle/bae/room) | mutationPipeline (setExceptions case); OSTE | unit: `exceptionManagement.test.js` | error |
| PSV_EXC_002 | Exception amounts invalid (used > total) | exceptions | both | Yes | `capLegalityValidation.js:963` (same function — `usedAmount <= totalAmount` check) | same as above | mutationPipeline (setExceptions case); OSTE | unit: `exceptionManagement.test.js` | error |

### CAP HOLDS

| Rule ID | Rule Name | Category | Applies to | Post-state? | Existing Implementation | Inputs Required | Current Coverage Path | Test Strategy | Ship Severity |
|---------|-----------|----------|------------|-------------|------------------------|-----------------|----------------------|---------------|---------------|
| PSV_HOLD_001 | Cap hold amounts invalid | holds | both | Yes | `resolveOffseasonTransition.ts:530` (`isCapHoldAmountValid` per hold) | `afterTeamsByCode[team].capHolds[]` | OSTE only | behavior test (new) | error |

### LEAGUE INVARIANTS

| Rule ID | Rule Name | Category | Applies to | Post-state? | Existing Implementation | Inputs Required | Current Coverage Path | Test Strategy | Ship Severity |
|---------|-----------|----------|------------|-------------|------------------------|-----------------|----------------------|---------------|---------------|
| PSV_LEAGUE_001 | No duplicate players cross-team | league | world | Yes | `leagueInvariants.ts:109` (`validateNoDuplicatePlayers`) | all teams in scope (full league snapshot) | leagueInv (Phase 3.5) | integration: `phaseC_entitlement_invariants_integration.test.ts` | error |
| PSV_LEAGUE_002 | No duplicate entitlements cross-team | league | world | Yes | `leagueInvariants.ts:446` (`validateNoDuplicateEntitlements`) | all teams + entitlements (full league snapshot) | leagueInv (Phase 3.6) | integration: same file | error |
| PSV_LEAGUE_003 | Entitlement exclusivity | league | world | Yes | `leagueInvariants.ts:725` (`validateTradeApplyExclusivity`) | all teams + entitlements (full league snapshot) | leagueInv (Phase 3.7) | integration: same file | error |

### INCOMPLETE ROSTER CHARGE

| Rule ID | Rule Name | Category | Applies to | Post-state? | Existing Implementation | Inputs Required | Current Coverage Path | Test Strategy | Ship Severity |
|---------|-----------|----------|------------|-------------|------------------------|-----------------|----------------------|---------------|---------------|
| PSV_CHARGE_001 | Incomplete roster charge parity | roster | both | Yes | `computeTeamCapTotals.js:204` (computed as part of `incompleteChargesTotal`) | `afterTeamsByCode[team].players` count, `rules.roster.minStandard` | computed in totals, not validated independently | behavior test (new) | warning |

---

## 3. Existing Validator Inventory

### A. Post-State Cap Validator (SSOT — current v0.1.0)

**File:** `src/features/architect/utils/capLegality/postStateCapValidator.ts`

| Export | Line | What It Does |
|--------|------|-------------|
| `POST_STATE_CAP_VALIDATOR_VERSION` | 7 | Constant `'0.1.0'` — stamped into every audit event |
| `PostStateCapValidationIssue` | 11 | Type: `{ code, teamCode, path, message, expected?, actual? }` |
| `PostStateCapValidationResult` | 20 | Type: `{ valid, violations[], warnings[] }` |
| `PostStateCapValidationInput` | 26 | Input shape with operationId, mutationType, worldId, before/after teams+totals, rulesContext |
| `validateTotalsSanity` | 160 | Internal: checks yearKey + 9 required numeric fields finite |
| `resolveHardCapCeiling` | 83 | Internal: resolves hard cap ceiling from rulesContext / team / totals |
| `getTeamSalaryFromTotals` | 69 | Internal: resolves team salary from totals |
| `validatePostStateCapLegality` | 219 | Main: runs operationId check, team scope check, totals sanity, hard cap, salary floor |

**Current rule coverage:** 3 rule groups (PSV_TOTALS_001-003, PSV_CAP_001, PSV_FLOOR_001).

### B. Cap Legality Validation (Mutation-Specific Validators)

**File:** `src/features/architect/utils/capLegalityValidation.js` (~4000 lines)

| Function | Line | Mutation Scope |
|----------|------|---------------|
| `validateSalaryRowSchema` | 639 | Per contract row (used by validateContractRows) |
| `validateGuaranteesPolicy` | 711 | Per contract row |
| `validateOptionsPolicy` | 787 | Per contract row |
| `validateContractRows` | 837 | Per contract (used by validateSigning, OSTE) |
| `validateDeadCap` | 888 | setDeadCap mutations |
| `validateExceptions` | 963 | setExceptions mutations, OSTE |
| `validateExceptionEligibility` | 2029 | Signing mutations (apron blocking) |
| `validateSigning` | 2199 | signFreeAgent mutations |
| `validateWaive` | 3167 | waivePlayer mutations |
| `validateExtension` | 3273 | extendPlayer mutations |
| `validateOptionDecision` | 3425 | optionDecision mutations |
| `validateRenounceRights` | 3758 | renounceRights mutations |
| `validateOfferSheetResolution` | 3819 | match/decline/finalize offer sheet mutations |
| `validateSigningTermsAndRaises` | 1690 | Signing term validation |
| `validateExtensionTermsAndRaises` | 1920 | Extension term validation |

**Constants:**
- `HARD_BLOCK_RULES` (line 77): ~30 rule codes that can never be overridden
- `SOFT_WARNING_RULES` (line 214): ~20 rule codes that can be overridden in dev mode

### C. Mutation Pipeline Orchestrator

**File:** `src/features/architect/utils/mutationPipeline.js`

`validateMutation` (line 2468) switch cases:

| Case | Validator Called |
|------|----------------|
| `setDeadCap` | `validateDeadCap(payload.deadCap)` |
| `setExceptions` | `validateExceptions(payload.exceptions)` |
| `signFreeAgent` | `validateSigning(...)` |
| `waivePlayer` | `validateWaive(...)` |
| `extendPlayer` | `validateExtension(...)` |
| `optionDecision` | `validateOptionDecision(...)` |
| `storeOfferSheet` | `validateSigning(...)` |
| `matchOfferSheet` | `validateOfferSheetResolution(action:'match')` |
| `declineOfferSheet` | `validateOfferSheetResolution(action:'decline')` |
| `finalizeMatchedOfferSheet` | `validateOfferSheetResolution(action:'finalize')` |
| `finalizeDeclinedOfferSheet` | `validateOfferSheetResolution(action:'finalize')` |
| `renounceRights` | `validateRenounceRights(...)` |
| `signAndTrade` | Pre-validated via `_signingValidation` + `_validatedTradeContext` |
| `executeTrade` | Pre-validated via `_validatedTradeContext` (before switch) |

Full pipeline execution order in `applyWorldMutation`:
1. `loadStateForMutation()` — Firestore read
2. `computeWorldMutation()` — pure compute (includes trade pre-validation)
3. `validateMutation()` — type-specific mutation validators
4. `validateMutationLeagueInvariants()` — cross-team duplicate player check
5. `validateMutationEntitlementInvariants()` — cross-team entitlement check
6. `validateTradeApplyExclusivity()` — per-team entitlement exclusivity
7. `validatePostStateCapLegality()` — post-state cap sanity + hard cap + floor
8. `persistWorldMutation()` — Firestore batch write
9. `updateWorldStats()` — post-update

### D. Offseason Transition Validator

**File:** `src/features/architect/utils/offseason/resolveOffseasonTransition.ts`

`validateOffseasonState` (line 415, private/not exported):

| Check | Line | Rule Mapped To |
|-------|------|---------------|
| Roster minimum (`standardRosterCount < rules.roster.graceMin`) | 438 | PSV_ROSTER_002 |
| Roster maximum (`standardRosterCount > rules.roster.maxStandard`) | 446 | PSV_ROSTER_001 |
| Two-way limit (`twoWayCount > rules.roster.maxTwoWay`) | 454 | PSV_ROSTER_003 |
| Hard cap violation (pre-transition state) | 462 | PSV_CAP_001 |
| Exception schema validation | 500 | PSV_EXC_001/002 |
| Cap hold validity | 530 | PSV_HOLD_001 |
| Contract row validation | 542 | PSV_CONTRACT_004 |

### E. League Invariants

**File:** `src/features/architect/utils/leagueInvariants.ts`

| Function | Line | Pipeline Phase |
|----------|------|---------------|
| `validateNoDuplicatePlayers` | 109 | Phase 3.5 |
| `validateMutationLeagueInvariants` | 346 | Phase 3.5 |
| `validateNoDuplicateEntitlements` | 446 | Phase 3.6 |
| `validateMutationEntitlementInvariants` | 496 | Phase 3.6 |
| `validatePickSlotAccounting` | 562 | (not in main pipeline) |
| `validateTradeApplyExclusivity` | 725 | Phase 3.7 |

### F. Trade Machine Rules

**Directory:** `src/features/architect/utils/tradeMachine/rules/`

| File | Key Validator |
|------|--------------|
| `basicRules.js` | `validateSecondApronRules` |
| `validateSalaryMatching.js/.ts` | `validateSalaryMatching` |
| `validateHardCap.ts` / `hardCapValidation.js` | `validateHardCap` (trade context) |
| `validateTradeExceptions.js` | `validateTradeExceptions` (TPE) |
| `validateRoster.js/.ts` / `rosterValidation.js` | `validateRoster`, `validateRosterWindow` |
| `validateStepien.js/.ts` | `validateStepien` |
| `validateAggregation.js` | `validateAggregation` |
| `validateSignAndTrade.js` | `validateSignAndTrade` |
| `validateEntitlementRouting.js` | `validateEntitlementRouting`, `validateEntitlementLinkageLegality` |
| `validatePlayerRouting.js` | `validatePlayerRouting` |
| `draftRules.js` | `validateDraftPicks` |
| `eligibilityRules.js` | `validateReacquisition`, `validateCash` |
| `miscRules.js` | `validateBYC`, `validatePlayerConsent` |
| `timingValidation.js` | `validateTiming` |

### G. Hard Cap Helpers

| File | Key Functions |
|------|--------------|
| `hardCapUtils.js` | `checkIfActionTriggersHardCap`, `applyHardCapTrigger`, `wouldExceedHardCap`, `getHardCapLimit` |
| `hardCapStatus.js` | `getHardCapStatus` (SSOT for trade context), `isTeamHardCapped` |
| `capLegalityValidation.js:430` | `getHardCapStatus` (non-trade context) |

### H. Cap Totals SSOT

**File:** `src/features/architect/utils/capTotals/computeTeamCapTotals.js`

`computeTeamCapTotals` (line 204): canonical totals computation. Returns `playersTotal`, `deadMoneyTotal`, `capHoldsTotal`, `incompleteChargesTotal`, `totalCapAllocations`, plus `salaryCap`, `luxuryTax`, `firstApron`, `secondApron`, and `deltas`.

Called by `mutationPipeline.js` (line 516: `buildTotalsByTeam`), all compute result functions, and cap sheet UI.

---

## 4. Gaps List

### A. Rules That Exist But Are NOT Wired Into Post-State Validation

These rules have working implementations but are only checked in mutation-specific validators or OSTE, not in the universal post-state validator:

| Rule ID | Rule | Current Coverage | Gap |
|---------|------|-----------------|-----|
| PSV_ROSTER_001 | Max roster (15) | mutationPipeline, tradeValidator, OSTE | Not in postStateCapValidator |
| PSV_ROSTER_002 | Min roster (14) | mutationPipeline (signing only), OSTE | Not in postStateCapValidator |
| PSV_ROSTER_003 | Two-way limit (3) | mutationPipeline (signing only), OSTE | Not in postStateCapValidator |
| PSV_CONTRACT_001-004 | Contract row validity | mutationPipeline (signing only), OSTE | Not in postStateCapValidator |
| PSV_DEAD_001 | Dead cap schema | mutationPipeline (setDeadCap only) | Not in postStateCapValidator |
| PSV_EXC_001-002 | Exception schema | mutationPipeline (setExceptions only), OSTE | Not in postStateCapValidator |
| PSV_HOLD_001 | Cap hold amounts | OSTE only | Not in postStateCapValidator |
| PSV_CAP_004 | Luxury tax warning | computed in totals (delta) | Not surfaced as post-state warning |
| PSV_CAP_005-006 | Apron proximity warnings | mutationPipeline (signing only) | Not in postStateCapValidator |
| PSV_CHARGE_001 | Incomplete roster charge parity | computed in totals | Not validated independently |

### B. Rules That SHOULD Remain Mutation-Specific

These rules require mutation-specific context (the type of action, specific contract terms, trade structure) and cannot be expressed as pure after-state invariants:

| Rule | Why Mutation-Specific |
|------|----------------------|
| PSV_CAP_002 — Second apron minimum-only signing | Requires knowing the signing mechanism and player YOS |
| PSV_CAP_003 — Exception eligibility blocking | Requires knowing which exception is being used |
| PSV_CAP_007 — Trade salary matching | Requires knowing incoming vs outgoing salary per trade |
| PSV_CAP_008 — Second apron trade restrictions | Requires trade structure (aggregation, TPE usage, cash) |
| Signing terms/raises validation | Requires contract terms, mechanism, engine comparisons |
| Extension terms/raises validation | Requires extension terms, baseline salary, engine comparisons |
| Offer sheet workflow | Requires offer sheet state machine (match/decline/finalize) |
| Stepien rule | Requires trade structure (consecutive pick conveyance) |
| Reacquisition rule | Requires trade context (player recently traded) |
| BYC (Base Year Compensation) | Requires trade context (player's BYC status) |
| Timing validation | Requires trade moratorium/deadline context |
| Draft pick validation | Requires trade-specific pick routing |
| S&T aggregation | Requires trade structure (S&T + other players) |
| Player consent | Requires trade-specific no-trade clause context |

### C. Rules Totally Absent (Not Implemented Anywhere)

Noted for awareness only — these are **not** designed in this preflight:

| Gap | Description |
|-----|-------------|
| Totals arithmetic parity | No check that `totalCapAllocations === playersTotal + deadMoneyTotal + capHoldsTotal + incompleteChargesTotal` in post-state (computation is trusted) |
| Cross-year contract continuity | No check that contract year sequences are contiguous across seasons |
| TPE-to-totals reconciliation | No check that TPE amounts align with totals or exception slots |
| Cap hold completeness | No check that all unsigned Bird rights players have corresponding cap holds |
| Salary cap line freshness | No check that cap settings year matches the operational year |

---

## 5. Proposed E5 Execution Scope

### v1.0.0 Minimal Ship Set

The smallest set that makes "cap sheet is ship-auditable" true. All rules below have existing implementations.

| Rule ID | Rule | Action in E5 | Severity |
|---------|------|-------------|----------|
| PSV_TOTALS_001-003 | Totals sanity (3 checks) | Already in v0.1.0 — no change | error |
| PSV_CAP_001 | Hard cap ceiling | Already in v0.1.0 — no change | error |
| PSV_FLOOR_001 | Salary floor | Already in v0.1.0 — no change | warning |
| PSV_ROSTER_001 | Max roster (15) | Wire into postStateCapValidator using `afterTeamsByCode[team].players` count | error |
| PSV_ROSTER_003 | Two-way limit (3) | Wire into postStateCapValidator using two-way contract count | error |
| PSV_CONTRACT_004 | Contract rows valid | Import `validateContractRows` from `capLegalityValidation.js`; run per player per team | error |
| PSV_DEAD_001 | Dead cap schema valid | Import `validateDeadCap` from `capLegalityValidation.js`; run per team | error |
| PSV_EXC_001-002 | Exception schema valid | Import `validateExceptions` from `capLegalityValidation.js`; run per team | error |
| PSV_HOLD_001 | Cap hold amounts valid | Wire `isCapHoldAmountValid` check per hold per team | error |
| PSV_CAP_004 | Luxury tax threshold warning | Read `deltas.vsLuxuryTax` from afterTotals; warn if > 0 | warning |

**Acceptance criteria for v1.0.0:**
1. `POST_STATE_CAP_VALIDATOR_VERSION` bumped to `'1.0.0'`
2. All 13 rules above produce correct violations/warnings in behavior tests
3. All rules run on both world mutations and base-mode paths
4. Season advance path runs same expanded validator
5. No regression in existing `test:architect` or `test:trade` suites
6. Return package with before/after rule counts and test evidence

**Estimated effort:** Low-medium. All validators exist. Work is wiring + testing, not invention.

### v1.1+ Backlog

| Rule ID | Rule | Why Deferred |
|---------|------|-------------|
| PSV_ROSTER_002 | Min roster (14) | Needs grace period awareness (offseason min = 13, regular = 14); not a hard block today |
| PSV_LEAGUE_001-003 | League invariants | Require full-league snapshot (expensive); already covered in dedicated pipeline phases |
| PSV_CHARGE_001 | Incomplete roster charge parity | Low-severity (warning); charge is already computed correctly in totals |
| PSV_CAP_005-006 | Apron proximity warnings | Polish-tier; useful but not ship-gating |
| Totals arithmetic parity | New rule needed; trustworthy computation exists but no independent parity check |
| Cross-year contract continuity | New rule needed; not CBA-critical for single-season correctness |
| TPE-to-totals reconciliation | New rule needed; edge case but low priority |

---

## 6. Commands Run + Result Counts

| # | Pattern | Scope | Occurrences | Files |
|---|---------|-------|-------------|-------|
| 1 | `postStateCapValidator\|validatePostStateCapLegality` | `src/` | 18 | 5 |
| 2 | `capLegalityValidation\|validateContractRows\|validate.*Cap\|hardCap\|apron\|tax\|floor\|minimumTeamSalary` | `src/` | 230 | 40 |
| 3 | `validateOffseasonState\|resolveOffseasonTransition\|computeTeamCapTotals` | `src/` | 305 | 48 |
| 4 | `validateMutation\(` | `mutationPipeline.js` | 2 | 1 |
| 5 | `events\|CapAuditEventV1\|operationId\|validatorVersion` | `src/` | 177 | 40 |

---

## 7. Files Edited (Docs Only)

| File | Action | Sections Added |
|------|--------|---------------|
| `return_packages/architect/TM_CAP_AUDITABILITY_P5_PREFLIGHT_RETURN_PACKAGE.md` | Created | All 7 sections (this file) |
| `docs/architect/CAP_AUDITABILITY_MASTER.md` | Edited | "Post-State Validator Coverage Map (P5)" + "Proposed E5 Execution Scope" |
| `docs/SHIP_GATES_MASTER.md` | Edited | "Post-State Validator v1.0.0 Rule Coverage Checklist (Draft Gate)" |

---

## Appendix: Stop Condition Report

| Condition | Status | Detail |
|-----------|--------|--------|
| Multiple competing post-state validators | CLEAR | Single validator: `postStateCapValidator.ts`. No duplicates or forks. |
| Doc/code contradictions on CBA constants | CLEAR | `minimumTeamSalary` consistently sourced from `capSettings.floor`. Hard cap uses strict `>` for second apron per CBA Art VII Sec 2(f) in all locations. `firstApron` uses `>=` consistently. |
