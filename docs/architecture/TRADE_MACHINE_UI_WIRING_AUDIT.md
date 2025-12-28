# Trade Machine UI Wiring Audit

**Date:** 2025-12-28  
**Status:** Source of Truth Map + Wiring Plan  
**Scope:** All numeric values displayed in the Trade Machine UI

---

## Executive Summary

This audit identifies every numeric value shown in the Trade Machine UI, documents its current source, and compares it against the validator's canonical output. The goal is to create a single `tradeSnapshot` object that the UI can consume directly, eliminating local recomputations and ensuring consistency.

---

## 1. UI Component Inventory

### Components Displaying Numeric Values

| Component | File Path | Purpose |
|-----------|-----------|---------|
| **TradeTeamCard** | `src/features/architect/tradeMachine/TradeTeamCard.jsx` | Main team card showing outgoing/incoming/allowable |
| **CapImpactTiles** | `src/features/architect/tradeMachine/CapImpactTiles.jsx` | Cap space, apron space tiles |
| **TradeReceiptPanel** | `src/features/architect/tradeMachine/TradeReceiptPanel.jsx` | Debug panel showing validator internals |
| **TradeSummaryPanel** | `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` | Summary cards per team |
| **TradeSalaryCalculator** | `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx` | Interactive salary matching calculator |
| **TradeValidationPanel** | `src/features/architect/tradeMachine/TradeValidationPanel.jsx` | Rule compliance display |
| **TradeLegalChecker** | `src/features/architect/tradeMachine/TradeLegalChecker.jsx` | Rule status grid |
| **TradeExportCapture** | `src/features/architect/tradeMachine/TradeExportCapture.jsx` | Downloadable trade image |

---

## 2. Audit Map: Every Numeric Value

### 2.1 TradeTeamCard.jsx

| UI Label | Line | Current Source | Computation Method | Validator Field | Status |
|----------|------|----------------|-------------------|-----------------|--------|
| **Team Total Salary** | 83-90 | `team?.teamTotalSalary ?? team?.totalSalary` | Prefers stored value, fallback only if missing | `teamResult.totalSalary` | ✅ CORRECT (fallback is safety net) |
| **Outgoing Salary** | 114-117 | `useMemo → getSalaryForYear(sends, yearKey)` | Local recomputation | `teamResult.salaryOut` | ❌ **SHOULD USE VALIDATOR** |
| **Incoming Salary** | 119-122 | `useMemo → getSalaryForYear(incomingPlayers, yearKey)` | Local recomputation | `teamResult.salaryIn` | ❌ **SHOULD USE VALIDATOR** |
| **Allowable Incoming** | 148-163 | `getSalaryMatchingResult({...})` | Uses unified rules | `teamResult.rules.salaryMatching.allowableIncoming` | ✅ **USES UNIFIED RULES** |
| **Rule Label** | 334-341 | `salaryMatchingResult?.ruleLabel` | From unified rules | `teamResult.rules.salaryMatching.details.ruleApplied` | ✅ CORRECT |
| **Players Count** | 126-128 | `(team?.players?.length || 0) - sends.length + incomingPlayers.length` | Local calculation | N/A (display only) | ℹ️ Pure display |
| **Picks Count** | 132-134 | `(team?.picks?.length || 0) - picks.length + incomingPicks.length` | Local calculation | N/A (display only) | ℹ️ Pure display |
| **TPE Amounts** | 356-357 | `formatMillions(tpe.amount, 1)` | Direct from team data | `team.tradeExceptions[].amount` | ✅ CORRECT |

### 2.2 CapImpactTiles.jsx

| UI Label | Line | Current Source | Computation Method | Validator Field | Status |
|----------|------|----------------|-------------------|-----------------|--------|
| **Total Cap (projectedTotal)** | 71-75 | `salaryTotal + capHoldsTotal` | **Local recomputation** from `playersAfterTrade` | `teamResult.projectedSalary` | ❌ **CRITICAL RECOMPUTATION** |
| **CAP SPACE** | 76-82 | `salaryCap - projectedTotal` | Local calculation | Should derive from validator | ❌ **DUPLICATE CALC** |
| **1ST APRON** | 83-89 | `firstApron - projectedTotal` | Local calculation | Should derive from validator | ❌ **DUPLICATE CALC** |
| **2ND APRON** | 91-97 | `secondApron - projectedTotal` | Local calculation | Should derive from validator | ❌ **DUPLICATE CALC** |
| **Cap Settings** | 17-20 | `getCapSettingsForYear(yearKey)` | Uses centralized provider | Matches validator | ✅ CORRECT |

