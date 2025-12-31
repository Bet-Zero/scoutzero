# Trade Machine Audit Report

> **Version**: 2.0.0 (December 2024)  
> **Purpose**: End-to-end audit to identify UI vs logic mismatches, duplicated calculations, inconsistent values, and missing wiring in the Trade Machine feature  
> **Audience**: Non-technical readers and development team  
> **Companion Document**: `TRADE_MACHINE_FIX_PLAN.md`

---

## Executive Summary

The Trade Machine has undergone significant improvements with centralized salary matching rules (`salaryMatchingRules.js`) and a snapshot accessor pattern (`useTradeMachineSnapshot.js`). However, several inconsistencies remain between **what the UI displays** and **what the validator calculates**. This audit identifies those gaps with specific file/line references.

### Overall Assessment

| Area | Status | Risk |
|------|--------|------|
| Core Architecture | ✅ Well-structured | Low |
| Single Source of Truth (Salary Matching) | ✅ Implemented | Low |
| UI-Validator Alignment | ⚠️ Mostly aligned, minor gaps | **Medium** |
| Snapshot Wiring | ✅ Implemented with fallback indicators | Low |
| Component Consistency | ⚠️ Some components bypass canonical sources | **Medium** |
| Trade Receipt Debugging | ✅ Implemented | Low |

---

## 1. Mismatch Map

This table shows **each key displayed value**, where it appears in the UI, and whether it consistently uses the same source across all locations.

### 1.1 Salary Values

| Value | Location(s) | Source | Consistent? | Notes |
|-------|-------------|--------|-------------|-------|
| **Outgoing Salary** | TradeTeamCard (line 135-140), TradeSummaryPanel, TradeExportCapture | Validator snapshot (`snapshot.outgoingMatchingSalary`) or local fallback (`getSalaryForYear`) | ⚠️ **Mostly** | TradeTeamCard shows "Estimate" badge when using local fallback. TradeExportCapture (line 139) uses `getSalaryForYear()` directly for base salary display. |
| **Incoming Salary** | TradeTeamCard (line 139-140), TradeSummaryPanel (line 121) | Validator snapshot (`snapshot.incomingMatchingSalary`) or local fallback | ⚠️ **Mostly** | Same pattern as outgoing - local fallback with indicator |
| **Allowable Incoming** | TradeTeamCard (line 227-229), TradeSummaryPanel (line 131), TradeSalaryCalculator (line 73) | TradeSalaryCalculator uses local `getSalaryMatchingResult()`. TradeTeamCard uses snapshot when available. | ⚠️ **MISMATCH RISK** | TradeSalaryCalculator is an "exploratory tool" and re-derives values locally. TradeTeamCard correctly uses snapshot. |
| **Team Total Salary** | TradeTeamCard (line 88-95), CapImpactTiles (line 38) | Stored on `team.teamTotalSalary` from hook | ✅ **Yes** | DEV warnings flag divergence |
| **Base Salary (per player)** | TradeExportCapture (line 139), TradeSummaryPanel (line 167-168) | Different lookups: `p.baseSalary ?? getSalaryForYear([p], yearKey)` | ⚠️ **Mostly** | Player objects may have `baseSalary` populated differently depending on path |

### 1.2 Cap/Apron Values

| Value | Location(s) | Source | Consistent? | Notes |
|-------|-------------|--------|-------------|-------|
| **Salary Cap** | CapImpactTiles (from computeTeamCapTotals), TradeReceipt, Validator | `getCapSettingsForYear()` | ✅ **Yes** | All routes use centralized provider |
| **First Apron** | Multiple locations | `getCapSettingsForYear()` | ✅ **Yes** | Centralized |
| **Second Apron** | Multiple locations | `getCapSettingsForYear()` | ✅ **Yes** | Centralized |
| **Projected Salary (Post-Trade)** | CapImpactTiles (line 38-39), TradeReceipt | CapImpactTiles uses validator snapshot when available | ✅ **Yes** | Falls back to baseline with indicator |
| **Cap Space / Apron Space** | CapImpactTiles (lines 43-47) | Derived from projectedSalary - cap thresholds | ✅ **Yes** | Uses canonical totals |

### 1.3 Rule/Status Values

