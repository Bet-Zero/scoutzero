# Trade Machine Fix Plan

> **Version**: 2.0.0 (December 2024)  
> **Purpose**: Prioritized, step-by-step plan to align Trade Machine UI with validation logic  
> **Companion Document**: `TRADE_MACHINE_AUDIT.md`  
> **Target Audience**: Non-technical readers and development team

---

## Executive Summary

Based on the audit findings, the Trade Machine is **largely aligned** thanks to recent improvements (Phase 1-4 work). The remaining issues are **low to medium severity** and mostly involve:

1. One exploratory component (TradeSalaryCalculator) that re-derives values locally
2. A debug console.log left in production code
3. Minor labeling improvements for user clarity

This plan prioritizes **surgical fixes** that maintain single source of truth rather than large refactors.

---

## Fix Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| 🔴 P0 | Blocker - user sees wrong numbers | Immediate |
| 🟠 P1 | High - confusion or potential for bugs | This sprint |
| 🟡 P2 | Medium - technical debt / minor UX | Next sprint |
| 🟢 P3 | Low - polish / nice-to-have | Backlog |

---

## Fix 1: Remove Console.log from TradeSummaryPanel

**Priority**: 🟢 P3 (Low)

**Issue Reference**: ISSUE-008

**What becomes the single source of truth**: N/A - this is a cleanup

**Plain English**: A debug statement was left in the code that outputs to browser console. It should be removed.

### Files to Touch
| File | Change |
|------|--------|
| `src/features/architect/tradeMachine/TradeSummaryPanel.jsx` | Remove line 73 |

### Exact Change

**Line 73 - DELETE:**
```javascript
console.log('TEAMRESULT', teamResult);
```

### How to Validate
1. Run `grep -rn "console.log" src/features/architect/tradeMachine --include="*.jsx"` 
2. Should return no results (or only intentionally gated debug logs)

### Risks / Regressions
- None. This is a simple removal.

---

## Fix 2: Wire TradeSalaryCalculator to Validator Snapshot (Optional)

**Priority**: 🟡 P2 (Medium) - Currently documented as "exploratory tool"

**Issue Reference**: ISSUE-001

**What becomes the single source of truth**: Validator's `teamResult.rules.salaryMatching` values, accessed via snapshot

**Plain English**: The salary matching calculator currently computes values independently from the validator. While this is documented behavior (labeled "exploratory tool"), users may still be confused when numbers differ from actual validation results. 

**Decision Point**: This fix is **optional** because the component is already labeled appropriately. Options:

| Option | Description | Effort |
|--------|-------------|--------|
| A | Keep as-is with current disclaimer | None |
| B | Add snapshot comparison showing "validator will use: $X" | Low |
| C | Replace local calculation with snapshot values entirely | Medium |

### Recommended: Option B (Low Effort Enhancement)

Add a line showing what the validator actually calculated, so users can see both:
- Their interactive exploration
- What the validator will actually use

### Files to Touch (Option B)
| File | Change |
|------|--------|
| `src/features/architect/tradeMachine/TradeSalaryCalculator.jsx` | Add validator comparison |

### Exact Change (Option B)

After line 39, add a new prop to receive validator result:

```javascript
// Add new prop
const TradeSalaryCalculator = ({
  teamSalary,
  outgoingSalary,
  incomingPlayers = [],
  tpes = [],
  capSettings,
  yearKey,
  validatorAllowable = null,  // NEW: From validator snapshot
}) => {
```

After line 113 (after the allowable display), add comparison:

```javascript
{/* Validator Comparison */}
{validatorAllowable != null && Math.abs(validatorAllowable - allowableIncoming) > 1 && (
  <div className="text-xs text-amber-400 mt-1">
    ⚠️ Validator uses: {formatCurrency(validatorAllowable)} (may differ due to BYC/kicker adjustments)
  </div>
)}
```

### How to Validate (Option B)
1. Build a trade with a BYC player
2. Verify calculator shows both local value AND validator value when they differ
3. Verify normal trades without adjustments show no warning

### Risks / Regressions
- Low. This adds information without changing existing behavior.

---

## Fix 3: Consolidate Import Paths for matchingValues

**Priority**: 🟢 P3 (Low - Technical Debt)

**Issue Reference**: ISSUE-006

**What becomes the single source of truth**: `utils/matchingValues.js` (already is, but imports should be cleaner)

**Plain English**: Multiple files re-export the same functions. This creates confusion about where the "real" code lives. We should update imports to use the canonical source directly.

### Files to Touch
| File | Change |
|------|--------|
| `src/features/architect/utils/tradeMachine/utils/salaryUtils.js` | Add deprecation notice |
| `src/features/architect/utils/tradeMachine/utils/computeMatchingValues.js` | Already deprecated |

### Exact Change

**salaryUtils.js** - Add deprecation JSDoc (lines 1-10):

```javascript
/**
 * FILE: salaryUtils.js
 * PURPOSE: Re-exports from canonical sources. Consider importing directly.
 * 
 * @deprecated For computeMatchingValues, import from './matchingValues.js' directly.
 *             For getSalaryMatchingResult, import from './salaryMatchingRules.js' directly.
 *             This file is maintained for backwards compatibility.
 */
```

### How to Validate
1. Codebase continues to build without errors
2. All trade tests pass

### Risks / Regressions
- Very low. Adding documentation only, no behavior change.

---

## Fix 4: Add Tooltip for Salary Matching Skip Reason

**Priority**: 🟢 P3 (Low - UX Enhancement)

**Issue Reference**: ISSUE-004

**What becomes the single source of truth**: Validator's `teamResult.rules.salaryMatching.skipReason`