### 2.3 TradeReceiptPanel.jsx

| UI Label | Line | Current Source | Computation Method | Validator Field | Status |
|----------|------|----------------|-------------------|-----------------|--------|
| **Year/Season** | 99-101 | `receipt.yearKey`, `receipt.seasonKey` | Direct from receipt | ✅ Validator output | ✅ CORRECT |
| **Teams Count** | 101 | `receipt.teams?.length` | Direct from receipt | ✅ Validator output | ✅ CORRECT |
| **Violations Count** | 102 | `receipt.allViolations?.length` | Direct from receipt | ✅ Validator output | ✅ CORRECT |
| **Validation Time** | 104-105 | `receipt.performance?.validationTimeMs` | Direct from receipt | ✅ Validator output | ✅ CORRECT |
| **Cap Settings** | 120-145 | `receipt.capSettingsUsed.*` | Direct from receipt | ✅ Validator output | ✅ CORRECT |
| **Pre-trade Salary** | 191-195 | `team.preTradeTeamSalary` | Direct from receipt | ✅ Validator output | ✅ CORRECT |
| **Outgoing/Incoming Base/Match Totals** | 209-233 | `team.totals.*` | Direct from receipt | ✅ Validator output | ✅ CORRECT |
| **Allowable/Actual/Margin** | 237-265 | `team.salaryMatchingEvaluation.*` | Direct from receipt | ✅ Validator output | ✅ CORRECT |

### 2.4 TradeSummaryPanel.jsx

| UI Label | Line | Current Source | Computation Method | Validator Field | Status |
|----------|------|----------------|-------------------|-----------------|--------|
| **Incoming/Allowed** | 119-128 | `calculations.salaryIn`, `salaryMatching.allowedIncoming` | From `teamResult.calculations` | ✅ Validator output | ✅ CORRECT |
| **Over By** | 121 | `Math.max(0, salaryIn - allowedIncoming)` | Local derivation | Could be `margin` from validator | ⚠️ MINOR |

### 2.5 TradeSalaryCalculator.jsx

| UI Label | Line | Current Source | Computation Method | Validator Field | Status |
|----------|------|----------------|-------------------|-----------------|--------|
| **Outgoing Salary** | 97-99 | Prop `outgoingSalary` | Passed in | Should match validator | ⚠️ DEPENDS ON CALLER |
| **Allowable Incoming** | 73 | `breakdown.base + breakdown.min + breakdown.tpe` | Uses `getSalaryMatchingResult` | `teamResult.rules.salaryMatching.allowableIncoming` | ✅ USES UNIFIED RULES |
| **Rule/Formula** | 117-125 | `breakdown.rule`, `breakdown.formula` | From `getSalaryMatchingResult` | Matches validator | ✅ CORRECT |

### 2.6 TradeExportCapture.jsx

| UI Label | Line | Current Source | Computation Method | Validator Field | Status |
|----------|------|----------------|-------------------|-----------------|--------|
| **Player Salary** | 136 | `getSalaryForYear([p], yearKey)` | **Local recomputation** | Should use validator-computed values | ❌ **RECOMPUTATION** |
| **Cap Impact (capDelta)** | 94-95 | `summary?.capDelta` | From `result.summaryByTeamIndex` | ✅ Validator output | ✅ CORRECT |

### 2.7 useTradeMachine.js (Hook)

| Value | Line | Current Source | Computation Method | Validator Field | Status |
|-------|------|----------------|-------------------|-----------------|--------|
| **salaryOut** | 198-200 | `useMemo → getSalaryForYear(t.sends, yearKey)` | Local recomputation | `teamResult.salaryOut` | ❌ **RECOMPUTATION** |
| **teamTotalSalary** | 225-228 | `payrollForYearFromCapSheet(teamObj, yearKey)` | Complex local calculation | Should be single source | ⚠️ **COMPLEX** |

---

## 3. Violations Summary