| Value | Location(s) | Source | Consistent? | Notes |
|-------|-------------|--------|-------------|-------|
| **Salary Matching Rule Label** | TradeTeamCard (line 240-245), TradeSalaryCalculator (line 68) | TradeSalaryCalculator: local calculation. TradeTeamCard: snapshot | ⚠️ **MISMATCH** | Both call `getSalaryMatchingResult()` but with potentially different inputs |
| **Matching Passed/Failed** | TradeValidationPanel, TradeLegalChecker | From `teamResult.rules.salaryMatching.passed` | ✅ **Yes** | Consistent from validator |
| **Trade Legality** | TradeSummaryPanel (line 33-37), TradePreviewModal | From `result.legal` | ✅ **Yes** | Single source |
| **Violations List** | TradeValidationPanel (line 135), TradeSummaryPanel (line 53-62) | From `result.failures` or `teamResult.violations` | ✅ **Yes** | Both read from validator output |

### 1.4 Exception Values

| Value | Location(s) | Source | Consistent? | Notes |
|-------|-------------|--------|-------------|-------|
| **TPE Amount** | TradeTeamCard (line 563-596), TradeExceptionDashboard | `team.tradeExceptions` array | ✅ **Yes** | From team data |
| **Created TPE** | TradeExceptionDashboard (line 38-49), TradeReceipt | `teamResult.createdTPE` | ✅ **Yes** | From validator |
| **FA Exception Buckets** | TradeTeamCard (line 204-207), FaExceptionTracker | `getTeamFaExceptionBuckets()` | ✅ **Yes** | Shared utility |

---

## 2. Issue List

### ISSUE-001: TradeSalaryCalculator Shows Different Values Than Validator

**What the user sees**: The "Salary Matching Calculator" panel shows an "Allowable Incoming" value that may differ from what the trade validation actually uses.

**Expected behavior**: The calculator should show the exact same number the validator will use to determine trade legality.

**Actual behavior**: The calculator calls `getSalaryMatchingResult()` directly with its own props, which may differ from the validator's computed values (e.g., different `teamSalary` due to when dead money is included).

**File/Component**: `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx` (lines 27-39)

**Root cause**: The component receives `teamSalary` and `outgoingSalary` as props and re-derives the matching result locally. These props may not reflect the exact values the validator uses after all its preprocessing (e.g., `computeMatchingValues()` adjustments for BYC, poison pill).

**Severity**: **Medium** - Component is labeled "Exploratory tool — validator is authoritative" (line 196-198), but users may still be confused if numbers differ.

**Repro steps**:
1. Build a trade with a BYC player
2. Compare "Allowable Incoming" in TradeSalaryCalculator vs the value in TradeReceiptPanel
3. The BYC adjustment affects the validator's outgoing calculation but TradeSalaryCalculator uses raw outgoing

---

### ISSUE-002: Base vs Matching Salary Display Inconsistency

**What the user sees**: Some places show "Base Salary" (actual contract amount), others show "Matching Value" (with BYC/kicker/poison pill adjustments), and it's not always clear which is which.

**Expected behavior**: Every salary display should clearly indicate whether it's the base salary or the matching value.

**Actual behavior**: 
- TradeExportCapture (line 139-140) uses `baseSalary ?? getSalaryForYear()` and labels it just as the salary
- TradeSummaryPanel (line 167-168) shows `baseSalary` with separate check for adjustment
- TradeTeamCard has the adjustment indicators (lines 152-155) but only when there's a difference

**File/Component**: 
- `TradeExportCapture.jsx` (line 139)
- `TradeSummaryPanel.jsx` (lines 167-194)
- `TradeTeamCard.jsx` (lines 352-386, 446-480)

**Root cause**: Different developers implemented these displays at different times. The matching value annotations (purple "Adj" badges) were added in Phase 2.4 but not consistently applied everywhere.

**Severity**: **Low** - The export capture intentionally shows base salary (roster reality), and the main UI has indicators. But documentation could be clearer.

---

### ISSUE-003: Snapshot Fallback Creates Estimation Window

**What the user sees**: When no validation has run yet, TradeTeamCard shows "Estimate" badges next to salary values.

**Expected behavior**: Estimates should be clearly marked and updated immediately when validation runs.

**Actual behavior**: The component shows estimates, but validation only runs when the trade state changes (via `useEffect` in `useTradeMachine.js` line 486-488). There may be a brief delay.

**File/Component**: 
- `TradeTeamCard.jsx` (lines 135-142, 357-364)
- `useTradeMachine.js` (lines 486-488)

**Root cause**: Auto-validation runs on state change, which is correct. The "Estimate" indicator is the intended behavior during this window.

**Severity**: **Low** - This is working as designed. The estimate indicator provides transparency.

---

### ISSUE-004: Salary Matching Skip Reason Not Visible in Main UI

**What the user sees**: When salary matching is not applicable (e.g., hard-capped team, TPE absorption), the "Allowable Incoming" shows "—" but no explanation why.

**Expected behavior**: Users should understand why salary matching doesn't apply to certain scenarios.

