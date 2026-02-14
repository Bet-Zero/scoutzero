# TM_SEC_A1 — Section Audit: Salary Matching (Section 3)

**Audit Date:** 2026-02-14  
**Mode:** PREFLIGHT (Discovery-only)  
**Section:** 3 (Salary Matching Engine)  
**Status:** PASS (All items validated)

---

## Executive Summary

Section 3 (Salary Matching) passes audit. The implementation uses a properly centralized single source of truth architecture with appropriate drift guardrails.

| Category               | Result                                                 |
| ---------------------- | ------------------------------------------------------ |
| Salary Input Sources   | ✅ PASS — Single canonical path                        |
| Matching Thresholds    | ✅ PASS — Centralized in `SALARY_MATCHING_TIERS`       |
| UI/Validator Alignment | ✅ PASS — Uses `getOfficialSalaryMatchingSnapshot()`   |
| Drift Protection       | ✅ PASS — `warnOnTotalsDivergence()` guardrails active |

---

## 1) How It Works Today

### Data Flow: UI → Compute → Validate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SALARY MATCHING PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐   │
│  │ Player Salary   │     │ Matching Value  │     │ Team Salary Totals  │   │
│  │ (Base)          │────▶│ Computation     │────▶│ (salaryOut/salaryIn)│   │
│  └─────────────────┘     └─────────────────┘     └─────────────────────┘   │
│         │                        │                        │                 │
│         ▼                        ▼                        ▼                 │
│  getSalaryForYear()      computeMatchingValues()   tradeValidator.js       │
│  [tradeHelpers.js]       [matchingValues.js]       [L533-558]              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────────┐    ┌────────────────────┐ │
│  │ Allowable       │     │ Salary Matching     │    │ Official Snapshot  │ │
│  │ Incoming        │◀────│ Validation          │────│ for UI             │ │
│  │ Calculation     │     │                     │    │                    │ │
│  └─────────────────┘     └─────────────────────┘    └────────────────────┘ │
│         │                        │                         │               │
│         ▼                        ▼                         ▼               │
│  getSalaryMatchingResult()  validateSalaryMatching()  getOfficialSalary   │
│  [salaryMatchingRules.js]   [validateSalaryMatching.js] MatchingSnapshot() │
│                                                     [getOfficialSalary    │
│                                                      MatchingSnapshot.js] │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component                             | Location                                                                                                                   | Purpose                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `getSalaryForYear()`                  | [tradeHelpers.js](src/features/architect/utils/tradeHelpers.js#L39)                                                        | Extracts base salary from `contract.salariesByYear[].capHit` |
| `computeMatchingValues()`             | [matchingValues.js](src/features/architect/utils/tradeMachine/utils/matchingValues.js#L57)                                 | Applies BYC, trade kicker, poison pill adjustments           |
| `SALARY_MATCHING_TIERS`               | [salaryMatchingRules.js](src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js#L28)                       | Centralized band thresholds and multipliers                  |
| `getSalaryMatchingResult()`           | [salaryMatchingRules.js](src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js#L182)                      | "SINGLE SOURCE OF TRUTH" for matching calculations           |
| `validateSalaryMatching()`            | [validateSalaryMatching.js](src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js#L45)                 | Validator that delegates to `getSalaryMatchingResult()`      |
| `getOfficialSalaryMatchingSnapshot()` | [getOfficialSalaryMatchingSnapshot.js](src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js#L58) | "CANONICAL SELECTOR" for UI consumption                      |

---

## 2) Single Source of Truth Check

### ✅ PASS

| Concept            | Source                                            | Verified                                                     |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------ |
| Band thresholds    | `SALARY_MATCHING_TIERS` in salaryMatchingRules.js | ✅ Lines 28-47                                               |
| Band calculation   | `getSalaryMatchingResult()`                       | ✅ All paths route here                                      |
| UI display values  | `getOfficialSalaryMatchingSnapshot()`             | ✅ Declared as "CANONICAL SELECTOR" in file header           |
| salaryOut/salaryIn | `tradeValidator.js` L533-558                      | ✅ Single compute path using `matchOutgoing`/`matchIncoming` |

### Code Evidence

**salaryMatchingRules.js L167-170:**

```javascript
/**
 * Main unified function to compute salary matching result.
 * This is the SINGLE SOURCE OF TRUTH for salary matching calculations.
 */
export function getSalaryMatchingResult({ ... })
```

**getOfficialSalaryMatchingSnapshot.js L1-14:**

```javascript
/**
 * CANONICAL SELECTOR for official salary matching values from validator output.
 * This is the SINGLE SOURCE OF TRUTH for all UI surfaces displaying salary matching data.
 */
```

---

## 3) Mismatch List

### None Found

All identified calculation paths route through the canonical sources:

1. **`allowedIncomingBelowFirstApron()`** in tradeHelpers.js → Delegates to `getSalaryMatchingResult()` (L107-117)
2. **`calculateAllowableIncoming()`** in tradeHelpers.js → Back-compat wrapper, uses same bands (marked for deprecation)
3. **`getIncomingCeiling()`** in tradeHelpers.js → Delegates core band logic to `allowedIncomingBelowFirstApron()`

### Advisory: Potential Future Risk

`getIncomingCeiling()` adds TPE amounts on top of band calculations. This is correct behavior but represents a secondary aggregation step that could drift if TPE handling changes. Currently not a mismatch.

---

## 4) Drift Protection

### Guardrails Implemented

| Guardrail                       | Location                                                                                                                                       | Description                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `warnOnTotalsDivergence()`      | [computeTeamCapTotals.js](src/features/architect/utils/capTotals/computeTeamCapTotals.js#L328)                                                 | Rate-limited divergence warnings                  |
| TradeTeamCard divergence checks | [TradeTeamCard.jsx](src/features/architect/tradeMachine/TradeTeamCard.jsx#L185-L200)                                                           | Compares local vs validator for outgoing/incoming |
| Test guardrails                 | [phase73_tile_reactivity_and_totals_drift_guardrails.test.js](src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js) | Validates divergence check presence               |

### TradeTeamCard Dual-Path Mitigation

TradeTeamCard.jsx has both local and validator paths:

- **Local path**: Used ONLY before validator runs (with "Estimate" indicator)
- **Validator path**: Used after validation (golden source)
- **Divergence check**: `warnOnTotalsDivergence()` called when validator result available

```javascript
// Phase 1: Get snapshot from validator result (golden source of truth)
// RULE: For legality-affecting numbers, use snapshot values; do NOT recompute locally
const snapshot = getTeamSnapshot(team?.id, validationResult);
const hasValidatorResult = snapshot !== null;
```

---

## 5) Manual Scenario Scripts

### Scenario 1: Over-Cap Band Case

**Setup:**

- Team A: Over cap, below first apron

- Team A total salary: $150M (salaryCap = $141M, firstApron = $178.132M)
- Outgoing: $15M player

**Expected Flow:**

1. `getSalaryMatchingResult()` called with `apronStatus: 'OVER_CAP'`

2. $15M falls in Band 2 ($6.5M < $15M ≤ $19.6M)
3. Formula: 100% + $7.5M = $15M + $7.5M = $22.5M
4. UI shows "Allowable Incoming: $22,500,000"

**Verification:**

- Check `validationResult.teamResults[0].rules.salaryMatching.allowableIncoming === 22_500_000`
- Check UI displays via `getOfficialSalaryMatchingSnapshot(teamResult).allowableIncoming`

---

### Scenario 2: Under-Cap (Cap Room) Case

**Setup:**

- Team B: Under cap
- Team B total salary: $120M (salaryCap = $141M)
- Cap room: $21M
- Outgoing: $10M player

**Expected Flow:**

1. `getSalaryMatchingResult()` detects `salary < salaryCap`
2. Returns `ruleKey: 'UNDER_CAP'`
3. Formula: outgoing + capSpace = $10M + $21M = $31M
4. UI shows "Allowable Incoming: $31,000,000"

**Verification:**

- Check `ruleApplied === 'UNDER_CAP'`
- Check `allowableIncoming === 31_000_000`

---

### Scenario 3: Second Apron (100% Matching) Case

**Setup:**

- Team C: Above second apron

- Team C total salary: $200M (secondApron = $188.931M)
- Outgoing: $25M player

**Expected Flow:**

1. `getSalaryMatchingResult()` detects `salary > secondApron`
2. Returns `ruleKey: 'SECOND_APRON'`
3. Formula: 100% matching = $25M
4. UI shows "Allowable Incoming: $25,000,000"

**Verification:**

- Check `ruleApplied === 'SECOND_APRON'`
- Check `allowableIncoming === outgoing === 25_000_000`
- Check `formulaUsed` contains "100% matching"

---

## 6) Files Referenced

| #   | File                                                                              | Purpose                                              |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | `src/features/architect/utils/tradeHelpers.js`                                    | `getSalaryForYear()`, legacy band helpers            |
| 2   | `src/features/architect/utils/tradeMachine/utils/matchingValues.js`               | `computeMatchingValues()`                            |
| 3   | `src/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js`          | `SALARY_MATCHING_TIERS`, `getSalaryMatchingResult()` |
| 4   | `src/features/architect/utils/tradeMachine/rules/validateSalaryMatching.js`       | Salary matching validator                            |
| 5   | `src/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js`  | Canonical UI selector                                |
| 6   | `src/features/architect/utils/tradeMachine/engine/tradeValidator.js`              | Main validation orchestration                        |
| 7   | `src/features/architect/tradeMachine/TradeTeamCard.jsx`                           | UI component with divergence checks                  |
| 8   | `src/features/architect/tradeMachine/TradeSummaryPanel.jsx`                       | UI component using canonical selector                |
| 9   | `src/features/architect/utils/capTotals/computeTeamCapTotals.js`                  | `warnOnTotalsDivergence()`                           |
| 10  | `src/tests/architect/phase73_tile_reactivity_and_totals_drift_guardrails.test.js` | Drift guardrail tests                                |

---

## 7) Recommendations

1. **LOW**: Consider deprecating `calculateAllowableIncoming()` in tradeHelpers.js with JSDoc `@deprecated` tag directing to `getSalaryMatchingResult()`

2. **LOW**: Consider consolidating `getIncomingCeiling()` TPE handling into a single location for clearer audit trail

3. **INFO**: Document that `warnOnTotalsDivergence()` uses a 1-decimal tolerance for comparisons