### 3.1 Critical Violations (Direct Trade Legality Impact)

| # | Component | Issue | Impact |
|---|-----------|-------|--------|
| **V1** | CapImpactTiles | `projectedTotal` computed locally from filtered players | Could diverge from validator's `projectedSalary` |
| **V2** | TradeTeamCard | `outgoingSalary` uses `getSalaryForYear(sends)` | Doesn't include BYC/trade kicker adjustments |
| **V3** | TradeTeamCard | `incomingSalary` uses `getSalaryForYear(incomingPlayers)` | Doesn't include poison pill/trade kicker adjustments |
| **V4** | useTradeMachine | `salaryOut` computed via `getSalaryForYear` | Same issue as V2 - misses matching value adjustments |

### 3.2 Moderate Violations (Apron/Cap Deltas)

| # | Component | Issue | Impact |
|---|-----------|-------|--------|
| **V5** | CapImpactTiles | Cap space/apron space calculated locally | Could show different numbers than validation |
| **V6** | TradeExportCapture | Player salary uses `getSalaryForYear` | Doesn't reflect matching values |

### 3.3 Formatting/Rounding Inconsistencies

| # | Location | Issue |
|---|----------|-------|
| **V7** | Various | `formatSalary` vs `formatCurrency` vs `formatMillions` used inconsistently |
| **V8** | useTradeMachine | `toSeasonKey` defined locally vs imported from `seasonUtils` |

### 3.4 Year/Season Key Inconsistencies

| # | Location | Issue |
|---|----------|-------|
| **V9** | TradeTeamCard L169 | Creates `seasonKey` from `yearKey` locally |
| **V10** | useTradeMachine L22 | Defines own `toSeasonKey` helper |
| **V11** | CapImpactTiles L40 | Uses `yearKey` as end year (correct) but needs cap holds by end year |

---

## 4. Recomputation Hotspots

| File | Function/Block | Lines | What It Recomputes |
|------|----------------|-------|-------------------|
| `TradeTeamCard.jsx` | `useMemo(() => getSalaryForYear(sends, yearKey))` | 114-117 | Outgoing salary |
| `TradeTeamCard.jsx` | `useMemo(() => getSalaryForYear(incomingPlayers, yearKey))` | 119-122 | Incoming salary |
| `TradeTeamCard.jsx` | `useMemo(() => getSalaryMatchingResult({...}))` | 148-163 | Allowable incoming |
| `CapImpactTiles.jsx` | `playersAfterTrade.reduce(...)` | 33-36 | Salary total after trade |
| `CapImpactTiles.jsx` | `salaryCap - projectedTotal` | 64 | Cap space |
| `useTradeMachine.js` | `useMemo(() => getSalaryForYear(t.sends, yearKey))` | 198-200 | Salary out per team |
| `useTradeMachine.js` | `payrollForYearFromCapSheet(teamObj, yearKey)` | 225-228 | Team baseline payroll |
| `TradeExportCapture.jsx` | `getSalaryForYear([p], yearKey)` | 136 | Individual player salary |

---

## 5. Fix Order (Prioritized by Impact)

### Priority 1: Trade Legality/Matching Numbers (CRITICAL)

| Order | Task | Files | Reason |
|-------|------|-------|--------|
| **1.1** | Wire `outgoingSalary` from validator | `TradeTeamCard.jsx` | Direct impact on allowable incoming display |
| **1.2** | Wire `incomingSalary` from validator | `TradeTeamCard.jsx` | Must include matching values (BYC, poison pill, kickers) |
| **1.3** | Wire `allowableIncoming` from validator result | `TradeTeamCard.jsx` | Currently uses unified rules (good) but validator has final say |
| **1.4** | Remove `salaryOut` recomputation in hook | `useTradeMachine.js` | Hook should expose validator values, not recompute |

### Priority 2: Cap/Apron Deltas

| Order | Task | Files | Reason |
|-------|------|-------|--------|
| **2.1** | Wire `projectedSalary` from validator | `CapImpactTiles.jsx` | Critical for accurate cap space display |
| **2.2** | Derive cap/apron space from validator | `CapImpactTiles.jsx` | Ensures consistency |
| **2.3** | Wire cap delta from validator | `TradeExportCapture.jsx` | Already using `summaryByTeamIndex` (good) |