**Actual behavior**: The skip reason is captured in `snapshot.salaryMatchingSkipReason` but TradeTeamCard intentionally doesn't display it (see comment at lines 545-547).

**File/Component**: `TradeTeamCard.jsx` (lines 545-547)

**Root cause**: Intentional design decision per Phase 1 requirements to keep UI clean. The "—" dash is deemed sufficient.

**Severity**: **Low** - Design choice. Could be improved with tooltip or expandable detail.

---

### ISSUE-005: TradeExportCapture Uses Independent Salary Calculation

**What the user sees**: The downloadable trade summary image shows player salaries.

**Expected behavior**: Should show the same values as the main UI.

**Actual behavior**: Uses `getSalaryForYear([p], yearKey)` directly (line 139) rather than snapshot values. This is intentional (base salary for "roster reality") but could confuse users expecting matching values.

**File/Component**: `TradeExportCapture.jsx` (lines 139-140)

**Root cause**: Phase 2.2 design decision - exports show base salary only. Comment at line 137-138 explains this.

**Severity**: **Low** - Documented intentional behavior.

---

### ISSUE-006: Multiple computeMatchingValues Import Paths

**What the user sees**: N/A (internal code issue)

**Expected behavior**: Single import path for matching value computation.

**Actual behavior**: 
- `salaryUtils.js` re-exports from `matchingValues.js`
- `computeMatchingValues.js` re-exports from `matchingValues.js`
- Some files import from `salaryUtils.js`, others from `computeMatchingValues.js`

**File/Component**: 
- `src/features/architect/utils/tradeMachine/utils/salaryUtils.js` (line 1, 10)
- `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js` (line 23)
- `src/features/architect/utils/tradeMachine/engine/tradeValidator.js` (line 21)

**Root cause**: Historical refactoring left multiple wrapper files. The canonical source is `matchingValues.js`.

**Severity**: **Low** - No functional impact since all re-export from same canonical source, but adds maintenance complexity.

---

### ISSUE-007: CapImpactTiles Baseline May Differ from Cap Sheet

**What the user sees**: The "TOTAL CAP" tile in the trade machine may show a different number than the Cap Sheet view for the same team.

**Expected behavior**: Same team should show same baseline total everywhere.

**Actual behavior**: 
- CapImpactTiles now uses `computeTeamCapTotals()` (line 19) ✅
- But for POST-TRADE values, it uses validator's `projectedSalary` which is defined differently (see DG-1/DG-2 in tradeValidator.js header)
- Definition: `projectedSalary = teamTotalSalary - salaryOut + salaryIn` (players + dead money, NO cap holds)

**File/Component**: 
- `CapImpactTiles.jsx` (lines 19, 30-40)
- `tradeValidator.js` (lines 35-67, definition gate documentation)

**Root cause**: Documented intentional difference. For trade matching, cap holds are excluded. For cap sheet display, cap holds are included. The validator's definition is correct for trade purposes.

**Severity**: **Low** - Documented and intentional. CapImpactTiles shows cap holds separately (line 137-140).

---

### ISSUE-008: Console.log Statement in Production Code

**What the user sees**: N/A (dev tools only)

**Expected behavior**: Production code should not have console.log statements.

**Actual behavior**: `TradeSummaryPanel.jsx` line 73 has `console.log('TEAMRESULT', teamResult);`

**File/Component**: `TradeSummaryPanel.jsx` (line 73)

**Root cause**: Debug statement left in code.

**Severity**: **Low** - Should be removed but no functional impact.

---

## 3. Root Cause Analysis

### Why UI vs Validator Mismatches Exist

1. **Historical Development**: Trade Machine was built incrementally. UI components were added before the centralized snapshot pattern was established.

2. **Intentional Separation**: Some displays intentionally show different values:
   - TradeExportCapture shows base salary (roster reality)
   - Validator uses matching values (trade legality)
   - These are correctly different

3. **Prop-Based vs Snapshot-Based**: Older components receive values as props and may compute locally. Newer patterns use the snapshot accessor.

4. **Definition Differences**: "Team total salary" means different things in different contexts:
   - Cap Sheet: players + dead money + cap holds
   - Trade Matching: players + dead money (no cap holds)
   - Both are correct for their purposes

### What's Working Well

1. **Centralized Salary Matching Rules**: `salaryMatchingRules.js` is the single source of truth for tier calculations. Both validator and UI components that use it correctly will get consistent results.

2. **Snapshot Accessor Pattern**: `useTradeMachineSnapshot.js` provides a clean interface to validator results. Components using it get consistent data.

3. **Trade Receipt**: The `TradeReceiptPanel.jsx` shows exact values used by validator, making debugging straightforward.

