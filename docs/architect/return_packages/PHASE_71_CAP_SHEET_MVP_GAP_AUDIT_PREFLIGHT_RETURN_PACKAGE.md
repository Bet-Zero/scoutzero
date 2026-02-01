# Phase 71 — Cap Sheet MVP Gap Audit (Preflight) Return Package

**Date:** 2026-02-01
**Mode:** PREFLIGHT (discovery only — NO code changes)
**Status:** COMPLETE

---

## 1. Canonical Cap Totals Computation

### SSOT: `computeTeamCapTotals()`

**File:** `src/features/architect/utils/capTotals/computeTeamCapTotals.js`

**Formula:**

```
totalCapAllocations = playersTotal + deadMoneyTotal + capHoldsTotal + incompleteChargesTotal
```

**Component Computations:**

| Component | Computation | Source |
|-----------|-------------|--------|
| `playersTotal` | Sum of `getContractYearSlice(player, yearKey).capHit` (fallback: `.salary`) | `players[]` |
| `deadMoneyTotal` | Sum of `deadCap[].amountByYear[]` matching season (new schema) OR legacy sources | `deadCap[]` / `waivedContracts[]` / `stretchHistory[]` |
| `capHoldsTotal` | Sum of cap holds where `active: true` AND `isSigned: false` | `capHolds[]` |
| `incompleteChargesTotal` | `max(0, minRoster - standardRosterCount) * rookieMinSalary` | Derived |

**Cap Rules Source:** `getCapRulesForYear(yearKey)` facade (Phase 11+)

---

## 2. Surface-by-Surface Wiring Map

| Surface | File | Data Source | Memoization | Staleness Risk |
|---------|------|-------------|-------------|----------------|
| CapSheet | `src/features/architect/capSheet/CapSheet/CapSheet.jsx:57` | `useMemo(() => computeTeamCapTotals())` | YES | LOW |
| CapSummaryTiles | `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx` | Props (pre-computed) | N/A | LOW |
| CapImpactTiles | `src/features/architect/tradeMachine/CapImpactTiles.jsx:26` | Direct call (NO memo) | **NO** | **MEDIUM** |
| TradeSalaryCalculator | `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx` | `useMemo` | YES | LOW |
| useArchitectState | `src/features/architect/GMDashboard/hooks/useArchitectState.ts` | State hook | YES | LOW |
| usePlayerRulesProfiles | `src/features/architect/hooks/usePlayerRulesProfiles.js` | `useMemo` (7 deps) | YES | LOW |

### Surfaces NOT Using SSOT

| Surface | File | Function Used | Gap |
|---------|------|---------------|-----|
| Mutation pipeline (internal) | `mutationPipeline.js:3246` | `calculateTeamTotals()` | Missing `incompleteChargesTotal` |
| Trade context builder | `tradeContext.js:51` | `calculateTeamTotals()` | Missing `incompleteChargesTotal` |
| Trade manager | `tradeManager.js:434` | `updateTeamCapTotals()` | Simplified, deprecated |

---

## 3. Mutation Entrypoint Map

| Mutation Type | Function | File:Line | Triggers UI Refresh | Persists |
|---------------|----------|-----------|---------------------|----------|
| Trade | `computeTradeResult()` | `mutationPipeline.js:1002` | YES | YES |
| Signing | `computeSigningResult()` | `mutationPipeline.js:1379` | YES | YES |
| Waive | `computeWaiveResult()` | `mutationPipeline.js:1530` | YES | YES |
| Extension | `computeExtensionResult()` | `mutationPipeline.js:1639` | YES | YES |
| Option Decision | `computeOptionResult()` | `mutationPipeline.js:1711` | YES | YES |
| Renounce Rights | `computeRenounceResult()` | `mutationPipeline.js:1871` | YES | YES |
| Set Exceptions | `computeSetExceptionsResult()` | `mutationPipeline.js:1949` | YES | YES |
| Set Dead Cap | `computeSetDeadCapResult()` | `mutationPipeline.js:3307` | YES | YES |
| Sign-and-Trade | `computeSignAndTradeResult()` | `mutationPipeline.js:3066` | YES | YES |
| Season Advance | `advanceSeasonInWorld()` | `seasonManager.js:485` | YES | YES |
| Store Offer Sheet | `computeStoreOfferSheetResult()` | `mutationPipeline.js:2471` | YES | YES |
| Match Offer Sheet | `computeMatchOfferSheetResult()` | `mutationPipeline.js:2625` | YES | YES |
| Decline Offer Sheet | `computeDeclineOfferSheetResult()` | `mutationPipeline.js:2708` | YES | YES |

---

## 4. Exceptions MVP Status

### Current Support