### Priority 3: Display-Only Stats

| Order | Task | Files | Reason |
|-------|------|-------|--------|
| **3.1** | Wire player matching values for display | `TradeExportCapture.jsx` | Show true matching values in export |
| **3.2** | Standardize formatting functions | Various | Consistency |
| **3.3** | Consolidate `toSeasonKey` usages | Various | Single source of truth |

---

## 6. Implementation Plan

### Step 1: Define `tradeSnapshot` Object Shape

The validator already produces `tradeReceipt` (see `generateTradeReceipt()` in `tradeValidator.js`). Extend `result` to include a flat `snapshot` object for UI consumption:

```typescript
interface TradeSnapshot {
  // Schema version for backward compatibility
  schemaVersion: string; // e.g., "1.0.0"
  
  // Global
  isLegal: boolean;
  primaryViolation: string | null;
  yearKey: number;
  seasonKey: string;
  capSettings: {
    salaryCap: number;
    firstApron: number;
    secondApron: number;
    luxuryTax: number;
  };
  
  // Per team (indexed by team ID or position)
  teamSnapshots: {
    [teamId: string]: {
      // Pre-trade
      preTradeTeamSalary: number;
      
      // Outgoing (with matching values applied)
      outgoingBaseSalary: number;      // Sum of base salaries
      outgoingMatchingSalary: number;  // Sum with BYC adjustments
      
      // Incoming (with matching values applied)
      incomingBaseSalary: number;      // Sum of base salaries
      incomingMatchingSalary: number;  // Sum with poison pill/kicker adjustments
      
      // Post-trade
      projectedSalary: number;
      
      // Cap calculations
      capSpace: number;
      firstApronSpace: number;
      secondApronSpace: number;
      
      // Salary matching
      allowableIncoming: number;
      salaryMatchingRule: string;
      salaryMatchingFormula: string;
      margin: number;
      
      // Status flags
      isOverCap: boolean;
      isAboveFirstApron: boolean;
      isAboveSecondApron: boolean;
      isHardCapped: boolean;
      
      // Violations/warnings for this team
      violations: string[];
      warnings: string[];
    };
  };
}
```

### Step 2: Add Snapshot Generation to Validator

In `tradeValidator.js`, after the `result` object construction (around lines 543-551), add snapshot generation:

```javascript
// Generate flat snapshot for UI consumption
const snapshot = generateTradeSnapshot({
  teamsWithAssets,
  teamResults,
  context,
  isOverallLegal,
});

// Add snapshot to result object
result.snapshot = snapshot;
```

### Step 3: Update useTradeMachine Hook

Expose snapshot from validation result:

```javascript
// In useTradeMachine.js
return {
  teams,
  result,
  snapshot: result?.snapshot ?? null, // NEW
  // ... existing exports
};
```

### Step 4: Update TradeTeamCard to Use Snapshot

Replace local calculations with snapshot values:

```javascript
// In TradeTeamCard.jsx
const teamSnapshot = snapshot?.teamSnapshots?.[team?.id];

// Replace useMemo for outgoingSalary
const outgoingSalary = teamSnapshot?.outgoingMatchingSalary ?? 0;

// Replace useMemo for incomingSalary
const incomingSalary = teamSnapshot?.incomingMatchingSalary ?? 0;

// Replace getSalaryMatchingResult call
const allowableIncomingNoTPE = teamSnapshot?.allowableIncoming ?? 0;
```

### Step 5: Update CapImpactTiles to Use Snapshot

```javascript
// In CapImpactTiles.jsx
const teamSnapshot = snapshot?.teamSnapshots?.[team?.id];

const projectedTotal = teamSnapshot?.projectedSalary ?? 0;
const capSpace = teamSnapshot?.capSpace ?? 0;
const firstApronSpace = teamSnapshot?.firstApronSpace ?? 0;
const secondApronSpace = teamSnapshot?.secondApronSpace ?? 0;
```

### Step 6: Add Dev-Only Divergence Warnings

In TradeTeamCard.jsx (existing pattern at lines 94-111), enhance to warn when UI would have calculated differently:

```javascript
// DEV-ONLY: Warn if local calculation differs from snapshot
if (import.meta.env.DEV && teamSnapshot) {
  const localOutgoing = getSalaryForYear(sends, yearKey);
  const snapshotOutgoing = teamSnapshot.outgoingMatchingSalary;
  if (Math.abs(localOutgoing - snapshotOutgoing) > 1) {
    console.warn('[TradeTeamCard] Outgoing salary DIVERGENCE', {
      local: localOutgoing,
      snapshot: snapshotOutgoing,
      diff: localOutgoing - snapshotOutgoing,
      reason: 'Snapshot includes BYC/trade kicker adjustments',
    });
  }
}
```

### Step 7: Update TradeExportCapture

Wire player salaries to use matching values from snapshot:

```javascript
// In TradeExportCapture.jsx line 136
// Replace: const salary = getSalaryForYear([p], yearKey);
// With: const salary = p.matchIncoming ?? p.matchOutgoing ?? getSalaryForYear([p], yearKey);
```

### Step 8: Consolidate Season Key Functions

Remove `toSeasonKey` from useTradeMachine.js and use the centralized version:

```javascript
// In useTradeMachine.js
import { toSeasonKey } from '@/features/architect/utils/seasonUtils';
// Remove local toSeasonKey definition at line 22
```

### Step 9: Standardize Formatting

Create consistent formatting usage:

| Format Type | Function | Import From |
|-------------|----------|-------------|
| Full currency | `formatCurrency($12,345,678)` | `tradeHelpers.js` |
| Millions | `formatMillions($12.3M)` | `shared/utils/formatting` |
| Salary display | `formatSalary($12.3M)` | `shared/utils/formatting` |

### Step 10: Add Integration Test

```javascript
// In tests/tradeSnapshotWiring.test.js
describe('Trade Snapshot Wiring', () => {
  it('snapshot values match validator internal calculations', () => {
    const result = validateTrade({
      teams: twoTeamTradeFixture,
      capProjections,
      currentYear: 2025,
    });
    
    const snapshot = result.snapshot;
    const teamResult = result.teamResults[0];
    
    // Verify snapshot matches internal calculations
    expect(snapshot.teamSnapshots[teamResult.teamId].outgoingMatchingSalary)
      .toBe(teamResult.salaryOut);
    expect(snapshot.teamSnapshots[teamResult.teamId].incomingMatchingSalary)
      .toBe(teamResult.salaryIn);
    expect(snapshot.teamSnapshots[teamResult.teamId].allowableIncoming)
      .toBe(teamResult.rules.salaryMatching.allowableIncoming);
  });
});
```

---

## 7. Summary

### Current State
- **TradeReceiptPanel**: ✅ Already wired to validator output (debug panel)
- **TradeSummaryPanel**: ✅ Uses `result.teamResults.calculations`
- **TradeTeamCard**: ❌ Recomputes outgoing/incoming locally
- **CapImpactTiles**: ❌ Recomputes projected salary locally
- **useTradeMachine**: ❌ Recomputes salaryOut in useMemo

### Target State
All numeric values should flow from a single `tradeSnapshot` object attached to the validation result. UI components should only format and display, never recompute.

### Risk Mitigation
- Keep existing calculations as DEV-only divergence warnings
- Gradual rollout: wire one component at a time
- Add integration tests to catch regressions

---

## Appendix A: File References

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `tradeValidator.js` | Main validation + receipt generation | 68-219, 450-551 |
| `validateSalaryMatching.js` | Salary matching rules | 45-298 |
| `salaryMatchingRules.js` | Unified matching calculations | 169-272 |
| `useTradeMachine.js` | React hook for trade state | 176-200, 411-484 |
| `TradeTeamCard.jsx` | Main team card UI | 83-163 |
| `CapImpactTiles.jsx` | Cap/apron tiles | 33-67 |
| `TradeReceiptPanel.jsx` | Debug panel (correctly wired) | 98-265 |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **BYC** | Base Year Compensation - affects outgoing matching value |
| **Poison Pill** | Contract with escalating years - affects incoming matching value |
| **Trade Kicker** | Bonus triggered on trade - affects incoming matching value |
| **Matching Value** | Adjusted salary used for trade matching calculations |
| **Base Salary** | Raw salary before adjustments |
| **Projected Salary** | Team salary after trade (pre-trade - outgoing + incoming) |