4. **Cap Settings Provider**: `capSettingsProvider.js` ensures consistent cap thresholds everywhere.

5. **DEV Divergence Warnings**: Multiple components log warnings when local calculations differ from snapshot values.

---

## 4. Summary Table: All Issues

| ID | Issue | Severity | Status | Recommendation |
|----|-------|----------|--------|----------------|
| ISSUE-001 | TradeSalaryCalculator shows different values | Medium | Known behavior | Wire to snapshot values or add stronger disclaimer |
| ISSUE-002 | Base vs Matching salary unclear | Low | Partially addressed | Consistent labeling across all components |
| ISSUE-003 | Estimate window during validation | Low | Working as designed | Document behavior |
| ISSUE-004 | Skip reason not visible | Low | Intentional | Consider tooltip |
| ISSUE-005 | Export uses base salary | Low | Intentional | Document clearly |
| ISSUE-006 | Multiple import paths | Low | Technical debt | Consolidate re-exports |
| ISSUE-007 | Cap vs trade salary definitions | Low | Intentional | Already documented |
| ISSUE-008 | Console.log in production | Low | Bug | Remove |

---

## 5. Verification Checklist

Use this checklist after implementing fixes to verify alignment:

### Salary Matching Values
- [ ] TradeTeamCard "Allowable Incoming" matches validator's `teamResult.rules.salaryMatching.allowableIncoming`
- [ ] TradeSalaryCalculator (when showing validated trade) matches validator output
- [ ] TradeReceiptPanel shows same values as TradeTeamCard

### Trade Legality
- [ ] TradeSummaryPanel status matches `result.legal`
- [ ] All violations in TradeValidationPanel match `teamResult.violations`
- [ ] TradeLegalChecker rules match `teamResult.rules.*`

### Cap/Apron Values
- [ ] CapImpactTiles cap thresholds match `capSettings` from validator
- [ ] All components using cap settings get them from `getCapSettingsForYear()`

### Matching Value Consistency
- [ ] BYC players show adjusted outgoing values with "Adj" badge
- [ ] Trade kicker players show adjusted incoming values with "Adj" badge
- [ ] Poison pill players show adjusted incoming values with "Adj" badge

### No Regressions
- [ ] All existing tests pass (`npm run test`)
- [ ] Trade receipt shows correct values for known test scenarios
- [ ] DEV divergence warnings do not fire for normal operations

---

## Appendix A: File Reference

### Core Validation
| File | Purpose |
|------|---------|
| `engine/tradeValidator.js` | Main `validateTrade()` entry point |
| `rules/validateSalaryMatching.js` | Salary matching rule implementation |
| `utils/salaryMatchingRules.js` | Single source of truth for matching calculations |
| `utils/capSettingsProvider.js` | Centralized cap thresholds |
| `utils/matchingValues.js` | BYC, trade kicker, poison pill calculations |

### UI Components
| File | Purpose |
|------|---------|
| `TradeTeamCard.jsx` | Per-team card with salary display |
| `TradeSummaryPanel.jsx` | Trade summary with failures list |
| `TradeSalaryCalculator.jsx` | Interactive calculator (exploratory) |
| `TradeValidationPanel.jsx` | Detailed validation results |
| `CapImpactTiles.jsx` | Cap space impact tiles |
| `TradeReceiptPanel.jsx` | Debug panel with exact values |

### Hooks & Accessors
| File | Purpose |
|------|---------|
| `useTradeMachine.js` | Main trade machine state hook |
| `useTradeMachineSnapshot.js` | Snapshot accessor for validator results |

---

## Appendix B: Rerunning This Audit

To re-run this audit after fixes:

1. **Search for divergence patterns**:
   ```bash
   grep -r "getSalaryMatchingResult\|getAllowableIncoming\|calculateAllowableIncoming" src/features/architect --include="*.jsx" --include="*.js"
   ```

2. **Check for local salary calculations in UI**:
   ```bash
   grep -r "getSalaryForYear" src/features/architect/tradeMachine --include="*.jsx"
   ```

3. **Verify snapshot usage**:
   ```bash
   grep -r "getTeamSnapshot\|snapshot\." src/features/architect/tradeMachine --include="*.jsx"
   ```

4. **Run trade tests**:
   ```bash
   npm run test -- tests/trade/ --run
   npm run test -- tests/salaryMatchingRules.test.js --run
   npm run test -- tests/tradeSalaryMatching.test.js --run
   ```

5. **Check for console.log statements**:
   ```bash
   grep -rn "console.log" src/features/architect/tradeMachine --include="*.jsx"
   ```

---

*End of Audit Report*