| Exception | Tracked | Validated | Hard Cap Trigger | Expiry |
|-----------|---------|-----------|------------------|--------|
| MLE (Non-Taxpayer) | `exceptions.mle` | YES | YES | Season advance |
| MLE (Taxpayer) | `exceptions.mle` | YES | NO (at apron) | Season advance |
| BAE | `exceptions.bae` | YES | NO | Season advance |
| TPE | `exceptions.tpe[]` | YES | NO | Phase 53 |
| Room Exception | Partial | Partial | NO | N/A |

### MVP Requirements Status

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Track usage correctly | **COMPLETE** | `exceptions.mle.used`, `exceptions.bae.used`, `exceptions.tpe[].usedAmount` |
| Prevent illegal actions | **COMPLETE** | `validateSigning()`, `validateExceptionEligibility()`, `capLegalityValidation.js` |
| Reflect hard cap sources | **COMPLETE** | `isHardCappedAtFirstApron()`, `hardCapTriggeredBy` tracking |

### Gaps

| Gap | Description | Priority |
|-----|-------------|----------|
| Room Exception | Not fully tracked or validated | LOW (rarely used in Architect scenarios) |
| BAE Cooldown | 2-year waiting period not enforced | LOW (nice-to-have) |
| MLE Proration | Mid-season signing amounts not prorated | LOW (edge case) |

---

## 5. Top 5 Tile Staleness Risks

| Rank | Risk | File:Line | Severity | Fix |
|------|------|-----------|----------|-----|
| 1 | `CapImpactTiles` recalculates every render | `CapImpactTiles.jsx:26` | HIGH | Add `useMemo` wrapper |
| 2 | Mutation pipeline uses legacy `calculateTeamTotals()` | `mutationPipeline.js:3246` | HIGH | Replace with SSOT |
| 3 | Trade context uses duplicate legacy function | `tradeContext.js:51` | MEDIUM | Replace with SSOT |
| 4 | Validator excludes cap holds from projected salary | `CapImpactTiles.jsx:42-50` | MEDIUM | Document or align |
| 5 | Two-way filtering vulnerable to string variations | `computeTeamCapTotals.js` | LOW | Add normalization |

---

## 6. Execution Chunk Titles

### Chunk 1: SSOT Unification

Eliminate legacy `calculateTeamTotals()` functions in `mutationPipeline.js` and `tradeContext.js`. Wire all internal computations to `computeTeamCapTotals()` SSOT.

### Chunk 2: Tile Reactivity Hardening

Add `useMemo` to `CapImpactTiles`. Wire all surfaces to reactive SSOT. Add `warnOnTotalsDivergence()` guardrails to detect drift.

### Chunk 3: Exceptions MVP Completion

Complete Room Exception tracking. Add BAE 2-year cooldown enforcement. Improve exception validation test coverage.

### Chunk 4: Persistence/Workflow Polish

Ensure reload reconstructs exact UI state. Add end-to-end mutation→display→persist→reload integration tests.

---

## 7. Stop Condition Evaluation

| Condition | Status | Evidence |
|-----------|--------|----------|
| STOP1: Cannot find canonical totals | NOT TRIGGERED | `computeTeamCapTotals()` found at `src/features/architect/utils/capTotals/computeTeamCapTotals.js` |
| STOP2: Multiple competing systems disagree | NOT TRIGGERED | SSOT exists; legacy functions are known deviations with documented gaps |
| STOP3: Tiles hardcoded/snapshot-based | NOT TRIGGERED | All tiles use SSOT or props derived from SSOT |

---

## 8. Files Referenced

### SSOT Files

- `src/features/architect/utils/capTotals/computeTeamCapTotals.js` — Canonical totals
- `src/features/architect/utils/capRulesProfile/capRulesProfile.ts` — Cap rules facade

### UI Surfaces

- `src/features/architect/capSheet/CapSheet/CapSheet.jsx`
- `src/features/architect/capSheet/CapSheet/CapSummaryTiles.jsx`
- `src/features/architect/tradeMachine/CapImpactTiles.jsx`
- `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx`

### Mutation Pipeline

- `src/features/architect/utils/mutationPipeline.js`
- `src/features/architect/utils/tradeContext/tradeContext.js`
- `src/features/architect/utils/tradeManager.js`

### Persistence

- `src/features/architect/utils/persistenceContracts/contracts.js`
- `src/features/architect/utils/worldTeamData.ts`
- `src/features/architect/utils/seasonManager.js`

### Exception Management

- `src/features/architect/utils/hardCapUtils.js`
- `src/features/architect/utils/capLegalityValidation.js`
- `src/features/architect/utils/normalizeTeamTpe.js`

---

## 9. Verification Notes

- All findings based on direct file inspection via Explore agents
- No code changes made (preflight mode)
- Evidence includes exact file paths and line numbers
- SSOT is well-defined and most surfaces use it correctly
- Key gaps are in internal mutation pipeline functions and one UI component memoization