**Plain English**: When salary matching shows "—" (not applicable), users don't know why. Adding a tooltip explains the reason.

### Files to Touch
| File | Change |
|------|--------|
| `src/features/architect/tradeMachine/TradeTeamCard.jsx` | Add tooltip to allowable display |

### Exact Change

Around line 532-533, modify the allowable display:

**Before:**
```jsx
<span className="font-semibold text-white/80">
  {allowableIncomingNoTPE != null
    ? formatSalary(allowableIncomingNoTPE)
    : '—'}
</span>
```

**After:**
```jsx
<span 
  className="font-semibold text-white/80"
  title={
    allowableIncomingNoTPE == null && salaryMatchingSkipReason
      ? `Not applicable: ${salaryMatchingSkipReason}`
      : undefined
  }
>
  {allowableIncomingNoTPE != null
    ? formatSalary(allowableIncomingNoTPE)
    : '—'}
</span>
{salaryMatchingSkipReason && (
  <span className="ml-1 text-white/40 text-xs" title={`Reason: ${salaryMatchingSkipReason}`}>
    (N/A)
  </span>
)}
```

### How to Validate
1. Create a trade where one team uses TPE absorption
2. Hover over "—" value
3. Should show tooltip explaining why salary matching is not applicable

### Risks / Regressions
- Very low. Adding tooltip only.

---

## Fix 5: Document Base vs Matching Salary Display Choices

**Priority**: 🟢 P3 (Low - Documentation)

**Issue Reference**: ISSUE-002, ISSUE-005

**What becomes the single source of truth**: Documentation explaining intentional differences

**Plain English**: Different views show different salary values on purpose. The export shows "roster reality" (base salary), while trade matching shows adjusted values. This should be documented for future developers.

### Files to Touch
| File | Change |
|------|--------|
| `docs/TRADE_MACHINE_SALARY_DISPLAY.md` | Create new documentation file |

### Exact Change

Create new file with content explaining:
1. Base salary = actual contract amount
2. Matching value = adjusted for BYC/kicker/poison pill
3. Export uses base (roster reality)
4. Trade validation uses matching values
5. UI shows both with "Adj" badge when they differ

### How to Validate
1. Documentation exists
2. Future developers can understand the distinction

### Risks / Regressions
- None. Documentation only.

---

## Verification Checklist (Post-Implementation)

Run this checklist after implementing all fixes:

### Functional Checks
- [ ] `npm run build` succeeds
- [ ] `npm run test -- --run` passes (existing tests)
- [ ] `npm run test tests/trade/ -- --run` passes (trade-specific tests)
- [ ] `npm run test tests/salaryMatchingRules.test.js -- --run` passes
- [ ] `npm run test tests/tradeSalaryMatching.test.js -- --run` passes

### Manual Verification
- [ ] Build a 2-team trade with equal salaries - validation passes
- [ ] Build a trade with BYC player - see "Adj" badge on outgoing
- [ ] Build a trade with trade kicker player - see "Adj" badge on incoming
- [ ] Build a trade using TPE absorption - see "—" for allowable incoming
- [ ] TradeReceiptPanel (if enabled) shows matching values for debugging
- [ ] No console.log output from TradeSummaryPanel

### Code Quality Checks
- [ ] No new ESLint errors introduced
- [ ] `grep -rn "console.log" src/features/architect/tradeMachine --include="*.jsx"` returns only intentional debug-gated logs
- [ ] All snapshot accessor patterns use `getTeamSnapshot()` from `useTradeMachineSnapshot.js`

---

## Summary: Fix Implementation Order

| Order | Fix | Priority | Effort | Impact |
|-------|-----|----------|--------|--------|
| 1 | Remove console.log | 🟢 P3 | 1 min | Cleanup |
| 2 | Consolidate imports (documentation) | 🟢 P3 | 5 min | Maintainability |
| 3 | Add skip reason tooltip | 🟢 P3 | 10 min | UX |
| 4 | Wire TradeSalaryCalculator (Optional) | 🟡 P2 | 30 min | UX |
| 5 | Document salary display choices | 🟢 P3 | 15 min | Documentation |

**Total estimated effort**: ~1 hour for all fixes

---

## What NOT to Change

Based on the audit, these are **intentional design choices** that should NOT be "fixed":

1. **TradeExportCapture using base salary** - Intentional per Phase 2.2 (roster reality view)
2. **CapImpactTiles excluding cap holds from projected** - Intentional for trade matching semantics
3. **Estimate badges during validation delay** - Working as designed
4. **Multiple re-export files** - Keep for backwards compatibility, just document

---

## Appendix: Commands for Testing

```bash
# Run all tests
npm run test -- --run

# Run trade-specific tests
npm run test tests/trade/ -- --run

# Run salary matching tests
npm run test tests/salaryMatchingRules.test.js -- --run
npm run test tests/tradeSalaryMatching.test.js -- --run

# Check for console.log statements
grep -rn "console.log" src/features/architect/tradeMachine --include="*.jsx"

# Build check
npm run build

# Lint check
npm run lint -- --ext .jsx src/features/architect/tradeMachine/
```

---

## Appendix: Future Considerations

These are potential improvements that emerged from the audit but are out of scope for this fix plan:

1. **Incomplete Roster Charges**: `computeTeamCapTotals.js` has a placeholder for this (line 152). Could be implemented in the future.

2. **Options/Non-Guaranteed Handling**: Not currently implemented in matching calculations. Would require schema changes.

3. **Recently Signed FA Restriction**: 3-month restriction on trading recently signed FAs is not implemented. Low priority edge case.

4. **Real-time Validation Feedback**: Currently validation runs on state change. Could add debounced real-time feedback for better UX.

---

*End of Fix Plan*
